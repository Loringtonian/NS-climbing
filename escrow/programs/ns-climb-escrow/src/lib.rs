// NS Climbing Wall — refundable escrow, v3: dual-gate destination vote.
//
// Trust model, in one paragraph: a depositor puts a tier amount ($20/$100/$1000
// USDC) into a program-owned pool. Deposits are LOCKED — there is no
// individual withdraw; commitment is the product. Money leaves the vault by
// exactly three collective paths and nothing else: (1) the dual gate — the
// organizer proposes a payout address and a strict head-count majority of
// current depositors approves THAT proposal, then anyone can release the
// whole vault to it; (2) a strict majority votes DISSOLVE (terminal) and the
// permissionless refund crank returns every deposit to its depositor;
// (3) the deadline passes and the same refund crank opens — post-deadline is refunds-ONLY (no votes, no releases).
// Neither the organizer nor a majority alone can move funds to a third party.
// No yield, no fees, no admin withdrawal, no human custody.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD");

/// The only deposit sizes accepted (USDC base units, 6 decimals):
/// $20 / $100 / $1000. A fixed menu keeps the counter legible — perks per
/// tier live off-chain.
pub const TIER_AMOUNTS: [u64; 3] = [20_000_000, 100_000_000, 1_000_000_000];

/// Only this key can create campaigns and propose payout addresses. Closes the
/// deploy→init front-running window and is one axis of the dual release gate.
/// This is the organizer's disclosed key.
pub const ORGANIZER: Pubkey = anchor_lang::pubkey!("84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2");

#[program]
pub mod ns_climb_escrow {
    use super::*;

    /// Organizer creates a campaign. No goal, no destination — "raise as much
    /// as possible" mode; where money can go is decided later by the dual
    /// gate. Only the deadline is fixed here.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        campaign_id: String,
        deadline: i64,
    ) -> Result<()> {
        require!(campaign_id.len() <= 32, EscrowError::IdTooLong);
        require!(
            deadline > Clock::get()?.unix_timestamp,
            EscrowError::DeadlineInPast
        );
        let c = &mut ctx.accounts.campaign;
        c.admin = ctx.accounts.admin.key();
        c.mint = ctx.accounts.mint.key();
        c.campaign_id = campaign_id;
        c.deadline = deadline;
        c.total_escrowed = 0;
        c.depositor_count = 0;
        c.tier_counts = [0; 3];
        c.dissolve_votes = 0;
        c.proposed_payout = Pubkey::default();
        c.proposal_id = 0;
        c.payout_votes = 0;
        c.dissolved = false;
        c.released = false;
        c.bump = ctx.bumps.campaign;
        Ok(())
    }

    /// One deposit per wallet, at exactly one of the TIER_AMOUNTS ($20/$100/
    /// $1000), LOCKED until a collective path closes the campaign — no
    /// individual withdraw exists, and no tier changes (kept deliberately
    /// simple). Blocked after release, dissolution, or deadline. Note: a new
    /// depositor enlarges the electorate, which can un-make a standing payout
    /// majority until they vote — releases only execute while a majority of
    /// CURRENT depositors stands.
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
        r.payout_voted_seq = 0;
        r.bump = ctx.bumps.receipt;

        c.total_escrowed = c.total_escrowed.checked_add(amount).unwrap();
        c.depositor_count = c.depositor_count.checked_add(1).unwrap();
        c.tier_counts[tier] = c.tier_counts[tier].checked_add(1).unwrap();
        Ok(())
    }

    /// The ONLY per-depositor exit, and it is collective by construction:
    /// after the deadline OR after a majority dissolution, ANYONE can push a
    /// depositor's money back to them (permissionless crank). The tokens can
    /// only go to the receipt's depositor — the caller pays gas. On an active
    /// campaign this instruction is a hard error: deposits are locked.
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
        let r_voted = ctx.accounts.receipt.voted;
        let r_amount = ctx.accounts.receipt.amount;
        let r_payout_seq = ctx.accounts.receipt.payout_voted_seq;
        remove_depositor(&mut ctx.accounts.campaign, r_amount, r_voted, r_payout_seq)?;
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

    /// Organizer's half of the dual gate: propose where the money goes.
    /// Proposing — or re-proposing a different address — bumps the proposal
    /// epoch, which RESETS all payout votes (receipts vote per-epoch, so stale
    /// votes simply stop counting). Blocked once dissolved/released, and after
    /// the deadline (the campaign window is over; refunds rule then).
    pub fn propose_payout(ctx: Context<ProposePayout>, payout: Pubkey) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        require!(
            Clock::get()?.unix_timestamp <= c.deadline,
            EscrowError::CampaignEnded
        );
        require!(payout != Pubkey::default(), EscrowError::InvalidPayout);
        c.proposed_payout = payout;
        c.proposal_id = c.proposal_id.checked_add(1).unwrap();
        c.payout_votes = 0;
        Ok(())
    }

    /// Depositors' half of the dual gate: vote yes on the CURRENT proposal.
    /// Revocable. One badge, one vote, per proposal epoch.
    pub fn vote_payout(ctx: Context<CastVote>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        require!(
            Clock::get()?.unix_timestamp <= c.deadline,
            EscrowError::CampaignEnded
        );
        require!(c.proposal_id > 0, EscrowError::NoProposal);
        let r = &mut ctx.accounts.receipt;
        require!(
            r.payout_voted_seq != c.proposal_id,
            EscrowError::AlreadyVotedPayout
        );
        r.payout_voted_seq = c.proposal_id;
        c.payout_votes = c.payout_votes.checked_add(1).unwrap();
        Ok(())
    }

    /// Take a payout vote back (current proposal only).
    pub fn unvote_payout(ctx: Context<CastVote>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        let r = &mut ctx.accounts.receipt;
        require!(
            c.proposal_id > 0 && r.payout_voted_seq == c.proposal_id,
            EscrowError::NotVotedPayout
        );
        r.payout_voted_seq = 0;
        c.payout_votes = c.payout_votes.checked_sub(1).unwrap();
        Ok(())
    }

    /// Anyone can execute the release once the dual gate stands: an organizer
    /// proposal exists AND a strict majority of CURRENT depositors has voted
    /// for it — and only BEFORE the deadline. Funds go to a token account
    /// owned by exactly the proposed address. A dissolved campaign can NEVER
    /// release, and neither can an expired one: dissolution and the timer
    /// both win over a standing majority.
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let c = &ctx.accounts.campaign;
        require!(!c.released, EscrowError::AlreadyReleased);
        require!(!c.dissolved, EscrowError::Dissolved);
        // Post-deadline is REFUNDS-ONLY: a majority that never executed does
        // not survive the timer. (Audit fix, 2026-07-11.)
        require!(
            Clock::get()?.unix_timestamp <= c.deadline,
            EscrowError::CampaignEnded
        );
        require!(c.proposal_id > 0, EscrowError::NoProposal);
        require!(
            c.depositor_count > 0
                && (c.payout_votes as u64) * 2 > c.depositor_count as u64,
            EscrowError::ProposalNotApproved
        );

        let amount = ctx.accounts.vault.amount;
        let seeds: &[&[u8]] = &[b"campaign", c.campaign_id.as_bytes(), &[c.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.payout_token.to_account_info(),
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

/// Strict head-count majority check for dissolution, run after every dissolve
/// vote or electorate change: votes * 2 > depositors (exact integer form of
/// "more than half"). Once true the campaign is DISSOLVED — terminal by
/// construction, because nothing ever sets `dissolved` back to false.
fn maybe_dissolve(c: &mut Campaign) {
    if !c.dissolved
        && c.depositor_count > 0
        && (c.dissolve_votes as u64) * 2 > c.depositor_count as u64
    {
        c.dissolved = true;
    }
}

/// Refund-crank bookkeeping: shrink totals/tiers and clear the departing
/// depositor's votes. Refunds only run post-dissolution or post-deadline,
/// and BOTH release and vote_payout are deadline-gated (audit fix), so no
/// live election exists while this runs — it keeps the public counters
/// honest while the crank drains the pool.
fn remove_depositor(
    c: &mut Campaign,
    amount: u64,
    voted_dissolve: bool,
    payout_voted_seq: u32,
) -> Result<()> {
    let tier = TIER_AMOUNTS
        .iter()
        .position(|&t| t == amount)
        .ok_or(EscrowError::InvalidTierAmount)?;
    c.total_escrowed = c.total_escrowed.checked_sub(amount).unwrap();
    c.depositor_count = c.depositor_count.checked_sub(1).unwrap();
    c.tier_counts[tier] = c.tier_counts[tier].checked_sub(1).unwrap();
    if voted_dissolve {
        c.dissolve_votes = c.dissolve_votes.checked_sub(1).unwrap();
    }
    if c.proposal_id > 0 && payout_voted_seq == c.proposal_id {
        c.payout_votes = c.payout_votes.checked_sub(1).unwrap();
    }
    maybe_dissolve(c);
    Ok(())
}

/// Vault → depositor transfer signed by the campaign PDA.
/// Used only by `refund` (the collective deadline/dissolution crank).
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
    #[max_len(32)]
    pub campaign_id: String,
    pub deadline: i64,
    pub total_escrowed: u64,
    pub depositor_count: u32,
    /// Depositor count per tier, same order as TIER_AMOUNTS ($20/$100/$1000).
    pub tier_counts: [u32; 3],
    /// Current dissolve votes among active depositors (badge-holders).
    pub dissolve_votes: u32,
    /// The organizer's currently proposed payout address (default = none).
    pub proposed_payout: Pubkey,
    /// Proposal epoch: bumps on every propose_payout, invalidating all prior
    /// payout votes (receipts vote per-epoch). 0 = never proposed.
    pub proposal_id: u32,
    /// Yes-votes on the CURRENT proposal epoch.
    pub payout_votes: u32,
    /// Terminal: set by a strict depositor majority; blocks deposit, proposal
    /// and release forever; opens the permissionless refund crank.
    pub dissolved: bool,
    pub released: bool,
    pub bump: u8,
}

/// The Supporter Badge. One per depositor, derived from their pubkey — there
/// is no instruction anywhere in this program that changes `depositor`, so
/// the badge is non-transferable by construction ("soulbound"). It is
/// simultaneously: proof of support (the plaque credential), BOTH ballots
/// (`voted` for dissolve, `payout_voted_seq` for the current payout
/// proposal), and the record of exactly what the refund crank returns.
#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub campaign: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub voted: bool,
    pub payout_voted_seq: u32,
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
pub struct Refund<'info> {
    /// Anyone may crank a post-deadline/post-dissolution refund; they pay gas,
    /// tokens and the receipt's rent go to the depositor recorded on the receipt.
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
pub struct ProposePayout<'info> {
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
    #[account(mut, token::mint = campaign.mint, token::authority = campaign.proposed_payout)]
    pub payout_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum EscrowError {
    #[msg("campaign_id must be 32 bytes or fewer")]
    IdTooLong,
    #[msg("deadline must be in the future")]
    DeadlineInPast,
    #[msg("funds already released")]
    AlreadyReleased,
    #[msg("campaign deadline has passed")]
    CampaignEnded,
    #[msg("deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("amount must be exactly $20, $100, or $1000 USDC")]
    InvalidTierAmount,
    #[msg("campaign dissolved by depositor majority — refunds are open")]
    Dissolved,
    #[msg("this badge has already voted to dissolve")]
    AlreadyVoted,
    #[msg("this badge has no dissolve vote to remove")]
    NotVoted,
    #[msg("only the organizer key can create campaigns")]
    UnauthorizedInitializer,
    #[msg("no payout has been proposed")]
    NoProposal,
    #[msg("payout address cannot be the default pubkey")]
    InvalidPayout,
    #[msg("this badge already voted for the current proposal")]
    AlreadyVotedPayout,
    #[msg("this badge has no vote on the current proposal")]
    NotVotedPayout,
    #[msg("the current proposal lacks a depositor majority")]
    ProposalNotApproved,
}
