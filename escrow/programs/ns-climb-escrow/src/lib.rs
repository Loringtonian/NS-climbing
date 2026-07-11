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
        c.approved = false;
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
        r.bump = ctx.bumps.receipt;

        c.total_escrowed = c.total_escrowed.checked_add(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_add(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_add(1).unwrap();
        Ok(())
    }

    /// THE load-bearing trust property: the depositor gets their money back at
    /// any time before release. The ONLY condition is `!released`. Not the
    /// deadline, not the goal, not admin approval — none of those can trap funds.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        require!(!ctx.accounts.campaign.released, EscrowError::AlreadyReleased);
        pay_back(
            &ctx.accounts.campaign,
            &ctx.accounts.vault,
            &ctx.accounts.depositor_token,
            &ctx.accounts.token_program,
            ctx.accounts.receipt.amount,
        )?;
        let c = &mut ctx.accounts.campaign;
        let amount = ctx.accounts.receipt.amount;
        let tier = TIER_AMOUNTS
            .iter()
            .position(|&t| t == amount)
            .ok_or(EscrowError::InvalidTierAmount)?;
        c.total_escrowed = c.total_escrowed.checked_sub(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_sub(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_sub(1).unwrap();
        Ok(())
    }

    /// After the deadline, if funds were never released, ANYONE can push a
    /// depositor's money back to them (permissionless refund crank). The tokens
    /// can only go to the receipt's depositor — the caller just pays the gas.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.campaign.released, EscrowError::AlreadyReleased);
        require!(
            now > ctx.accounts.campaign.deadline,
            EscrowError::DeadlineNotPassed
        );
        pay_back(
            &ctx.accounts.campaign,
            &ctx.accounts.vault,
            &ctx.accounts.depositor_token,
            &ctx.accounts.token_program,
            ctx.accounts.receipt.amount,
        )?;
        let c = &mut ctx.accounts.campaign;
        let amount = ctx.accounts.receipt.amount;
        let tier = TIER_AMOUNTS
            .iter()
            .position(|&t| t == amount)
            .ok_or(EscrowError::InvalidTierAmount)?;
        c.total_escrowed = c.total_escrowed.checked_sub(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_sub(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_sub(1).unwrap();
        Ok(())
    }

    /// Admin's co-sign that the wall is greenlit. Must land before the deadline.
    /// Approval alone moves no money — depositors can still withdraw.
    pub fn approve_release(ctx: Context<ApproveRelease>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(
            Clock::get()?.unix_timestamp <= c.deadline,
            EscrowError::CampaignEnded
        );
        c.approved = true;
        Ok(())
    }

    /// Anyone can execute the release once BOTH gates are true: goal reached
    /// AND admin approved. Funds go to the buildout address fixed at creation.
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let c = &ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
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

/// Vault → depositor transfer signed by the campaign PDA. Used by both
/// `withdraw` (self-service) and `refund` (post-deadline crank).
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
    pub approved: bool,
    pub released: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub campaign: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(campaign_id: String)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
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
}
