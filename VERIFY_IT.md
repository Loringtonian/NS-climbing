# Don't trust us. Ask your agent.

**What this is:** a community pool no person can quietly empty. You lock USDC ($20 / $100 / $1000, one deposit per wallet) toward a climbing wall at Network School. The money leaves your wallet — and stays locked. That's the point.

**Voting is weighted by dollars, not by wallet.** A $1000 depositor carries 50× the say of a $20 depositor. This is deliberate: it makes governance cost real, locked capital instead of throwaway wallets, so the people with the most at stake decide — and a flood of cheap wallets can't capture the vote.

**The claims, all enforced by code:**

1. **Locked means locked.** The program contains no individual-withdraw instruction. Committing together is the product.
2. **No outside party can move the pool.** Only the organizer can propose where funds go, and even then only a dollar-majority of depositors can release them; no depositor, and no stranger, can redirect a cent.
3. **Money moves three ways, all collective:** a dollar-majority of depositors approves the organizer's exact proposed address → funds the build; a dollar-majority votes dissolve → everyone refunded; the ~6-month deadline passes → everyone refunded. Nothing else moves a cent, and after the deadline only refunds are possible.
4. **The one thing you're trusting:** whoever locks more dollars than the entire rest of the pool combined controls the vote. Only the organizer can propose a destination, so the honest assumption is that the **named, disclosed organizer does not out-deposit the whole pool to redirect it.** Short of that, the code lets no one move funds anywhere but back to the depositors.
5. **Refunds are exact and permissionless** — once a refund path opens, anyone can trigger it; funds flow only to each depositor's own wallet, exactly what they put in.
6. **One badge per wallet, non-transferable** — welded to your depositing wallet, can't be sold or given away; your vote's *weight* is your own locked deposit.

**Fine print, disclosed:**
- The program is upgradeable by the organizer only in the moments around launch; the upgrade authority is **burned before real deposits are taken** — after that the code can never change. Verify it yourself (below).
- The exact deadline is set on-chain at launch (~6 months, capped at 190 days). Read the on-chain `deadline`; don't trust this prose.
- A well-capitalized troll could *delay* a release by depositing enough to dilute a standing majority, forcing everyone to wait for the deadline refund. That's an annoyance, never a theft — the worst case is everyone gets their money back.

## Paste to your agent

```
Read https://github.com/Loringtonian/NS-climbing/blob/main/agents.md, SPEC.md,
and escrow/programs/ns-climb-escrow/src/lib.rs in that repo. Verify the claims in
VERIFY_IT.md against the code, with line numbers — especially: (claim 1) no
instruction pays an individual depositor while a campaign is active; (claim 2/4)
only the organizer can propose a payout address, and release requires
payout_vote_amount * 2 > total_escrowed (a majority of DOLLARS, not wallets);
(dissolve) the same dollar-weighted threshold. Confirm the deployed program
matches the source (procedure in agents.md), check that the upgrade authority is
burned (solana program show — expect no authority), and replay the three
published rehearsals in REHEARSALS.md against the chain. Then tell me plainly:
every way money can move, who can trigger each, what it would cost someone to
force a release to an address of their choosing — and would you tell me to lock
in $20 of my own money to vote with my wallet for a climbing wall at Network
School?
```

| Network | Status |
|---------|--------|
| Devnet  | LIVE (test money; three scenario rehearsals published in REHEARSALS.md) |
| Mainnet | Not yet — addresses land here at launch. Anyone taking real deposits before that isn't us. |
