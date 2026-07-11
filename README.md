# SEND — Crypto Crowdfunding Rails for Network States

Campaign #1: a climbing wall at Network School. A petition where the signatures are money —
refundable USDC escrow deposits behind a live on-chain counter. Withdraw anytime; a depositor majority can dissolve the campaign (each deposit doubles as a non-transferable Supporter Badge = the ballot); funds only
release if the goal is met AND the space is greenlit. No custodian: the contract holds the vault.

**Live page:** https://loringtonian.github.io/NS-climbing/ (community-shared, noindex)

## Start here

| You want to…                       | Read                                       |
|------------------------------------|--------------------------------------------|
| See the plan + task board          | [`ROADMAP.md`](ROADMAP.md)                 |
| Build on the deposit flow          | [`escrow/CLIENT.md`](escrow/CLIENT.md) — reference impl: [`escrow/web/demo.html`](escrow/web/demo.html) |
| Audit the contract (human or agent)| [`agents.md`](agents.md)                   |
| Verify our claims with YOUR agent  | [`VERIFY_IT.md`](VERIFY_IT.md)             |
| Run the program + tests            | [`escrow/DEPLOY.md`](escrow/DEPLOY.md)     |
| Grab images / brand assets         | [`assets/`](assets/)                       |
| The real-time cheer board (bonus)  | [`cheerboard/README.md`](cheerboard/README.md) |

## Status (2026-07-11, hackathon weekend)

- Escrow program: built, 18/18 tests green on localnet, tiered deposits LIVE in the contract ($20/$100/$1000, exact-amount withdraw, per-tier counter).
- Phone deposit ceremony: built (QR → Phantom/Solflare in-app browser → deposit → live counter → withdraw).
- Mainnet deploy: pending SOL funding — imminent. Until then the page runs in read-only/preview.

## Stack

Anchor (Rust) program on Solana · USDC (SPL) escrow · static web front-end (no framework, raw
wallet providers) on GitHub Pages · optional MagicBlock Ephemeral Rollup cheer board.

## Trust properties

1. Withdraw anytime before release — unconditional.
2. Release needs goal + approval co-sign; neither alone moves funds.
3. Past deadline, refunds are permissionless.
4. Verify all of it yourself: `agents.md` has the byte-for-byte build-verification procedure.
