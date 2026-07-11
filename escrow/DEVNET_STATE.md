# Devnet deployment state (2026-07-11)

| What         | Value |
|--------------|-------|
| Program      | 7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw |
| Campaign ID  | ns-climbing-wall-v2 (v1 campaign retired at the v2 layout upgrade) |
| Campaign PDA | 4e9dSFwGj9MNniuaCCDRoor8gGN7xUfaffUnuPcuTic5 |
| Demo mint    | 4k4aakX2MycnKcw6Urvurjxvn4WCYimFPhG3UDBGiZMD (we control minting — fund a phone wallet: `bash scripts/fund_phone.sh <address>`) |
| Buildout     | 84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2 (deployer; devnet rehearsal only) |
| Goal         | 2000 USDC (rehearsal number — real goal is Lorin's call) |
| Deposit page | https://loringtonian.github.io/NS-climbing/escrow/web/demo.html (config hardcoded in-page — audit fix; params page: devnet.html) |
| Explorer (program)  | https://explorer.solana.com/address/7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw?cluster=devnet |
| Explorer (campaign) | https://explorer.solana.com/address/4e9dSFwGj9MNniuaCCDRoor8gGN7xUfaffUnuPcuTic5?cluster=devnet |
| Explorer (vault)    | https://explorer.solana.com/address/SEmCbggXwdT9pmNYePLqTRRirjwRKobUBU3YtohzWQv?cluster=devnet |

Program upgraded IN PLACE 2026-07-11 to the v2+audit binary (sha 5f2c7dd6…, 303,504 B). Deadline: 90 days from v2 init.
Rehearsal: $20 deposit -> withdraw -> $100 deposit via scripts/demo_flow.ts
(result recorded in session log).

PHONE URL (QR this): https://loringtonian.github.io/NS-climbing/escrow/web/demo.html

## Cheer board (devnet, MagicBlock ER router) — 2026-07-11

| What          | Value |
|---------------|-------|
| Program       | FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz |
| Board PDA     | 4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C (delegated to the devnet ER) |
| Phone page    | https://loringtonian.github.io/NS-climbing/cheerboard/web/cheer.html?board=4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C&rpc=https%3A%2F%2Fdevnet-router.magicblock.app |
| Projector     | https://loringtonian.github.io/NS-climbing/cheerboard/web/tally.html?board=4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C&rpc=https%3A%2F%2Fdevnet-router.magicblock.app |
| Explorer (program) | https://explorer.solana.com/address/FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz?cluster=devnet |
| Explorer (board)   | https://explorer.solana.com/address/4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C?cluster=devnet |

End a session (undelegate -> tally commits to base): `node scripts/end_board.cjs` from cheerboard/.

## Freeze-protocol rehearsal record (2026-07-11, frozen artifact 5f2c7dd6…)

On-chain program dump verified byte-identical to the frozen artifact.

Live campaign ns-climbing-wall-v2 (the phone-test target), all with live signatures:
deposit $20 (demo2, 4rV3XbyB…) → vote_dissolve (1 of 2, no flip — strict majority holds, 4bGdZ6Ct…)
→ unvote (2iXumEbH…) → withdraw exact $20 (2aUzZDo8…) → re-deposit $20 (4RWFtt68…).
Standing state: 2 depositors, $120 escrowed (1 × V1 + 1 × V5).

Majority-dissolve + refund-crank demo on scratch campaign ns-wall-dissolve-demo
(PDA Gb88RkuKTuvj65Aa8pmzEBFPDRGeSc2UPU1zH8f3sc2):
2 × $20 deposits → vote 1/2 (dissolved: false — strictness live) → vote 2/2
(dissolved: TRUE, 3XVb8TTq…) → refund crank by the organizer wallet returned both
$20s BEFORE any deadline (2LHhvMBe…, ZSxQVsod…) → final: 0 depositors, 0 escrowed,
dissolved: true (terminal).
Explorer: https://explorer.solana.com/address/Gb88RkuKTuvj65Aa8pmzEBFPDRGeSc2UPU1zH8f3sc2?cluster=devnet

## v1 campaign retirement note (2026-07-11)

The pre-v2 campaign (`ns-climbing-wall`, PDA DSfvk5Dv…) still holds its $100
rehearsal deposit, but it is UNREACHABLE by design: its accounts use the v1
layout, and the upgraded program rejects them (verified live:
`AccountDidNotDeserialize` on the withdraw attempt). The tokens are worthless
demo-mint units (we control the mint); stranded value is ~0.006 devnet SOL of
rent. No page references the v1 campaign anymore — the main page and deposit
page both pin ns-climbing-wall-v2 via hardcoded ESCROW_CONFIG. Lesson banked
for mainnet: NEVER change account layouts under a live campaign; deploy new
program logic only between campaigns (mainnet launches directly on v2, so no
migration exposure).

## v3 campaign — GOAL RAISED TO $5,000 (Lorin, 2026-07-11)

| What         | Value |
|--------------|-------|
| Campaign ID  | ns-climbing-wall-v3 (v2 superseded — goal change requires a fresh campaign; goal is immutable) |
| Campaign PDA | BKoWqUPTHqqFvPNvumZBQEVxcgFPXm6npVicutLxvDy6 |
| Vault PDA    | AJadtMR4kuQVtsvL89bhdXtgNnhMgXcvkp4iM6qdpvfX |
| Goal         | 5,000 USDC · 90 days |
| Seeded       | $100 (demo1) + $20 (demo2) = $120, 2 depositors |
| Explorer     | https://explorer.solana.com/address/BKoWqUPTHqqFvPNvumZBQEVxcgFPXm6npVicutLxvDy6?cluster=devnet |

All pages point at v3 (hardcoded ESCROW_CONFIG). The v2 campaign still parses
under the deployed binary (same layout) — its two $-deposits can be withdrawn by
the demo wallets any time; not blocking anything.

## v4 campaign — v3 PROGRAM (dual-gate destination vote), 2026-07-11

Devnet upgraded IN PLACE to the frozen v3 artifact — on-chain dump trimmed to
310,120 bytes hashes to exactly 1527b07f21a1907f83bcedddefb350115a29c1f1ca0598d92b7d5a9879cd17ae.

| What         | Value |
|--------------|-------|
| Campaign ID  | ns-climbing-wall-v4 (phone-test target; v3 campaign superseded by the layout change) |
| Campaign PDA | 4qbSon25ofENbATDhrm44v1Qu6hoxSQMzwj74AtjcGvi |
| Vault PDA    | 5duUDxfefksW7Eki7FVioq5MXbBar6C4MrRTBJK9MHCb |
| Mode         | raise-max: NO goal, NO fixed destination — dual-gate payout vote |
| Seeded       | $100 (demo1) + $20 (demo2) = $120, 2 depositors |
| Explorer     | https://explorer.solana.com/address/4qbSon25ofENbATDhrm44v1Qu6hoxSQMzwj74AtjcGvi?cluster=devnet |

### VICTORY rehearsal (scratch campaign ns-wall-victory, live signatures)

deposits $100+$20 (2SGfZL1y…, 57WTQj7U…) → propose_payout DEUJCsLb… (4oYkL1WD…,
epoch 1, votes reset 0) → vote 1/2 (36Hb2biG… — release impossible at half) →
vote 2/2 strict majority (3rhNBUZA…) → PERMISSIONLESS release (5jVhKvzh…) →
**120 USDC landed at exactly the proposed address's ATA**
(9UZrd6RTSV2TZh9RzrUjKHno43yVG83xvGVoFR47KXCQ).
Explorer: https://explorer.solana.com/address/9UZrd6RTSV2TZh9RzrUjKHno43yVG83xvGVoFR47KXCQ?cluster=devnet
