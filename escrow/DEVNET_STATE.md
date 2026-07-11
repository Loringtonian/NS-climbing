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
