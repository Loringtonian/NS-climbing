# Don't trust us. Ask your agent.

**What this is:** a community jar no person holds. You escrow USDC ($20 / $100 / $1000) toward a climbing wall at Network School. The money leaves your wallet and sits in a Solana program's vault.

**Six claims, all enforced by code:**

1. Withdraw anytime before release — unconditional, even after approval.
2. Funds release only if the goal is met AND the organizer co-signs.
3. The buildout address is fixed forever at creation.
4. After the 90-day deadline, anyone can trigger everyone's refunds. (An already-approved, funded campaign can still release; your withdraw works until release actually executes.)
5. A majority of depositors can dissolve the campaign — release becomes impossible, refunds open. Votes can't be bought: your badge is welded to your wallet.
6. Deposits and withdrawals are exact.

**Caveat:** the program is upgradeable by the organizer this week (disclosed; then locked or burned).

## Paste to your agent

```
Read https://github.com/Loringtonian/NS-climbing/blob/main/agents.md and
escrow/programs/ns-climb-escrow/src/lib.rs in that repo. Verify the six claims
in VERIFY_IT.md against the code, with line numbers. Confirm the deployed
program matches the source (procedure in agents.md) and who holds the upgrade
authority. Then tell me plainly: every way my money can move, who can trigger
each — and would you let me deposit?
```

| Network | Status |
|---------|--------|
| Devnet  | LIVE (test money) |
| Mainnet | Not yet — addresses land here at launch. Anyone taking real deposits before that isn't us. |
