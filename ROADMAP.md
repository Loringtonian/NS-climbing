# ROADMAP — Crypto Crowdfunding Rails for Network States

> Campaign #1: the NS climbing wall. Weekend of 2026-07-11 (hackathon build + live campaign).
> The product: community assurance pools — deposits lock into a vault no person holds; money
> moves only by collective outcome (fund / dissolve / timeout). "A petition where the
> signatures are money."

## Where we are (day 2, midday — MAINNET IS LIVE)

- [x] Contract v4 "dollar-weighted locked pool" — tiered locked deposits ($20/$100/$1000),
      dissolve vote, dual-gate destination vote (organizer proposes, dollar-majority ratifies),
      180-day refunds-only deadline, soulbound Supporter Badges. Votes weigh dollars, not wallets.
      19/19 green vs the exact deployed binary.
- [x] Adversarial audit passes (four on v3.1, two on v4); every required fix shipped.
      See `SPEC.md` + `escrow/DEPLOY.md` for pins.
- [x] Clean devnet chain + three published rehearsals proving all three endings (`REHEARSALS.md`).
- [x] One-page experience live: raised-counter hero, live supporters strip, three tier cards,
      inline deposit flow + vote controls, expandables with copy-button agent prompt.
- [x] Agent legibility: `SPEC.md` (law) · `REHEARSALS.md` (proof) · `agents.md` (execution) ·
      `VERIFY_IT.md` (claims + paste-to-your-agent prompt).
- [x] Cheer board on MagicBlock Ephemeral Rollup (gasless, wallet-less) — live.
- [x] Costs page: committed 16×12 manual Lemur plan, sourced line items, $15k room contingency.
- [x] **MAINNET LAUNCHED (2026-07-12 ~02:50 UTC)** — audited binary deployed, `send-climbing`
      campaign initialized (deadline 2027-01-08), site flipped to mainnet + Circle USDC.
- [x] **Upgrade authority BURNED** — verified on-chain (`Authority: none`). Code is now immutable.
- [x] Shortlinks minted: **tinyurl.com/sendclimbing** (campaign) · **tinyurl.com/sendcheer** (cheer board).
- [x] **FIRST REAL DEPOSITS — done.** Pool holds **$120 from 2 depositors** (1 × $20, 1 × $100).
      Phantom was the blocker (its Blowfish simulator couldn't preview a brand-new program fast
      enough); Solflare previews it fine, and the any-chain path bypasses browser wallets entirely.
- [x] **ANY-CHAIN / NO-WALLET DEPOSITS — built and proven live.** Email login → Privy embedded
      self-custodial Solana wallet → relayer-sponsored gas → deposit into the *same immutable*
      escrow. Staged at `/anychain/`; relayer on Fly (`ns-climbing-relayer.fly.dev`, `/health` 200).
      The contract was never touched — it can't be. See `CROSSCHAIN_DEPOSITS.md`.
- [ ] **Fold any-chain into the main deposit page** — retire the `/anychain/` stub so "email /
      any chain" is just an option on the campaign page, and add a bridge widget for funding.
- [ ] **Campaign video** — 22 NS residents filmed ("I want a climbing wall"); three renders cut
      (`video/out/`: mosaic chorus · relay · halves). Pick one, finish, ship.
- [ ] Hackathon submissions (today): MagicBlock Luma · live pitches (`HACKATHON.md`).
      Superteam dropped — the TxODDS listing requires TxLINE sports data, which we don't use.

## Task board

| Lane                                      | Owner   | Status |
|-------------------------------------------|---------|--------|
| Contract + chain + rehearsals             | agents  | DONE — audits closed, tests green |
| Mainnet deploy + burn upgrade authority   | agents  | DONE 2026-07-12 — verified on-chain |
| Shortlinks (QR targets)                   | agents  | DONE — `tinyurl.com/sendclimbing` · `tinyurl.com/sendcheer` |
| First successful mainnet deposit           | Lorin   | DONE — $120 locked from 2 depositors |
| Any-chain / no-wallet deposit (Privy)     | agents  | DONE — proven live at `/anychain/`; fold into the main page next |
| Campaign video (22 residents, 3 cuts)     | agents + Lorin | open — pick the cut, finish, ship (`video/out/`) |
| Hackathon submissions                     | agents + Lorin | open — TODAY (MagicBlock Luma · Superteam Earn) |
| In-person selling (QR + pitch)            | Lorin   | gated on the first deposit landing |
| IG / X posts + GenAI wall-insert video    | Blad    | open — assets in `assets/`; see media notes below |
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
dissolve (majority → everyone refunded) · timeout (180 days → everyone refunded). No
custodian, exact permissionless refunds, unbuyable one-badge-one-vote. `VERIFY_IT.md` to
check us; `REHEARSALS.md` to watch all three endings happen on-chain.
