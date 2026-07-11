# SEND — Crypto Crowdfunding Rails for Network States

Campaign #1: a climbing wall at Network School. A petition where the signatures are money —
USDC deposits **locked** in a pool no person holds, behind a live on-chain counter. No
individual take-backs: money moves only by collective outcome. A depositor majority can
dissolve the campaign (everyone refunded); funds reach a build address only when the
organizer proposes it AND a majority of depositors ratifies that exact address; a 90-day
timer refunds everyone if neither happens. Each deposit doubles as a non-transferable
Supporter Badge — the ballot.

**Live page:** https://loringtonian.github.io/NS-climbing/ (community-shared, noindex)

## Start here

| You want to…                        | Read                                       |
|-------------------------------------|--------------------------------------------|
| **Launch day checklist**            | [`TOMORROW.md`](TOMORROW.md)               |
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

## Status (2026-07-11 evening, hackathon weekend)

- Contract v3.1 ("locked pool"): live on devnet, program `42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD`
  — a clean chain whose entire history is the deploy, three published scenario rehearsals,
  and the demo campaign. Binary is byte-reproducible from source (hash pinned in
  [`escrow/DEPLOY.md`](escrow/DEPLOY.md)).
- Independently reviewed by an adversarial AI auditor; the shipped source reflects its
  findings in full.
- Test suite green against the exact deployed binary.
- Mainnet: launches on the organizer's go after a real-money smoke test. Addresses will be
  pinned in `VERIFY_IT.md` and `agents.md` at launch — anyone taking real deposits before
  that isn't us.

## The trust model, in one breath

In by choice, locked. Out only together: **fund** (majority + organizer agree on the same
address), **dissolve** (majority votes no-confidence → everyone refunded), or **timeout**
(90 days → everyone refunded). Nobody custodies the pool; refunds are exact and anyone can
trigger them once open; one badge one vote, welded to the depositing wallet. Verify every
word: [`VERIFY_IT.md`](VERIFY_IT.md).

## Stack

Anchor (Rust) program on Solana · USDC (SPL) escrow · static front-end (raw wallet
providers, pinned config, no frameworks) on GitHub Pages · optional MagicBlock Ephemeral
Rollup cheer board.
