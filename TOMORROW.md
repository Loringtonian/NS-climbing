# SHOWTIME — post-launch state · v4 dollar-weighted

> Cold-start doc. Everything needed to finish this is here — no prior session context required.
> **Mainnet went live 2026-07-12 (~02:50 UTC / 10:50 +08): audited binary deployed, campaign
> initialized, upgrade authority BURNED, site flipped to mainnet + Circle USDC.** The contract
> is now immutable and the rail is open.
>
> **The one thing that has NOT happened: a single successful deposit.** Pool is $0 / 0
> depositors. Everything below is organized around closing that.

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

## ① THE BLOCKER — deposit flow works but Phantom is too slow on a new program

Pool is still **$0 / 0 depositors**. Extensively debugged with real money on 2026-07-12
(~12:00–12:50 +08). The flow is CORRECT; the problem is speed, and it's on Phantom's end.

**Root cause (confirmed):** Phantom's transaction preview runs server-side via Blowfish, and
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

**DECISION 2026-07-12: NOT pushing public sales/deposits today.** The Phantom web flow is too
slow to put in front of non-crypto NS folks until it warms up. Contract is live / immutable /
verified; the rail works but needs to warm up (or Solflare) before the public push.

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
- [ ] **MagicBlock** — Luma "Submission: Solana Blitz v6": repo + video/live link.
- [ ] **Superteam Earn** — submit on the listing.
- [ ] **Curious / Ârc** — live pitch (use `STATEMENT.md`, both registers).
- [ ] **Fulgur** — rolling form at thearccity.com/fulgur/rfs (post-weekend is fine).

Judge/track research: `HACKATHON.md`. Pitch script: `sales_kit/PITCH_SCRIPT.md`.

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
- Campaign `send-climbing`: open, deadline 2027-01-08, **$0 raised, 0 depositors**.
- Mainnet program history: 2 transactions total (deploy, init). No deposits, no votes.
- Devnet: clean chain, three rehearsals proving all three endings.
- Frontend: mainnet config live; cheer-page campaign CTAs still hidden until the first deposit lands.
- Video: 22 clips shot, 3 cuts rendered, none finalized.
- Hackathon: repo ✓, video pending, submissions pending.
