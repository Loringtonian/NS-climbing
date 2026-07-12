# SEND — Crypto Crowdfunding Rails for Network States

Campaign #1: a climbing wall at Network School. A petition where the signatures are money —
USDC deposits **locked** in a pool no person can quietly empty, behind a live on-chain counter.
No individual take-backs: money moves only by collective outcome, and votes are weighted by
dollars locked, not by wallet. A dollar-majority of depositors can dissolve the campaign
(everyone refunded); funds reach a build address only when the organizer proposes it AND a
dollar-majority of depositors ratifies that exact address; a 180-day timer refunds everyone
if neither happens. Each deposit doubles as a non-transferable Supporter Badge — the ballot,
weighted by your own locked amount.

**Live page:** https://loringtonian.github.io/NS-climbing/ — short: **https://tinyurl.com/sendclimbing**
**Cheer board:** https://loringtonian.github.io/NS-climbing/cheer.html — short: **https://tinyurl.com/sendcheer**

(Community-shared, noindex. The two short links are what goes on the QR / in the Discord thread.)

## Start here

| You want to…                        | Read                                       |
|-------------------------------------|--------------------------------------------|
| **Where we are + what's left**      | [`TOMORROW.md`](TOMORROW.md)               |
| See the plan + task board           | [`ROADMAP.md`](ROADMAP.md)                 |
| The contract, stated as law         | [`SPEC.md`](SPEC.md)                       |
| On-chain proof of all three endings | [`REHEARSALS.md`](REHEARSALS.md)           |
| Verify our claims with YOUR agent   | [`VERIFY_IT.md`](VERIFY_IT.md)             |
| Audit / execute as an agent         | [`agents.md`](agents.md)                   |
| Build on the deposit flow           | [`escrow/CLIENT.md`](escrow/CLIENT.md) — reference impl: [`escrow/web/demo.html`](escrow/web/demo.html) |
| Run the program + tests             | [`escrow/DEPLOY.md`](escrow/DEPLOY.md)     |
| What the wall costs                 | [`costs.html`](costs.html)                 |
| Hackathon context                   | [`HACKATHON.md`](HACKATHON.md)             |
| Images / brand assets               | [`assets/`](assets/)                       |
| Real-time cheer board (bonus)       | [`cheerboard/README.md`](cheerboard/README.md) |

## Status (2026-07-12 evening — MAINNET LIVE, MONEY IN)

- **Contract v4 (dollar-weighted) is LIVE on mainnet.** Program
  `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` · campaign `send-climbing` · PDA
  `B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd` · Circle USDC · deadline **2027-01-08**.
  Deployed + initialized 2026-07-12 ~02:50 UTC.
- **Upgrade authority BURNED** — verified on-chain (ProgramData authority = `none`). The code
  can never change. This was done before any deposit was taken, exactly as the site claims.
- **Pool: $120 USDC locked from 2 depositors** (1 × $20, 1 × $100) as of 2026-07-12 evening.
  Real money, real people, in the immutable contract. Read it off the chain yourself — the
  campaign PDA is above and every claim in [`VERIFY_IT.md`](VERIFY_IT.md) is checkable.
- **Deposits work two ways:**
  - **Solana wallet** (Solflare and friends) → deposit straight from the campaign page.
  - **Any chain / no wallet at all** → [`/anychain/`](https://loringtonian.github.io/NS-climbing/anychain/):
    log in with email, Privy mints you a self-custodial Solana wallet, gas is sponsored by our
    relayer, and the deposit lands in the same immutable escrow. **Proven live** with a real
    deposit. Design + rationale: [`CROSSCHAIN_DEPOSITS.md`](CROSSCHAIN_DEPOSITS.md).
- 19/19 tests green against the byte-reproducible binary (`facd1bb3…`, hash pinned in
  [`escrow/DEPLOY.md`](escrow/DEPLOY.md)); two adversarial audit passes closed.
- Devnet: clean chain, three published scenario rehearsals proving all three endings
  ([`REHEARSALS.md`](REHEARSALS.md)).
- Cheer board (MagicBlock Ephemeral Rollup): **25,032 gasless cheers from 30 people**, committed
  back to the base layer. Free, wallet-less, and the reason we knew anyone wanted this.

## The trust model, in one breath

In by choice, locked. Out only together, and votes are weighted by dollars deposited (not by
wallet): **fund** (a dollar-majority of depositors approves the organizer's exact proposed
address), **dissolve** (a dollar-majority votes no-confidence → everyone refunded), or
**timeout** (180 days → everyone refunded). Only the organizer can propose a destination and
no one can move funds anywhere but back to depositors without a dollar-majority — the one
disclosed trust is that the named organizer doesn't out-deposit the whole pool. Refunds are
exact and anyone can trigger them once open; one non-transferable badge per wallet, weight =
your own deposit. Verify every word: [`VERIFY_IT.md`](VERIFY_IT.md).

## Stack

Anchor (Rust) program on Solana · USDC (SPL) escrow · static front-end (raw wallet
providers, pinned config, no frameworks) on GitHub Pages · optional MagicBlock Ephemeral
Rollup cheer board.
