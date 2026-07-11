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

**Money leaves the pool through exactly three collective outcomes:**

1. **Destination release (the dual gate).** The organizer proposes a payout
   address; a strict head-count majority of current depositors votes yes on
   that specific proposal; then ANYONE may execute `release`, which transfers
   the entire vault balance to a token account owned by exactly the proposed
   address. Neither side alone suffices: the organizer casts no votes, and
   depositors cannot route funds to an address the organizer did not propose.
2. **No-confidence dissolve.** A strict head-count majority of current
   depositors votes dissolve. The campaign becomes DISSOLVED — terminal —
   and the permissionless refund crank opens immediately.
3. **Dead-man timer.** If the deadline passes without a release, the same
   permissionless refund crank opens for everyone — and nothing else remains
   possible: post-deadline is refunds-only.

Refunds (paths 2 and 3) return to each depositor exactly the amount recorded
on their badge, into a token account owned by their own wallet, and can be
cranked by anyone (the cranker pays gas and can steer nothing).

## Constants

| Constant | Value | Where |
|----------|-------|-------|
| `TIER_AMOUNTS` | `[20_000_000, 100_000_000, 1_000_000_000]` — exactly $20 / $100 / $1000 USDC (6 decimals) | lib.rs |
| `ORGANIZER` | `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` — the only key that can create campaigns and propose payouts | lib.rs |

## Accounts

**Campaign** — PDA, seeds `["campaign", campaign_id_utf8]`.
Fields (borsh order): `admin: Pubkey`, `mint: Pubkey`, `campaign_id: String
(≤32)`, `deadline: i64`, `total_escrowed: u64`, `depositor_count: u32`,
`tier_counts: [u32; 3]`, `dissolve_votes: u32`, `proposed_payout: Pubkey`
(all-zeros = never proposed), `proposal_id: u32` (epoch, 0 = none),
`payout_votes: u32` (yes-votes on the CURRENT epoch), `dissolved: bool`,
`released: bool`, `bump: u8`.

**Vault** — token-account PDA, seeds `["vault", campaign]`, authority = the
campaign PDA, mint = `campaign.mint`. Holds the pool.

**Receipt / Supporter Badge** — PDA, seeds `["receipt", campaign,
depositor]`, 86 bytes. Fields: `campaign: Pubkey`, `depositor: Pubkey`,
`amount: u64`, `voted: bool` (dissolve ballot), `payout_voted_seq: u32`
(payout ballot: counts only while == `campaign.proposal_id`), `bump: u8`.
The badge is non-transferable as an ADDRESS PROPERTY: it is derived from the
depositor's pubkey and no instruction anywhere reassigns `depositor`. It is
simultaneously proof-of-support, both ballots, and the refund record. It
closes (rent to the depositor) only when the refund crank pays them out.

## Instructions and their gates

| Instruction | Signer | Gates (all must hold) | Effect |
|-------------|--------|------------------------|--------|
| `initialize_campaign(campaign_id, deadline)` | ORGANIZER only (`address =` constraint) | id ≤ 32 bytes; deadline in future | Creates campaign + vault. No goal, no destination. |
| `deposit(amount)` | depositor | not released; not dissolved; now ≤ deadline; amount ∈ TIER_AMOUNTS; no existing badge for this wallet | Transfers amount to vault; issues badge; counters up. One deposit per wallet, locked as-is — no tier changes. |
| `vote_dissolve` | badge-holder | not released; not dissolved; badge hasn't voted dissolve | dissolve_votes += 1; then majority check (below). |
| `unvote_dissolve` | badge-holder | not released; not dissolved; badge has a dissolve vote | dissolve_votes −= 1. |
| `propose_payout(payout)` | ORGANIZER (`has_one = admin`) | not released; not dissolved; now ≤ deadline; payout ≠ default pubkey | Sets proposed_payout; proposal_id += 1; payout_votes = 0 (every re-proposal resets consent). |
| `vote_payout` | badge-holder | not released; not dissolved; now ≤ deadline; a proposal exists; badge hasn't voted THIS epoch | payout_votes += 1; badge records the epoch. |
| `unvote_payout` | badge-holder | not released; not dissolved; badge voted THIS epoch | payout_votes −= 1. |
| `release` | ANYONE | not released; not dissolved; now ≤ deadline; a proposal exists; `payout_votes × 2 > depositor_count` with depositor_count > 0; destination token account owned by exactly `proposed_payout` (account constraint) and of `campaign.mint` | Transfers the FULL vault balance; sets released (terminal). |
| `refund` | ANYONE (cranker) | not released; (now > deadline) OR dissolved; destination token account owned by exactly the badge's depositor and of `campaign.mint` | Pays the badge's exact amount to its depositor; closes the badge (rent to depositor); counters down. |

**Majority arithmetic** — strict head-count, exact integer form:
`votes × 2 > depositor_count`. Exactly half is NOT a majority. One badge =
one vote regardless of tier.

**Dissolution check** runs after every dissolve vote and after every
refund-crank bookkeeping pass. Once `dissolved` is set, nothing unsets it.

## Invariants the test suite enforces (escrow/tests/escrow.ts)

1. No withdraw exists on the program surface (asserted at the IDL level) and
   `refund` hard-fails on an active campaign (`DeadlineNotPassed`) — locked
   means locked.
2. Only ORGANIZER can `initialize_campaign` (front-run guard,
   `UnauthorizedInitializer`) and only the campaign admin can
   `propose_payout`.
3. Non-tier amounts are rejected; per-tier counters track deposits exactly.
4. `release` is impossible: with no proposal; at exactly half the votes; with
   a stale-epoch majority (re-proposal reset); to any destination not owned
   by the proposed address; after dissolution (even with a full payout
   majority standing); after the deadline (even with a majority standing at
   expiry — the audit-fix test proves this on-chain); after a prior release.
5. New deposits dilute a standing payout majority until the newcomer votes
   (majority is evaluated at execution time against CURRENT depositors).
6. Both votes are revocable while active; double-votes rejected; the badge
   persists through vote changes; voting with someone else's badge is
   rejected (seeds + has_one).
7. Refund-theft is impossible: cranking a refund toward any token account not
   owned by the badge's depositor is rejected; refund amounts are exact.
8. Dissolution opens refunds immediately (pre-deadline); after the deadline,
   proposals, payout votes and release are all rejected (`CampaignEnded`)
   and only the refund crank remains live.

## Deadline semantics — post-deadline is REFUNDS-ONLY

`release`, `vote_payout`, `propose_payout` and `deposit` are ALL
deadline-gated (`CampaignEnded`). A majority that stood at expiry but never
executed does not survive the timer: after the deadline the only live
instruction that moves money is the permissionless refund crank, returning
every deposit exactly. (This closes the pre-audit coexistence window where a
stale majority could still release after expiry.)

## Known property of head-count governance (disclosed)

Votes are one-per-badge and badges cost a minimum of $20, so an attacker
willing to spend can create many wallets, deposit $20 each, and vote
dissolve — a Sybil majority. The blast radius is DENIAL-OF-CAMPAIGN ONLY:
dissolution refunds every depositor exactly (the attacker included, minus
their transaction costs); no path exists by which Sybil votes move anyone
else's money anywhere. Capital-weighted voting was deliberately rejected to
keep "a counter of people" honest; the trade is disclosed here.

## Upgrade authority (disclosure)

The program is currently upgradeable by the organizer's key (the same
`ORGANIZER` above) — disclosed on the deposit page and in `agents.md`; the
plan of record is lock (multisig) or burn (`--final`) within a week of
mainnet launch. Verify the live authority yourself:
`solana program show <PROGRAM_ID> -u <cluster>`. While it exists, the
deployer can change the program; weigh that.

## What this program does NOT contain

No goal or funding threshold. No individual withdraw. No tier changes or
top-ups. No transferable token, no yield, no fees. No oracle. No admin path
to move, freeze, or redirect deposits. No instruction to sweep stray tokens
sent directly to the vault (don't do that — see
`escrow/ARCHITECTURE.md`, "Stray-transfer dust").
