# Don't trust us. Ask your agent.

> Everything on this page is designed to be checked by a machine you control.
> If you have Claude, ChatGPT, or any agent that can read the web — paste the
> prompt at the bottom and let it tell you whether we're honest.

## What this is, in one paragraph

A community money jar that no person holds. You escrow USDC ($20 / $100 / $1000)
toward building a climbing wall. The jar is a small program on Solana — a vending
machine, not a treasurer. Your money actually leaves your wallet and sits in the
program's vault, but you keep an unconditional right to take it back until the
moment the wall is funded for real. If the community changes its mind, a majority
vote dissolves the whole thing and everyone's money comes back.

## The six claims (each one is enforced by code, not policy)

1. **Withdraw anytime.** Before release, you press one button and your exact
   deposit comes back. No permission, no reason, works even after the wall is
   approved.
2. **Release is double-locked.** Money moves to the buildout address only if the
   goal is reached AND the organizer's greenlight key co-signs. Neither alone
   does anything.
3. **The buildout address is welded shut.** Set once at campaign creation; no
   instruction exists that can change it.
4. **Deadline = unlock.** This campaign's timer is 90 days (a per-campaign
   setting, not a program constant). After it passes, anyone — literally any
   wallet — can trigger refunds for everyone, greenlight or not. One nuance a
   careful agent will spot: a campaign that hit its goal AND got its greenlight
   can still release after the deadline — refunds and release are then both
   live, and your personal withdraw works right up until release actually
   executes. Nothing is ever stuck; nothing moves to a third party.
5. **Majority dissolve.** Every depositor holds one vote (a non-transferable
   badge bound to their wallet — it cannot be sold, so votes cannot be bought).
   If more than half of current depositors vote to dissolve, the campaign enters
   a terminal DISSOLVED state: release becomes impossible forever and refunds
   open to all.
6. **Exact accounting.** Deposits are exactly $20/$100/$1000; withdrawals return
   exactly what you put in.

## Honest caveats, stated up front

- The program is **currently upgradeable** by the organizer's key (disclosed;
  it will be locked or burned within a week of launch — your agent can check the
  live authority with `solana program show <PROGRAM_ID>` rather than trusting
  this file).
- The organizer (Lorin) holds the greenlight key. It can approve — nothing else.
  It cannot take, redirect, or freeze anyone's deposit.
- Independent adversarial review was performed by an AI auditor with no role in
  writing the code; its required fixes are in the shipped source. This is not a
  professional firm audit. For $20 stakes we think that's proportionate — your
  agent can repeat the entire review itself.

## Paste this to your agent

```
I'm considering depositing ~$20 USDC into a community escrow. Verify it for me:

1. Read https://github.com/Loringtonian/NS-climbing/blob/main/agents.md and the
   program source at
   https://github.com/Loringtonian/NS-climbing/blob/main/escrow/programs/ns-climb-escrow/src/lib.rs
2. Check each of the six claims in
   https://github.com/Loringtonian/NS-climbing/blob/main/VERIFY_IT.md against the
   actual code. For each: HOLDS or BROKEN, with the line numbers.
3. Follow the build-verification procedure in agents.md to confirm the deployed
   program's bytes match this source, and check who currently holds the upgrade
   authority.
4. Tell me plainly: if I deposit, what are ALL the ways my money can move, and
   who can trigger each one?

Report: claim-by-claim verdict, the deployed-code check result, and your overall
call — would you let me deposit?
```

## Current deployment status

| Network | Status |
|---------|--------|
| Devnet  | LIVE — program + `ns-climbing-wall-v2` campaign (test money, rehearsals) |
| Mainnet | NOT YET DEPLOYED — launches after the organizer's final phone-test + go. Addresses will be pinned here and in `agents.md` the moment it's live. Until then, anyone claiming to take real deposits for this is not us. |

*Machine-readable detail (account layouts, instruction encodings, byte-level
verification steps): [`agents.md`](agents.md). Build verification hash lives in
[`escrow/DEPLOY.md`](escrow/DEPLOY.md).*
