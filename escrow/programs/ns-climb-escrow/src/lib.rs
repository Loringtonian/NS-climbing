// NS Climbing Wall — refundable escrow.
//
// Trust model, in one paragraph: a depositor puts a tier amount ($20/$100/$1000
// USDC) into a program-owned vault. The depositor can withdraw it back AT ANY
// TIME until the moment funds are released — `withdraw` checks nothing except
// "not released yet", and returns exactly what the receipt recorded.
// Funds only ever leave the vault two ways: back to the depositor who put them in
// (withdraw / refund), or — if the goal was reached AND the admin co-signed
// approval before the deadline — to the buildout address fixed at campaign
// creation. There is no other path. No yield, no fees, no admin withdrawal.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw");

/// The only deposit sizes accepted (USDC base units, 6 decimals):
/// $20 / $100 / $1000. A fixed menu keeps the counter legible — perks per
/// tier live off-chain.
pub const TIER_AMOUNTS: [u64; 3] = [20_000_000, 100_000_000, 1_000_000_000];

/// Only this key can create campaigns. Closes the deploy→init front-running
/// window (program ID and campaign_id strings are public before init lands);
/// without it, anyone could squat the canonical campaign PDA with themselves
/// as admin. This is the organizer's disclosed key.
pub const ORGANIZER: Pubkey = anchor_lang::pubkey!("84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2");

#[program]
pub mod ns_climb_escrow {
    use super::*;

    /// Admin creates a campaign. Goal, deadline and the buildout destination
    /// are fixed here, visible on-chain to everyone. Deposit sizes are the
    /// program-wide TIER_AMOUNTS menu.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        campaign_id: String,
        goal: u64,
        deadline: i64,
        buildout: Pubkey,
    ) -> Result<()> {
        require!(campaign_id.len() <= 32, EscrowError::IdTooLong);
        require!(goal > 0, EscrowError::ZeroAmount);
        require!(
            deadline > Clock::get()?.unix_timestamp,
            EscrowError::DeadlineInPast
        );
        let c = &mut ctx.accounts.campaign;
        c.admin = ctx.accounts.admin.key();
        c.mint = ctx.accounts.mint.key();
        c.buildout = buildout;
        c.campaign_id = campaign_id;
        c.goal = goal;
        c.deadline = deadline;
        c.total_escrowed = 0;
        c.depositor_count = 0;
        c.tier_counts = [0; 3];
        c.dissolve_votes = 0;
        c.approved = false;
        c.dissolved = false;
        c.released = false;
        c.bump = ctx.bumps.campaign;
        Ok(())
    }

    /// One deposit per wallet, at exactly one of the TIER_AMOUNTS ($20/$100/
    /// $1000). Blocked after release or deadline. To change tier: withdraw,
    /// then deposit again at the new size.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        require!(
            Clock::get()?.unix_timestamp <= c.deadline,
            EscrowError::CampaignEnded
        );
        let tier = TIER_AMOUNTS
            .iter()
            .position(|&t| t == amount)
            .ok_or(EscrowError::InvalidTierAmount)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.depositor_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        let r = &mut ctx.accounts.receipt;
        r.campaign = c.key();
        r.depositor = ctx.accounts.depositor.key();
        r.amount = amount;
        r.voted = false;
        r.bump = ctx.bumps.receipt;

        c.total_escrowed = c.total_escrowed.checked_add(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_add(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_add(1).unwrap();
        Ok(())
    }

    /// THE load-bearing trust property: the depositor gets their money back at
    /// any time before release. The ONLY condition is `!released`. Not the
    /// deadline, not the goal, not admin approval, not dissolution — none of
    /// those can trap funds. Withdrawing also removes the depositor's dissolve
    /// vote (if cast) and shrinks the electorate, atomically in this instruction.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        require!(!ctx.accounts.campaign.released, EscrowError::AlreadyReleased);
        pay_back(
            &ctx.accounts.campaign,
            &ctx.accounts.vault,
            &ctx.accounts.depositor_token,
            &ctx.accounts.token_program,
            ctx.accounts.receipt.amount,
        )?;
        let voted = ctx.accounts.receipt.voted;
        let amount = ctx.accounts.receipt.amount;
        let c = &mut ctx.accounts.campaign;
        let tier = TIER_AMOUNTS
            .iter()
            .position(|&t| t == amount)
            .ok_or(EscrowError::InvalidTierAmount)?;
        c.total_escrowed = c.total_escrowed.checked_sub(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_sub(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_sub(1).unwrap();
        if voted {
            c.dissolve_votes = c.dissolve_votes.checked_sub(1).unwrap();
        }
        // Deliberate: a shrinking electorate can hand the remaining dissolve
        // votes a majority — departures count as silence, not as "no" votes.
        maybe_dissolve(c);
        Ok(())
    }

    /// Permissionless refund crank: after the deadline OR after a majority
    /// dissolution, ANYONE can push a depositor's money back to them. The
    /// tokens can only go to the receipt's depositor — the caller pays gas.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.campaign.released, EscrowError::AlreadyReleased);
        require!(
            now > ctx.accounts.campaign.deadline || ctx.accounts.campaign.dissolved,
            EscrowError::DeadlineNotPassed
        );
        pay_back(
            &ctx.accounts.campaign,
            &ctx.accounts.vault,
            &ctx.accounts.depositor_token,
            &ctx.accounts.token_program,
            ctx.accounts.receipt.amount,
        )?;
        let voted = ctx.accounts.receipt.voted;
        let amount = ctx.accounts.receipt.amount;
        let c = &mut ctx.accounts.campaign;
        let tier = TIER_AMOUNTS
            .iter()
            .position(|&t| t == amount)
            .ok_or(EscrowError::InvalidTierAmount)?;
        c.total_escrowed = c.total_escrowed.checked_sub(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_sub(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_sub(1).unwrap();
        if voted {
            c.dissolve_votes = c.dissolve_votes.checked_sub(1).unwrap();
        }
        maybe_dissolve(c);
        Ok(())
    }

    /// Emergency brake: any depositor can vote to dissolve. A strict head-count
    /// majority (votes * 2 > depositors) flips the campaign to DISSOLVED —
    /// terminal: release becomes permanently impossible and refunds open to
    /// everyone. The receipt (Supporter Badge) is the ballot: one per
    /// depositor, non-transferable by construction, revocable while active.
    pub fn vote_dissolve(ctx: Context<CastVote>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        let r = &mut ctx.accounts.receipt;
        require!(!r.voted, EscrowError::AlreadyVoted);
        r.voted = true;
        c.dissolve_votes = c.dissolve_votes.checked_add(1).unwrap();
        maybe_dissolve(c);
        Ok(())
    }

    /// Change your mind while the campaign is still active.
    pub fn unvote_dissolve(ctx: Context<CastVote>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        let r = &mut ctx.accounts.receipt;
        require!(r.voted, EscrowError::NotVoted);
        r.voted = false;
        c.dissolve_votes = c.dissolve_votes.checked_sub(1).unwrap();
        Ok(())
    }

    /// Admin's co-sign that the wall is greenlit. Must land before the deadline
    /// and cannot land on a dissolved campaign.
    pub fn approve_release(ctx: Context<ApproveRelease>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        require!(
            Clock::get()?.unix_timestamp <= c.deadline,
            EscrowError::CampaignEnded
        );
        c.approved = true;
        Ok(())
    }

    /// Anyone can execute the release once BOTH gates are true: goal reached
    /// AND admin approved. Funds go to the buildout address fixed at creation.
    /// A dissolved campaign can NEVER release — dissolution is terminal.
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let c = &ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        require!(c.approved, EscrowError::NotApproved);
        require!(c.total_escrowed >= c.goal, EscrowError::GoalNotReached);

        let amount = ctx.accounts.vault.amount;
        let seeds: &[&[u8]] = &[b"campaign", c.campaign_id.as_bytes(), &[c.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.buildout_token.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;
        ctx.accounts.campaign.released = true;
        Ok(())
    }
}

/// Strict head-count majority check, run after every vote or electorate
/// change: votes * 2 > depositors (exact integer form of "more than half").
/// Once true the campaign is DISSOLVED — terminal by construction, because
/// nothing ever sets `dissolved` back to false.
fn maybe_dissolve(c: &mut Campaign) {
    if !c.dissolved
        && c.depositor_count > 0
        && (c.dissolve_votes as u64) * 2 > c.depositor_count as u64
    {
        c.dissolved = true;
    }
}

/// Vault → depositor transfer signed by the campaign PDA. Used by both
/// `withdraw` (self-service) and `refund` (deadline/dissolution crank).
fn pay_back<'info>(
    campaign: &Account<'info, Campaign>,
    vault: &Account<'info, TokenAccount>,
    depositor_token: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[
        b"campaign",
        campaign.campaign_id.as_bytes(),
        &[campaign.bump],
    ];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.key(),
            Transfer {
                from: vault.to_account_info(),
                to: depositor_token.to_account_info(),
                authority: campaign.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub buildout: Pubkey,
    #[max_len(32)]
    pub campaign_id: String,
    pub goal: u64,
    pub deadline: i64,
    pub total_escrowed: u64,
    pub depositor_count: u32,
    /// Depositor count per tier, same order as TIER_AMOUNTS ($20/$100/$1000).
    pub tier_counts: [u32; 3],
    /// Current dissolve votes among active depositors (badge-holders).
    pub dissolve_votes: u32,
    pub approved: bool,
    /// Terminal: set by a strict depositor majority; blocks deposit, approval
    /// and release forever; opens the permissionless refund crank.
    pub dissolved: bool,
    pub released: bool,
    pub bump: u8,
}

/// The Supporter Badge. One per depositor, derived from their pubkey — there
/// is no instruction anywhere in this program that changes `depositor`, so
/// the badge is non-transferable by construction ("soulbound"). It is
/// simultaneously: proof of support (the plaque credential), the dissolve
/// ballot (`voted`), and the record of exactly what withdraw returns.
#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub campaign: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub voted: bool,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(campaign_id: String)]
pub struct InitializeCampaign<'info> {
    #[account(mut, address = ORGANIZER @ EscrowError::UnauthorizedInitializer)]
    pub admin: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"campaign", campaign_id.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(
        init,
        payer = admin,
        seeds = [b"vault", campaign.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = campaign,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"campaign", campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"vault", campaign.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = campaign.mint, token::authority = depositor)]
    pub depositor_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = depositor,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", campaign.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"campaign", campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"vault", campaign.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = campaign.mint, token::authority = depositor)]
    pub depositor_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = depositor,
        seeds = [b"receipt", campaign.key().as_ref(), depositor.key().as_ref()],
        bump = receipt.bump,
        has_one = depositor,
    )]
    pub receipt: Account<'info, Receipt>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    /// Anyone may crank a post-deadline refund; they pay gas, tokens and the
    /// receipt's rent go to the depositor recorded on the receipt.
    pub cranker: Signer<'info>,
    /// CHECK: validated by `has_one = depositor` on the receipt; receives only
    /// the closed receipt's rent lamports.
    #[account(mut)]
    pub depositor: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"campaign", campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"vault", campaign.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = campaign.mint, token::authority = receipt.depositor)]
    pub depositor_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = depositor,
        seeds = [b"receipt", campaign.key().as_ref(), receipt.depositor.as_ref()],
        bump = receipt.bump,
        has_one = depositor,
    )]
    pub receipt: Account<'info, Receipt>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"campaign", campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        mut,
        seeds = [b"receipt", campaign.key().as_ref(), depositor.key().as_ref()],
        bump = receipt.bump,
        has_one = depositor,
    )]
    pub receipt: Account<'info, Receipt>,
}

#[derive(Accounts)]
pub struct ApproveRelease<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.bump,
        has_one = admin,
    )]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// Anyone can execute a fully-gated release; they just pay gas.
    pub executor: Signer<'info>,
    #[account(mut, seeds = [b"campaign", campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"vault", campaign.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = campaign.mint, token::authority = campaign.buildout)]
    pub buildout_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum EscrowError {
    #[msg("campaign_id must be 32 bytes or fewer")]
    IdTooLong,
    #[msg("goal must be nonzero")]
    ZeroAmount,
    #[msg("amount must be exactly $20, $100, or $1000 USDC")]
    InvalidTierAmount,
    #[msg("deadline must be in the future")]
    DeadlineInPast,
    #[msg("funds already released")]
    AlreadyReleased,
    #[msg("campaign deadline has passed")]
    CampaignEnded,
    #[msg("deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("admin has not approved release")]
    NotApproved,
    #[msg("goal not reached")]
    GoalNotReached,
    #[msg("campaign dissolved by depositor majority — refunds are open")]
    Dissolved,
    #[msg("this badge has already voted to dissolve")]
    AlreadyVoted,
    #[msg("this badge has no dissolve vote to remove")]
    NotVoted,
    #[msg("only the organizer key can create campaigns")]
    UnauthorizedInitializer,
}
