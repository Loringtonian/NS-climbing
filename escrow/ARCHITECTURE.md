# ARCHITECTURE notes — decisions worth defending

## Supporter Badge: why the receipt PDA, not a Token-2022 non-transferable mint

The badge must be three things at once: proof-of-support (plaque credential),
the dissolve ballot, and non-transferable (votes can't be bought). We
evaluated Token-2022's NonTransferable extension — a real mint, one badge
token per depositor — and rejected it. It would add a mint account + an ATA
per depositor (~0.002 SOL each), mint CPIs in deposit and burn CPIs in the
refund crank, freeze-authority bookkeeping, and a whole second asset kept
in sync with the escrow's. And its non-transferability is a property the
extension enforces; the receipt PDA's non-transferability is a property of
the address itself — the account is derived from the depositor's pubkey
(`["receipt", campaign, depositor]`) and no instruction in the program can
reassign `depositor`. There is nothing to transfer, delegate, or approve.
Strictly stronger soulboundness, zero extra rent, zero new failure surface.
Both ballots (`voted` for dissolve, `payout_voted_seq` for the current
payout proposal) live on the badge, so vote accounting is atomic with the
badge's lifecycle by construction. Display layer: the deposit page reads
the badge and renders "Supporter Badge — $X locked in the pool ✓"; the explorer link
in agents.md is the verifiable public view. If a wallet-visible collectible
is ever wanted, a display-only Token-2022 mint can be layered on later
without touching escrow logic.

## Votes: strict dollar-weighted majority, electorate = pooled dollars

`vote_amount * 2 > total_escrowed` (exact integer strict-majority, u128 math)
for both ballots — `dissolve_amount` for dissolve, `payout_vote_amount` for
yes-on-the-current-payout-proposal. Each badge's weight is its own locked
`amount`: a $1000 V10 carries 50× the say of a $20 V1. Deposits are LOCKED
(no individual withdraw exists), so the pool only GROWS while a campaign is
active: a new deposit enlarges `total_escrowed` (the denominator) and can
un-make a standing payout dollar-majority until the electorate re-crosses it;
nobody can shrink it. The refund crank does decrement `total_escrowed` and
remove the departing badge's weight from whichever tallies it backed, but it
runs only post-dissolution or post-deadline — and since the deadline gate
(audit fix) also closes vote_payout and release at expiry, no live election
ever coexists with the crank. DISSOLVED is terminal because no code path
ever unsets it; deposit/propose/vote/release all gate on it, and the refund
crank treats it exactly like a passed deadline. Dollar-weighting is deliberate:
it makes governance cost real, locked capital, so a flood of cheap $20 wallets
can never reach a majority (Sybil-capture, present in an earlier head-count
design, is closed).

## Post-deadline is refunds-only (audit fix)

Originally `release` had no deadline gate, so a majority formed before expiry
could still execute after it — refunds and release coexisted, first mover
winning per depositor. The audit flagged the coexistence window and Lorin's
model resolved it: the timer is a hard promise. `release` AND `vote_payout`
now require `now <= deadline`; after expiry the only instruction that moves
money is the permissionless refund crank. A majority that never executed does
not survive the timer.

## Stray-transfer dust

Anyone can send USDC directly to the vault token account outside `deposit`.
Such dust is NOT tracked by `total_escrowed` and belongs to no receipt. On
`release`, the full vault balance (deposits + dust) goes to the
majority-approved payout address. On dissolution or deadline, badges refund
exactly their recorded
amounts and any dust stays in the vault permanently (the campaign PDA has no
instruction to sweep it). Don't send tokens straight to the vault.

## Campaign creation is organizer-gated (audit fix)

`initialize_campaign` requires the signer to be the pinned ORGANIZER key.
Without this, the canonical campaign PDA (derived from the public program ID
+ the public campaign_id string) could be front-run in the deploy->init gap
by anyone, installing themselves as admin. The pin closes the race; the cost
is that new campaigns need the organizer's signature, which is the intended
governance anyway.
