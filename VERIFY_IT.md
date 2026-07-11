# Don't trust us. Ask your agent.

**What this is:** a community pool no person holds. You lock USDC ($20 / $100 / $1000, one deposit per wallet) toward a climbing wall at Network School. The money leaves your wallet — and stays locked. That's the point.

**The claims, all enforced by code:**

1. **Locked means locked.** The program contains no individual-withdraw instruction. Committing together is the product.
2. **Nobody custodies the pool** — not even the organizer.
3. **Money moves three ways, all collective:** depositor majority + an organizer-proposed address → funds the build; majority votes dissolve → everyone refunded; 90-day timeout → everyone refunded. Nothing else moves a cent.
4. **Neither side alone.** The organizer has no votes; depositors can't route funds to an address the organizer didn't propose; every new proposal resets consent to zero.
5. **Refunds are exact and permissionless** — once a refund path opens, anyone can trigger it; funds flow only to each depositor's own wallet.
6. **One badge, one vote, can't be bought** — welded to your depositing wallet; revocable while the campaign is active.

**Caveat:** the program is upgradeable by the organizer this week (disclosed; then locked or burned).

## Paste to your agent

```
Read https://github.com/Loringtonian/NS-climbing/blob/main/agents.md, SPEC.md,
and escrow/programs/ns-climb-escrow/src/lib.rs in that repo. Verify the six
claims in VERIFY_IT.md against the code, with line numbers — especially claim 1:
confirm no instruction pays an individual depositor while a campaign is active.
Confirm the deployed program matches the source (procedure in agents.md), check
who holds the upgrade authority, and replay the three published rehearsals in
REHEARSALS.md against the chain. Then tell me plainly: every way money can move,
who can trigger each — and would you lock in $20?
```

| Network | Status |
|---------|--------|
| Devnet  | LIVE (test money; three scenario rehearsals published in REHEARSALS.md) |
| Mainnet | Not yet — addresses land here at launch. Anyone taking real deposits before that isn't us. |
