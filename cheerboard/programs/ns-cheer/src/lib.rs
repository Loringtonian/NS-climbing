// NS Climbing — live cheer board on a MagicBlock Ephemeral Rollup.
//
// Deliberately NOT part of the escrow money rail. This account holds a number,
// never funds: people in the room smash "I want this wall" on their phones and
// the tally spikes in real time on the projector. The PDA is delegated to the
// ER for the duration of the pitch (gasless ~10ms cheers), then undelegated,
// which commits the final tally back to the base layer.
//
// SDK usage mirrors the verified popup-market program in this repo's sibling
// project (ephemeral-rollups-sdk 0.14.x anchor API, MagicBlock counter example).

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz");

pub const BOARD_SEED: &[u8] = b"board";

#[ephemeral]
#[program]
pub mod ns_cheer {
    use super::*;

    /// Base layer. Creates the board. `authority` (the campaign runner) is the
    /// only one who can delegate/undelegate it.
    pub fn initialize(ctx: Context<Initialize>, board_id: u64) -> Result<()> {
        let board = &mut ctx.accounts.board;
        board.authority = ctx.accounts.authority.key();
        board.board_id = board_id;
        board.cheers = 0;
        Ok(())
    }

    /// Anywhere (base while undelegated, ER while delegated — where it's
    /// gasless and ~10ms). Anyone can cheer; that is the point. `nonce` is
    /// ignored by the program — it only makes rapid-fire taps from the same
    /// key produce distinct transaction signatures.
    pub fn cheer(ctx: Context<Cheer>, _nonce: u64) -> Result<()> {
        let board = &mut ctx.accounts.board;
        board.cheers = board.cheers.checked_add(1).unwrap();
        Ok(())
    }

    /// Base layer, authority-only. Hands the board PDA to the delegation
    /// program so the ER executes on it for the live session. Optional first
    /// remaining account pins a specific ER validator.
    pub fn delegate_board(ctx: Context<DelegateBoard>, board_id: u64) -> Result<()> {
        require!(
            ctx.accounts.board_state.authority == ctx.accounts.payer.key(),
            CheerError::Unauthorized
        );
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[BOARD_SEED, &board_id.to_le_bytes()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// ER, authority-only. Commits the final tally to the base layer and
    /// returns the PDA to this program. The ER copy evaporates.
    pub fn undelegate_board(ctx: Context<UndelegateBoard>) -> Result<()> {
        require!(
            ctx.accounts.board.authority == ctx.accounts.payer.key(),
            CheerError::Unauthorized
        );
        ctx.accounts.board.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.board.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(board_id: u64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8,
        seeds = [BOARD_SEED, &board_id.to_le_bytes()],
        bump
    )]
    pub board: Account<'info, Board>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cheer<'info> {
    #[account(mut)]
    pub board: Account<'info, Board>,
    pub cheerer: Signer<'info>,
}

/// The #[delegate] macro generates `delegate_pda(...)` for the `pda` field.
/// `board_state` is the same account, typed, for the authority check.
#[delegate]
#[derive(Accounts)]
#[instruction(board_id: u64)]
pub struct DelegateBoard<'info> {
    pub payer: Signer<'info>,
    /// CHECK: the board PDA to delegate
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
    #[account(seeds = [BOARD_SEED, &board_id.to_le_bytes()], bump)]
    pub board_state: Account<'info, Board>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateBoard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub board: Account<'info, Board>,
}

#[account]
pub struct Board {
    pub authority: Pubkey,
    pub board_id: u64,
    pub cheers: u64,
}

#[error_code]
pub enum CheerError {
    #[msg("Only the board authority can do this")]
    Unauthorized,
}
