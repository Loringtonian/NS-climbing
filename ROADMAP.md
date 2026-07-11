# ROADMAP — Crypto Crowdfunding Rails for Network States

> Campaign #1: the NS climbing wall. Weekend of 2026-07-11 (hackathon build + live campaign).
> The product: community assurance contracts — refundable escrow deposits, goal + approval
> gate, live on-chain counter. Petitions say "we want it"; escrow says "we priced it."

## Where we are

- [x] Escrow contract — deposit / withdraw-anytime / goal+approval release gate / deadline refund crank (15/15 tests)
- [x] Live counter + phone deposit ceremony (QR → Phantom/Solflare → escrow → badge → withdraw)
- [x] Agentic sign-up — `agents.md` + `llms.txt`: any agent can audit the contract and execute a deposit
- [x] Cheer board (bonus) — gasless real-time tally on a MagicBlock Ephemeral Rollup, no wallet needed
- [ ] **Tiered deposits $20 / $100 / $1000** — contract + 3-button UI (in progress)
- [ ] **Devnet deploy + full rehearsal** — blocked on devnet SOL; then `escrow/scripts/devnet_go.sh` (~20 min)
- [ ] Real-phone tap-through of the ceremony (needs a human + Phantom, ~15 min)
- [ ] **Mainnet deploy** — needs ~2.1 real SOL (refundable rent deposit); then real $20s flow
- [ ] Demo video + hackathon submission (Sunday)

## Task board

| Lane                                   | Owner        | Status |
|----------------------------------------|--------------|--------|
| Contract tier change (20/100/1000)     | build agent  | in progress |
| Devnet SOL (hackathon Telegram ask)    | Lorin        | open   |
| Mainnet SOL (~2.1, borrow/bank)        | Lorin        | open   |
| Deposit-flow UI polish + extensions    | Blad         | open — start from `escrow/CLIENT.md`, reference impl `escrow/web/demo.html` |
| IG / X posts + GenAI wall-insert video | Blad         | open — see media notes below |
| Tier perks final copy                  | Lorin review | drafted |
| In-person selling (QR + pitch)         | Lorin        | ongoing all weekend |
| Demo video + submission package        | build agent + Lorin | Sunday |

## Media lane notes (IG / X video)

- Concept: GenAI insert of the climbing wall into footage of the real space — show the room
  as it is, then the wall in it.
- Assets to build from: `assets/` (concept renders `gym_concept_v0.png`, `board_render_v0.png`,
  lemur install refs, brand marks, current poster `phone_poster_v5.png`).
- ⚠️ **Before anything posts publicly**: this campaign names Network School. The existing page
  is deliberately noindex/community-shared-only. Public IG/X promo needs a quick check against
  NS community/speech guidelines (and no footage of other residents without permission).
  Community channels (NS Discord/Telegram) are safe first targets.

## Trust properties (the pitch, verifiable in code)

1. Withdraw anytime before release — unconditional, even after admin approval.
2. Release requires goal met AND approval co-sign. Neither alone moves funds.
3. Deadline passes → refund crank is permissionless.
4. No custodian — the program holds the vault; nobody's multisig.
5. Audit it yourself or have your agent do it: see `agents.md`.
