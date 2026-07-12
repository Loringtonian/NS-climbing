# ROADMAP — Crypto Crowdfunding Rails for Network States

> Campaign #1: the NS climbing wall. Weekend of 2026-07-11 (hackathon build + live campaign).
> The product: community assurance pools — deposits lock into a vault no person holds; money
> moves only by collective outcome (fund / dissolve / timeout). "A petition where the
> signatures are money."

## Where we are (evening, day 1)

- [x] Contract v3.1 "locked pool" — tiered locked deposits ($20/$100/$1000), dissolve vote,
      dual-gate destination vote (organizer proposes, dollar-majority ratifies), ~6-month refunds-only
      deadline, soulbound Supporter Badges. Suite green vs the exact deployed binary.
- [x] Four adversarial audit passes; every required fix shipped (incl. the post-deadline
      refunds-only gate). See `SPEC.md` + `escrow/DEPLOY.md` for pins.
- [x] Clean devnet chain — program `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ`; its whole
      history = deploy + three published rehearsals + the demo campaign (`REHEARSALS.md`).
- [x] One-page experience live: raised-counter hero, live supporters strip, three tier cards,
      inline deposit flow + vote controls, expandables with copy-button agent prompt.
- [x] Agent legibility: `SPEC.md` (law) · `REHEARSALS.md` (proof) · `agents.md` (execution) ·
      `VERIFY_IT.md` (claims + paste-to-your-agent prompt).
- [x] Cheer board on MagicBlock Ephemeral Rollup (gasless, wallet-less) — live.
- [x] Costs page: committed 16×12 manual Lemur plan, sourced line items, $15k room contingency.
- [ ] **Organizer phone test** on the clean chain (deposit → vote → un-vote ceremony).
- [ ] **Mainnet launch** — organizer funds ~2.5 SOL deployer + runs the real-money smoke test
      (solo majority-of-one rehearsal of both collective exits), then the QR goes up.
- [ ] Demo video + hackathon submissions (Sunday): MagicBlock Luma · Superteam Earn ·
      live pitches (see `HACKATHON.md`).
- [ ] Post-launch (disclosed on-page): lock or burn the upgrade authority within the week.

## Task board

| Lane                                      | Owner   | Status |
|-------------------------------------------|---------|--------|
| Contract + chain + rehearsals             | agents  | DONE — awaiting final targeted audit confirmation |
| Phone test on clean chain                 | Lorin   | open — send Phantom (devnet-mode) address to get test funds |
| Mainnet SOL (~2.5, refundable rent)       | Lorin   | open — Kraken ready |
| Deposit-flow UI polish / extensions       | Blad    | open — start at `escrow/CLIENT.md`, reference `escrow/web/demo.html` |
| IG / X posts + GenAI wall-insert video    | Blad    | open — assets in `assets/`; see media notes below |
| In-person selling (QR + pitch)            | Lorin   | Sunday, post-launch |
| Demo video + submission package           | agents + Lorin | Sunday |
| Lemur formal quote (largest manual frame) | Lorin   | open — the #1 number that firms up `costs.html` |
| Nano-banana visual assets                 | parked  | after text is tight |

## Media lane notes (IG / X video)

- Concept: GenAI insert of the climbing wall into footage of the real space.
- Assets: `assets/` (hero, concept renders, lemur install refs, brand marks, poster v5).
- ⚠️ Before anything posts publicly: the campaign names Network School — the page is
  deliberately noindex/community-shared. Public promo needs a quick check against NS
  community guidelines; no footage of other residents without permission. NS community
  channels are the safe first targets.

## The trust model (what we sell)

In by choice, locked. Out only together: fund (majority + organizer on the same address) ·
dissolve (majority → everyone refunded) · timeout (~6 months → everyone refunded). No
custodian, exact permissionless refunds, unbuyable one-badge-one-vote. `VERIFY_IT.md` to
check us; `REHEARSALS.md` to watch all three endings happen on-chain.
