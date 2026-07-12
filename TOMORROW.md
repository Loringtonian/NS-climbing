# SHOWTIME — post-launch state · v4 dollar-weighted

> Cold-start doc. Everything needed to finish this is here — no prior session context required.
> **Mainnet went live 2026-07-12 (~02:50 UTC / 10:50 +08): audited binary deployed, campaign
> initialized, upgrade authority BURNED, site flipped to mainnet + Circle USDC.** The contract
> is now immutable and the rail is open.
>
> **FIRST DEPOSIT LANDED 2026-07-12 ~13:10 +08 via Solflare — $100 / 1 depositor.**
> The blocker is solved: Solflare's simulator previews the new program fast where
> Phantom's Blowfish hangs. The plain link now defaults to Solflare. Pool is live.
>
> **ANY-CHAIN / PRIVY DEPOSIT PROVEN LIVE 2026-07-12 ~17:47 +08 — $120 / 2 depositors.**
> Email login → Privy embedded Solana wallet → USDC → deposit into the immutable escrow,
> relayer-sponsored gas, no browser wallet / no SOL. Staging: `/anychain/` on the site
> (branch `privy-crosschain`); relayer on Fly (`ns-climbing-relayer.fly.dev`). Full write-up
> + hard-won gotchas + the port-to-main plan: **`privy/README.md`** (§ STATUS — PROVEN LIVE).
> NEXT: fold the "email / any chain" option into the main deposit page (retire the stub),
> add an in-app bridge widget for funding, bring the confetti along.

---

## THE ADDRESSES (everything in one place)

| What | Value |
|---|---|
| **Live campaign page** | https://loringtonian.github.io/NS-climbing/ → **https://tinyurl.com/sendclimbing** |
| **Cheer board** | https://loringtonian.github.io/NS-climbing/cheer.html → **https://tinyurl.com/sendcheer** |
| **Program ID** (mainnet + devnet, same) | `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` |
| **Upgrade authority** | **BURNED** — `solana program show … -u mainnet-beta` → `Authority: none` |
| **Campaign PDA** (mainnet, LIVE) | `B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd` |
| Campaign ID (string) | `send-climbing` · deadline **2027-01-08** (180 days, capped in code) |
| **Circle USDC (mainnet mint)** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Deployer / organizer key | `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` (0.24 SOL left; 2.23 is refundable program rent) |
| Audited binary sha256 | `facd1bb3b9e6a1f2d9041a2d81c48d904f3ac392cc16211bae482e9d2b190fa5` (296,544 B) |
| Program keypair file (local, gitignored) | `escrow/target/deploy/ns_climb_escrow-keypair.json` |
| Cheer board PDA (devnet ER, live) | `4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C` |
| Live RPC (browser) | `https://solana-rpc.publicnode.com` — `api.mainnet-beta` 403s browsers |
| Discord thread | NS Discord → `#discussion` → `send-climbing` |

---

## ① BLOCKER RESOLVED — Solflare works, and the flow now supports many wallets

**FIXED 2026-07-12 ~13:10 +08.** First real mainnet deposit ($100) landed via **Solflare**.
The root cause below was Phantom-specific; Solflare's simulator previews the new program
fast. The site now defaults to Solflare and supports a broad wallet set, Phantom last.

**Wallet support shipped (commits `bc2fae2`, `9ee679f`, `b455a06`, `ba2c1d8`):**
- **Desktop auto-detect** (order = preference, **Phantom strictly last** because its Blowfish
  sim hangs on a new program): Solflare → Backpack → Coinbase → OKX → Trust → Glow → Brave →
  (generic `window.solana`) → Phantom. All expose Phantom-compatible `connect()`/
  `signTransaction()`, the only API this page uses (we self-broadcast), so wallets lacking
  `signAndSendTransaction` (Coinbase, Trust) still work.
- **`?w=<name>` override** pins one wallet when several extensions are installed (e.g.
  `…/?w=solflare`) — handy for testing or for linking. It never changes what's signed.
- **Mobile** (phones have no extensions → open the page inside the wallet's in-app browser):
  verified universal "browse" deep-links for Solflare, Backpack, Coinbase, OKX, Trust, Phantom
  (each format taken from that wallet's own docs). Picker is Solflare-first / Phantom-last.
- **Late-injection poll**: some wallets (Solflare) inject their provider a beat after our
  script runs; the page now polls ~6s and flips to the Connect UI when a wallet appears
  (previously it concluded "no wallet" and showed only the mobile buttons).
- **Deposit celebration**: confetti burst + "🎉 You're in!" + a link to the tx on Solana
  Explorer + a badge pulse (commit `8497da2`).

**VERIFIED headless (Chromium):** live page loads with zero JS errors; mobile-responsive at
390px; all 6 wallet buttons render (Phantom last); every deep-link builds to its exact
doc-verified format (incl. OKX double-encode + Trust `coin_id=501`).
**NOT yet verified — needs a real-device spot-check before a hard push:** actual signing on
each wallet on a real phone (the code path is identical to the proven Solflare-desktop path,
and the deep-links are doc-verified, but per-wallet-per-phone e2e wasn't run), and
Firefox/Safari desktop with real extensions.

**Legacy detail (Phantom root cause — kept for reference):**
Phantom's transaction preview runs server-side via Blowfish, and
Blowfish **can't simulate our brand-new program fast enough** — the Confirm screen hangs
**3–5+ minutes**, often blank/no details, before you can approve. This is NOT our code. It
warms up over hours/days as Blowfish recognizes the program (server-side, so it improves for
ALL users, not per-wallet), and the review submission below accelerates it network-wide.
When it *does* finish simulating, the screen is clean: real preview (−$X USDC), only a mild
yellow "this domain is new" caution (not "malicious"), Confirm enabled. Verified via a direct
`simulateTransaction` against mainnet from our side: the deposit tx succeeds (`err: null`) — so
the tx is valid; Phantom is just slow to preview it.

**Deposit-UX commits this session (all pushed):**
- `93b50eb` — RPC → `https://solana-rpc.publicnode.com` (`api.mainnet-beta` 403s browsers)
- `a53ebd3` — `signTransaction` + self-broadcast `{skipPreflight:true}`, NOT
  `signAndSendTransaction` (which needs a *completed* simulation to enable Confirm → hangs
  blank on a new program). Note: skipPreflight means a bad tx broadcasts and fails on-chain
  rather than erroring in the wallet — a silent failure looks like "nothing happened."
- `34dfa88` — blockhash pre-warmed (refreshed every 20s) so the click→sign path has no RPC
  await; removes our delay and keeps the user-gesture context so Phantom auto-opens.
- `4bb724e` — spinner on busy states + `console.error` on failure for diagnosability.

**Next steps to make the web flow usable (in order):**
1. **Submit Phantom's domain/program review** — warms Blowfish network-wide, kills the "new
   domain" note, speeds simulation:
   https://docs.google.com/forms/d/1JgIxdmolgh_80xMfQKBKx9-QPC7LRdN6LHpFFW8BlKM/viewform
   (have ready: program `2PAg6iM…`, repo, one-line description). Community reports ~1–2 days.
2. **Test Solflare / Backpack** — different simulator than Phantom's Blowfish; may be
   near-instant on the new program and give a working web flow sooner.
3. **Just wait** — Blowfish warms up server-side on its own over the next hours.

**Guaranteed traction without the wallet UI (not yet done — Lorin wanted to test the real flow):**
founder sends USDC to a keypair we control → we submit the `deposit` tx directly via CLI (no
Phantom, no simulation). Real on-chain deposit, real counter movement. Deployer `84PE7wqG…`
has gas (~0.24 SOL) but 0 USDC; fund it (or a fresh keypair) with USDC and run a deposit tx.

**UPDATE 2026-07-12 ~13:30: the Solflare rail works** end-to-end (desktop + mobile in-app
browser) and supports a broad wallet set. It's fine for demos, the founder seed, and any
willing crypto user (steer them to Solflare; Phantom-only users hit the slow sim until Blowfish
warms up).

**DECISION 2026-07-12 ~14:10 (Lorin): HOLD the broad public deposit launch until any-chain
support is ready.** Lorin doesn't want to "really launch" asking everyone to deposit while a big
chunk of the crowd (EVM-only) can't participate — cross-chain/Privy is a proper build, not a
rush job (see `CROSSCHAIN_DEPOSITS.md`; longer-term, deferred until after the hackathon). **Today's
hackathon submission shape = MARKETING VIDEO + CHEER BOARD**, not the deposit push. The escrow
stays live/immutable/verified underneath; it just isn't the thing being promoted today.

**Why "publish our address, people send USDC directly" is IMPOSSIBLE (asked repeatedly, held):**
a wallet transfer to an address is not a deposit. A deposit is ONE signed tx that moves the
USDC AND mints a receipt bound to the sender's wallet — that receipt is the badge, the vote,
and the refund. A plain transfer runs no such instruction → no receipt → funds land in the
vault owned by nobody. And the upgrade key is burned (immutable), so no instruction can ever
be added to assign or refund them → stranded permanently. The signature is what makes the
money recoverable; it cannot be bypassed. (This was Lorin's instinct twice under UX pain; the
answer is a hard no — it would take people's money.)

**On-chain deposit check** (run anytime to see if a deposit landed — straight from the chain):

```bash
# raised / depositor count, straight from the chain
python3 - <<'PY'
import json,urllib.request,base64,struct
h={"Content-Type":"application/json","User-Agent":"Mozilla/5.0"}
r=urllib.request.Request("https://solana-rpc.publicnode.com",data=json.dumps({"jsonrpc":"2.0","id":1,
 "method":"getAccountInfo","params":["B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd",{"encoding":"base64"}]}).encode(),headers=h)
d=base64.b64decode(json.load(urllib.request.urlopen(r))["result"]["value"]["data"][0])
o=8+64; n=struct.unpack_from("<I",d,o)[0]; o+=4+n+8
print("raised $%.2f from %d depositor(s)"%(struct.unpack_from("<Q",d,o)[0]/1e6, struct.unpack_from("<I",d,o+8)[0]))
PY
```

If it fails: re-run with `skipPreflight:false` in `escrow/web/deposit.js` to surface the real
simulation error, read it, fix the actual cause. **Do not put the QR in front of people until a
deposit has demonstrably landed** — the whole pitch is "watch the counter move."

Once it lands: un-hide the campaign CTAs on the cheer page (remove `hidden-until-launch` from
both `.cta` anchors in `cheerboard/web/cheer.html`), then the QR goes up.

---

## ② WHAT'S ALREADY DONE (don't redo it)

- [x] Deploy of the audited binary under `2PAg6iM…`, hash-matched.
- [x] `send-climbing` campaign initialized — 180-day deadline, no goal.
- [x] **Upgrade authority burned** — the site, `agents.md`, and `VERIFY_IT.md` all claim this;
      it is now true and independently checkable.
- [x] Web config flipped to mainnet + Circle USDC in `index.html` (and `escrow/web/demo.html`).
- [x] `VERIFY_IT.md` status table → LIVE with the mainnet addresses pinned.
- [x] Shortlinks minted for the QR and the Discord paste.

**Not done, and not needed:** the scratch-campaign smoke test in the old plan (victory leg +
dissolve leg with real money). The program has only two mainnet transactions — the deploy and
the campaign init. Both exits are proven on devnet across three published rehearsals
(`REHEARSALS.md`), and the mainnet code is byte-identical. Worth knowing that the real-money
exercise of the exits never happened, in case anyone asks how thoroughly it was tested.

---

## ③ CAMPAIGN VIDEO

22 NS residents filmed saying "I want a climbing wall" (`video/people.csv`). The pipeline
(`video/pipeline.py`) normalizes each clip, gets word-level timestamps, and aligns everyone on
the **demand onset** so all voices hit the line on the same frame. Three cuts are rendered in
`video/out/`:

| Cut | File |
|---|---|
| Mosaic chorus (all faces, synced) | `A_mosaic_chorus.mp4` |
| Relay (one hands to the next) | `B_relay.mp4` |
| Halves | `C_halves.mp4` |

Pick one, finish it, ship it. This is also the hackathon demo asset.

---

## ④ HACKATHON SUBMISSIONS (deadline today)

- [ ] **Bank the cheers before demoing**: `node cheerboard/scripts/commit_board.cjs` (commit-only, button never pauses).
- [ ] **MagicBlock — the strong one, submit it.** Luma "Submission: Solana Blitz v6": needs GitHub repo + a short demo video OR live link, before the Sunday deadline. Hard gate: must integrate Ephemeral Rollups (we do — the cheer board). Pool 1,000 USDC (500/250/150/100); **the $500 is reserved for best MOBILE build — that's the cheer board.** Judged on creativity, technical depth, and meaningful ER use. **Lead with the mobile cheer demo.**
- [ ] **Superteam TxODDS — likely INELIGIBLE, do not build for it.** The global bar requires a "functional build utilizing **TxLINE** (TxODDS' live football-odds feed) as a **primary input**." We use no sports data. Lorin agrees we don't qualify. Local NS listing states no criteria + 0 submissions. **One decisive move before spending any time: Telegram @tuakdotsol — "Is TxODDS/TxLINE integration required to qualify for the NS local listing, or is any Solana build eligible?"** Don't bend the project into a football story.
- [ ] **Curious / Ârc — no forms, live pitch only.** Use the deck. Curious: read back their fundable idea #25 ("communities set a goal, pool resources, execute") — but **honest framing: human-driven, not an autonomous agent DAO** (deck slide 11 already says this). Ârc: network-state amenity funded with no treasury/committee.
- [ ] **Fulgur — rolling Google form** at thearccity.com/fulgur/rfs (post-weekend fine). Weakest fit (Bitcoin app layer; our BTC story is roadmap-only).

**Pitch deck (the presentation asset):** `deck/NS_Climbing_Pitch.pptx` — regenerate with `python3 deck/build_pitch.py` (needs the two Gemini diagrams via `gen_escrow.py` / `gen_arch.py`). 12 slides, two-layer funnel, MagicBlock-forward, honest human-driven framing. Import to Google Slides to edit. Emailed to Lorin 2026-07-12.

Judge/track research: `HACKATHON.md`. Pitch framing: this deck + the agent's two-layer funnel note. `sales_kit/PITCH_SCRIPT.md` was CORRECTED 2026-07-12 — 180 days (was 90), dollar-weighted (was head-count), and the new tier perks — so it is safe to use.

**TIER PERKS (set by Lorin, 2026-07-12).** The plaque is the TOP tier only — **$20 does NOT get you on it.**
- **V1 · $20** — a shout-out in the Discord, and a profound sense of satisfaction.
- **V5 · $100** — sharpie your name onto the wall itself. Graffiti it. It stays.
- **V10 · $1000** — your name on the founding plaque.

The deposit BUTTONS are the canonical tier surface; the separate tier *cards* were removed from `index.html` (they restated the same thing and disagreed with it). Copy lives in `sales_kit/TIERS.md`.

---

## THE TRUST MODEL (what to say when selling)

Dollar-weighted. In by choice, locked. Out only together: **fund** (a dollar-majority of
depositors approves the address YOU propose), **dissolve** (a dollar-majority votes
no-confidence → everyone refunded), or **timeout** (180 days → everyone refunded). Only you
can propose a destination; no outsider can move a cent anywhere but back to depositors. The
one honest caveat, stated on the site: the only way *you* could redirect funds is by
depositing more than everyone else combined — so they're trusting the named organizer not to.
Sybil-proof (cheap wallets can't reach a dollar-majority) and, with the upgrade key burned,
the code can never change.

---

## OPERATIONAL GOTCHAS

- **git push 403**: the macOS keychain hands back the wrong GitHub account. Use:
  ```
  TOKEN=$(gh auth token --user Loringtonian)
  git -c credential.helper= -c credential.helper='!f() { echo "username=Loringtonian"; echo "password='"$TOKEN"'"; }; f' push origin main
  ```
- **RPC**: browsers get 403 from `api.mainnet-beta.solana.com`. The site uses
  `solana-rpc.publicnode.com`. Same applies to any script with a default user-agent — send a
  browser UA or use publicnode.
- **Stale JS**: `deposit.js` / `counter.js` load with `?v=<timestamp>` cache-busters. Bump on change.
- **GitHub Pages** takes ~1 min to rebuild after a push; always cache-bust when verifying live.
- **Never tell anyone to send USDC directly to an address** — a deposit must go through the page
  (it creates the receipt = badge + vote + refund). Direct transfers become stranded dust. (Both pages warn this.)
- **Program dump hash**: raw `solana program dump` is zero-padded to max-len; truncate to 296,544 bytes before hashing.
- **`solana` CLI is not on PATH in a fresh shell** — use the JSON-RPC snippets above, or source the Solana env first.

---

## STATE AS OF THIS DOC (2026-07-12 12:30 +08)

- Contract v4 dollar-weighted: **LIVE ON MAINNET**, immutable (upgrade authority burned).
- Campaign `send-climbing`: open, deadline 2027-01-08, **$100 raised, 1 depositor** (founder seed via Solflare 2026-07-12).
- Mainnet program history: 2 transactions total (deploy, init). No deposits, no votes.
- Devnet: clean chain, three rehearsals proving all three endings.
- Frontend: mainnet config live; cheer-page campaign CTAs still hidden until the first deposit lands.
- Video: 22 clips shot, 3 cuts rendered, none finalized.
- Hackathon: repo ✓, video pending, submissions pending.
