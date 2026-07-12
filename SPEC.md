# SPEC.md — the canonical contract specification

> This document is law for the `ns_climb_escrow` program in this repository.
> It describes exactly what the frozen binary does — no aspirations, no
> roadmap. A cold reader (human or agent) should be able to verify every
> sentence against `escrow/programs/ns-climb-escrow/src/lib.rs` and the test
> suite `escrow/tests/escrow.ts`. Binary pin and build-verification procedure:
> `escrow/DEPLOY.md`. Live deployment state: `escrow/DEVNET_STATE.md`,
> `REHEARSALS.md` (when present), and `agents.md`.

## The model, stated as law

**Deposits lock.** A depositor moves USDC into a program-owned pool and
receives a badge. From that moment, NO instruction exists that returns an
individual depositor's money while the campaign is active. There is no
withdraw. Individual exit is absent BY DESIGN — pooling the commitment is the
product.

**Voting is weighted by dollars, not wallets.** Each badge's vote weight is the
depositor's own locked `amount`. A $1000 badge carries 50× the weight of a $20
badge. "Majority" throughout means a strict majority of the DOLLARS currently
in the pool (`total_escrowed`), never a count of wallets.

**Money leaves the pool through exactly three collective outcomes:**

1. **Destination release (the dual gate).** The organizer proposes a payout
   address; depositors backing a strict majority of the pooled dollars vote yes
   on that specific proposal; then ANYONE may execute `release`, which transfers
   the entire vault balance to a token account owned by exactly the proposed
   address. Neither side alone suffices: the organizer casts no votes of their
   own beyond any deposit they make, and depositors cannot route funds to an
   address the organizer did not propose.
2. **No-confidence dissolve.** Depositors backing a strict majority of the
   pooled dollars vote dissolve. The campaign becomes DISSOLVED — terminal —
   and the permissionless refund crank opens immediately.
3. **Dead-man timer.** If the deadline passes without a release, the same
   permissionless refund crank opens for everyone — and nothing else remains
   possible: post-deadline is refunds-only. The deadline is set at init and
   capped in code at 190 days (`MAX_CAMPAIGN_SECONDS`), so the ~6-month
   timeout-refund promise is enforceable, not merely stated.

Refunds (paths 2 and 3) return to each depositor exactly the amount recorded
on their badge, into a token account owned by their own wallet, and can be
cranked by anyone (the cranker pays gas and can steer nothing).

## Constants

| Constant | Value | Where |
|----------|-------|-------|
| `TIER_AMOUNTS` | `[20_000_000, 100_000_000, 1_000_000_000]` — exactly $20 / $100 / $1000 USDC (6 decimals) | lib.rs |
| `ORGANIZER` | `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` — the only key that can create campaigns and propose payouts | lib.rs |
| `MAX_CAMPAIGN_SECONDS` | `190 * 24 * 60 * 60` — hard ceiling on campaign length, enforced at init | lib.rs |

## Accounts

**Campaign** — PDA, seeds `["campaign", campaign_id_utf8]`.
Fields (borsh order): `admin: Pubkey`, `mint: Pubkey`, `campaign_id: String
(≤32)`, `deadline: i64`, `total_escrowed: u64`, `depositor_count: u32`,
`tier_counts: [u32; 3]`, `dissolve_amount: u64` (USDC base units backing
dissolve), `proposed_payout: Pubkey` (all-zeros = never proposed),
`proposal_id: u32` (epoch, 0 = none), `payout_vote_amount: u64` (USDC base
units backing the CURRENT epoch), `dissolved: bool`, `released: bool`,
`bump: u8`.

**Vault** — token-account PDA, seeds `["vault", campaign]`, authority = the
campaign PDA, mint = `campaign.mint`. Holds the pool.

**Receipt / Supporter Badge** — PDA, seeds `["receipt", campaign,
depositor]`, 86 bytes. Fields: `campaign: Pubkey`, `depositor: Pubkey`,
`amount: u64` (also the vote weight), `voted: bool` (dissolve ballot),
`payout_voted_seq: u32` (payout ballot: counts only while ==
`campaign.proposal_id`), `bump: u8`. The badge is non-transferable as an
ADDRESS PROPERTY: it is derived from the depositor's pubkey and no instruction
anywhere reassigns `depositor`. It is simultaneously proof-of-support, both
ballots, and the refund record. It closes (rent to the depositor) only when the
refund crank pays them out.

## Instructions and their gates

| Instruction | Signer | Gates (all must hold) | Effect |
|-------------|--------|------------------------|--------|
| `initialize_campaign(campaign_id, deadline)` | ORGANIZER only (`address =` constraint) | id ≤ 32 bytes; deadline in future; deadline ≤ now + `MAX_CAMPAIGN_SECONDS` | Creates campaign + vault. No goal, no destination. |
| `deposit(amount)` | depositor | not released; not dissolved; now ≤ deadline; amount ∈ TIER_AMOUNTS; no existing badge for this wallet | Transfers amount to vault; issues badge; `total_escrowed` and counters up. One deposit per wallet, locked as-is — no tier changes. |
| `vote_dissolve` | badge-holder | not released; not dissolved; badge hasn't voted dissolve | `dissolve_amount += badge.amount`; then majority check (below). |
| `unvote_dissolve` | badge-holder | not released; not dissolved; badge has a dissolve vote | `dissolve_amount −= badge.amount`. |
| `propose_payout(payout)` | ORGANIZER (`has_one = admin`) | not released; not dissolved; now ≤ deadline; payout ≠ default pubkey | Sets proposed_payout; proposal_id += 1; `payout_vote_amount = 0` (every re-proposal resets consent). |
| `vote_payout` | badge-holder | not released; not dissolved; now ≤ deadline; a proposal exists; badge hasn't voted THIS epoch | `payout_vote_amount += badge.amount`; badge records the epoch. |
| `unvote_payout` | badge-holder | not released; not dissolved; badge voted THIS epoch | `payout_vote_amount −= badge.amount`. |
| `release` | ANYONE | not released; not dissolved; now ≤ deadline; a proposal exists; `total_escrowed > 0` and `payout_vote_amount × 2 > total_escrowed`; destination token account owned by exactly `proposed_payout` (account constraint) and of `campaign.mint` | Transfers the FULL vault balance; sets released (terminal). |
| `refund` | ANYONE (cranker) | not released; (now > deadline) OR dissolved; destination token account owned by exactly the badge's depositor and of `campaign.mint` | Pays the badge's exact amount to its depositor; closes the badge (rent to depositor); `total_escrowed` and counters down, and the departing badge's weight is removed from whichever tallies it backed. |

**Majority arithmetic** — strict, dollar-weighted, exact integer form with
u128 math so the doubling cannot overflow:
`vote_amount × 2 > total_escrowed`. Exactly half the dollars is NOT a majority.
Vote weight = the badge's own locked `amount`.

**Dissolution check** runs after every dissolve vote and after every
refund-crank bookkeeping pass. Once `dissolved` is set, nothing unsets it.

## Invariants the test suite enforces (escrow/tests/escrow.ts — 19 tests)

1. No withdraw exists on the program surface (asserted at the IDL level) and
   `refund` hard-fails on an active campaign (`DeadlineNotPassed`) — locked
   means locked.
2. Only ORGANIZER can `initialize_campaign` (front-run guard,
   `UnauthorizedInitializer`) and only the campaign admin can `propose_payout`.
3. Non-tier amounts are rejected; per-tier counters and `total_escrowed` track
   deposits exactly.
4. The deadline is capped: a deadline past `MAX_CAMPAIGN_SECONDS` is rejected
   (`DeadlineTooFar`).
5. `release` requires a dollar-majority: a minority of dollars cannot release; a
   dollar-majority can; **exactly half the dollars is rejected** (strict `>`);
   and a flood of $20 wallets cannot outvote one $1000 depositor.
6. `release` is impossible: with no proposal; with a stale-epoch majority
   (re-proposal reset); to any destination not owned by the proposed address;
   after dissolution (even with a full payout majority standing); after the
   deadline (even with a majority standing at expiry — proven on-chain); after a
   prior release.
7. New deposits dilute a standing payout dollar-majority until the electorate
   re-crosses the threshold (majority is evaluated at execution time against
   CURRENT `total_escrowed`).
8. Dissolve is dollar-weighted and beats a payout majority; a dissolve
   dollar-minority does not dissolve.
9. Both votes are revocable while active; double-votes rejected; the badge
   persists through vote changes; voting with someone else's badge is rejected
   (seeds + has_one).
10. Refund-theft is impossible: cranking a refund toward any token account not
    owned by the badge's depositor is rejected; refund amounts are exact; and
    refunding a depositor who voted BOTH payout and dissolve clears its weight
    from BOTH tallies exactly (no desync).
11. Dissolution opens refunds immediately (pre-deadline); after the deadline,
    proposals, payout votes and release are all rejected (`CampaignEnded`) and
    only the refund crank remains live.

## Deadline semantics — post-deadline is REFUNDS-ONLY

`release`, `vote_payout`, `propose_payout` and `deposit` are ALL
deadline-gated (`CampaignEnded`). A majority that stood at expiry but never
executed does not survive the timer: after the deadline the only live
instruction that moves money is the permissionless refund crank, returning
every deposit exactly. (This closes the pre-audit coexistence window where a
stale majority could still release after expiry.)

## The trust assumption (disclosed precisely)

Because votes are dollar-weighted and only the organizer can PROPOSE a
destination, exactly one actor can extract funds: an actor who both proposes
(the organizer) AND locks more dollars than the rest of the pool combined, then
self-ratifies and releases to their own address. The honest assumption is that
the named, disclosed `ORGANIZER` does not out-deposit the whole pool to
redirect it. No outside party can propose, so no outside party can move funds
anywhere but back to depositors. Two consequences follow, both disclosed:

- **No cheap Sybil capture.** Matching one $1000 vote requires >50 wallets each
  holding $20 of real, locked capital; a flood of throwaway wallets can never
  reach a dollar-majority. (Head-count Sybil capture, present in an earlier
  design, is closed by dollar-weighting.)
- **Griefing = delay, never theft.** A well-capitalized actor can deposit to
  dilute a standing release majority, stalling a release until the deadline
  forces a full refund. The worst case is everyone gets their money back.

## Upgrade authority (disclosure)

The program is upgradeable by the organizer's key (`ORGANIZER`) only in the
moments around launch; the plan of record — and the disclosed commitment — is
to burn it (`solana program set-upgrade-authority … --final`) BEFORE any real
deposit is taken, making the code immutable forever. Verify the live authority
yourself: `solana program show <PROGRAM_ID> -u <cluster>` — expect no authority
once burned. Reproducible build (hash-match, `escrow/DEPLOY.md`) plus a burned
authority together mean the audited bytes are the bytes that run, unchangeably.

## What this program does NOT contain

No goal or funding threshold. No individual withdraw. No tier changes or
top-ups. No transferable token, no yield, no fees. No oracle. No admin path
to move, freeze, or redirect deposits. No instruction to sweep stray tokens
sent directly to the vault (don't do that — see
`escrow/ARCHITECTURE.md`, "Stray-transfer dust").
