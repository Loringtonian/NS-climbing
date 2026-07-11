# TOMORROW — Sunday 2026-07-12 · LAUNCH DAY

> Cold-start doc. Everything needed to finish this is here — no prior session context required.
> Built Saturday: audited locked-pool escrow, clean devnet chain, three on-chain rehearsals,
> full site, cheer board + leaderboard. Tomorrow = deploy to mainnet, sell, submit.

---

## THE ADDRESSES (everything in one place)

| What | Value |
|---|---|
| **Deployer / organizer key** (send SOL here) | `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` |
| Keypair file (local, gitignored) | `~/.config/solana/id.json` |
| **Program ID** (deploys to mainnet under this same ID) | `42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD` |
| **Audited binary sha256** | `b6fdd452de20636b7e5a16025bbf16b5e972e4ffef8686d55d1ea2ac9cacd7f7` (295,112 B) |
| Devnet campaign (demo) | `send-climbing` · PDA `TDB3XbAChgvd7hA22t4YTVQ7SWjiPCsn3cTcnm2as44` |
| Cheer board PDA (devnet, live) | `4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C` |
| Cheer program | `FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz` |
| Circle USDC (mainnet mint) | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| ER router (MagicBlock devnet) | `https://devnet-router.magicblock.app` |
| Discord thread | NS Discord → `#discussion` → `send-climbing` |
| Private name form | responses in Lorin's Google Form (endpoint wired in `index.html` ESCROW_CONFIG) |

Deploy cost: **~2.5 SOL** (2.23 is refundable program rent).

---

## ① TONIGHT (do before sleeping — the only unpredictable step)

- [ ] Kraken → **2.5 SOL** → `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` (network: **Solana**)
- [ ] Kraken → **~$25 USDC + 0.02 SOL** → your Phantom (network: **Solana**)

Kraken's first-withdrawal-to-new-address hold is the only latency neither side controls.

---

## ② LAUNCH SEQUENCE (~35 min of work)

1. **Say "go"** — agent confirms 2.5 SOL landed at the deployer.
2. **Deploy + init** — `bash escrow/scripts/mainnet_go.sh` (requires typing `MAINNET`).
   Deploys the audited binary, inits the campaign (90-day deadline, no goal).
   **Then dump the deployed program off mainnet and hash-match `b6fdd452`. If it doesn't match, STOP.**
3. **Real-money smoke test — on SCRATCH campaigns, not the real one** (protocol in `escrow/DEPLOY.md`):
   - Victory leg: deposit $20 → propose payout to your 2nd wallet → vote (majority of 1) → release → $20 lands.
   - Dissolve leg: fresh scratch → deposit $20 → vote dissolve → DISSOLVED → crank → $20 returns.
   *You personally exercise both exits with real money before anyone else is asked for a cent.*
4. **Flip web config to mainnet** — mainnet RPC + Circle USDC + real campaign PDA in `ESCROW_CONFIG`
   (both `index.html` and `escrow/web/demo.html`). Push. Verify live.
5. **Pin mainnet addresses** in `VERIFY_IT.md` (status table → LIVE), `agents.md`, `STATEMENT.md`.
6. **You become depositor #1** — your real deposit on the real campaign. The site's bio line
   ("he's the first money in") becomes true.
7. **Un-hide the campaign CTAs on the cheer page** — remove the `hidden-until-launch` class from
   both `.cta` anchors in `cheerboard/web/cheer.html` (hidden Saturday night so nobody was misled
   before mainnet existed). Optionally restore the you-box (`box.style.display = "none"` line).
8. **QR goes up.** Post the link in the Discord thread (first paste also tests the link-preview unfurl).

---

## ③ SELLING (rest of the day)

- Pitch script: `sales_kit/PITCH_SCRIPT.md` (locked-pool version — no "withdraw anytime" language).
- Lead with the lock, then walk the three exits slowly.
- Names land automatically in the private Google Form as people deposit.
- Costs page for the "what does it actually cost" question: `costs.html`.

---

## ④ HACKATHON SUBMISSIONS (Sunday deadline)

- [ ] **Demo video** — the only unbuilt deliverable. Beats: real gym → wall render → the flow →
      live counter → cheer board being smashed → on-chain proof (`REHEARSALS.md`).
- [ ] **Bank the cheers before demoing**: `node cheerboard/scripts/commit_board.cjs`
      (pushes the tally to Solana; the button never pauses — commit-only, repeatable).
- [ ] **MagicBlock**: Luma "Submission: Solana Blitz v6" — repo + video/live link.
- [ ] **Superteam Earn**: submit on the listing (Malaysia-gated).
- [ ] **Curious / Ârc**: live pitch — use `STATEMENT.md` (both registers).
- [ ] **Fulgur**: rolling Google Form at thearccity.com/fulgur/rfs (post-weekend fine).

Judge/track research: `HACKATHON.md`.

---

## ⑤ WITHIN THE WEEK (disclosed publicly on the page)

- [ ] Lock (multisig) or burn the upgrade authority. Until then the organizer key can upgrade the
      program — this is disclosed in `agents.md`, `VERIFY_IT.md`, and on the deposit page.
- [ ] **Never change account layouts while a campaign is live** — a v1→v2 layout change on devnet
      made old campaign accounts unreadable. Logic-only upgrades while money is in.

---

## OPERATIONAL GOTCHAS (bit us Saturday)

- **git push 403**: the macOS keychain hands back the wrong GitHub account. Use:
  ```
  TOKEN=$(gh auth token --user Loringtonian)
  git -c credential.helper= -c credential.helper='!f() { echo "username=Loringtonian"; echo "password='"$TOKEN"'"; }; f' push origin main
  ```
- **Stale JS**: `deposit.js` / `counter.js` are loaded with `?v=<timestamp>` cache-busters. Bump the
  timestamp when changing them, or returning visitors get old code.
- **GitHub Pages** takes ~1 min to rebuild after a push; always cache-bust when verifying live.
- **Never tell anyone to send USDC directly to an address** — a deposit must go through the page
  (it creates the receipt = badge + vote + refund). Direct transfers become stranded dust.

---

## STATE AS OF SATURDAY NIGHT

- Contract v3.1 locked-pool: FINAL-SHIP (5 adversarial audit passes, all findings closed).
- Devnet: clean chain, three published rehearsals (`REHEARSALS.md`), demo campaign live.
- Site: hero, pitch, board explainer, gym render, the flow, bio, ask (tiers + inline deposit +
  private name capture + Discord link), two-register statement, costs page. All live, verified.
- Cheer board: ~7,500 gasless cheers from 23 people on a MagicBlock ER; leaderboard with emoji
  faces live on the button page; tally banked to Solana base layer.
- Mainnet: **not deployed.** Nothing real has been collected from anyone.
