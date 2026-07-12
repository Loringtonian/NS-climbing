# TOMORROW — LAUNCH DAY · v4 dollar-weighted

> Cold-start doc. Everything needed to finish this is here — no prior session context required.
> The contract was rebuilt 2026-07-12 to DOLLAR-WEIGHTED voting (a $1000 depositor
> outweighs 50× a $20 one; a flood of cheap wallets can't capture the vote), a
> ~6-month deadline capped in code, and a fresh clean-chain program ID. Two adversarial
> audits passed (DEPLOY-WITH-FIXES → all doc fixes applied); 19/19 tests green;
> byte-reproducible build; three on-chain rehearsals republished. Ready for mainnet.

---

## THE ADDRESSES (everything in one place)

| What | Value |
|---|---|
| **Deployer / organizer key** (send SOL here — ALREADY FUNDED with 2.5 SOL) | `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` |
| Program keypair file (local, gitignored) | `escrow/target/deploy/ns_climb_escrow-keypair.json` |
| **Program ID** (devnet + mainnet, same) | `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` |
| **Audited binary sha256** | `0656436312f777e9c382eea98a40af75dc6acfaf65789aefaef0ce6746af646b` (296,544 B) |
| Campaign ID (string) | `send-climbing` |
| Campaign PDA (same address both clusters) | `B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd` |
| Devnet demo mint | `CXBXU8sX8H9fvdgVGz2s2bKYZrbvWr6rW9SzhU9ymk2T` |
| **Circle USDC (mainnet mint)** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Cheer board PDA (devnet, live) | `4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C` |
| Discord thread | NS Discord → `#discussion` → `send-climbing` |
| Private name form | wired in `index.html` ESCROW_CONFIG (Google Form) |

Deploy cost: **~2.5 SOL** (2.23 refundable program rent). **The deployer wallet already
holds 2.5 SOL on mainnet — nothing to send.**

---

## ① SAY "GO"

The only prerequisite (Kraken withdrawal) is done — 2.5 SOL is already on the deployer
wallet on mainnet. On "go", the agent runs the sequence below.

---

## ② LAUNCH SEQUENCE (~40 min)

1. **Deploy + init** — `bash escrow/scripts/mainnet_go.sh` (requires typing `MAINNET`).
   Deploys the audited binary `0656436312…` under program ID `2PAg6iM…`, inits the
   `send-climbing` campaign (180-day deadline, no goal).
2. **Hash-match the deployed program** — `solana program dump 2PAg6iM… onchain.so -u mainnet-beta`,
   then truncate to 296,544 bytes and sha256 — **must equal `0656436312…`. If it doesn't, STOP.**
   (The raw dump is zero-padded to max-len; truncate first — procedure in `agents.md`.)
3. **Smoke test — on SCRATCH campaigns, not the real one** (`escrow/DEPLOY.md`):
   - Victory leg: deposit $20 → propose payout to your 2nd wallet → vote to a dollar-majority → release → $20 lands.
   - Dissolve leg: fresh scratch → deposit $20 → vote dissolve → DISSOLVED → crank → $20 returns.
   *You personally exercise both exits with real money before anyone else is asked for a cent.*
4. **BURN the upgrade authority — BEFORE the first real deposit** (LAUNCH-BLOCKING):
   `solana program set-upgrade-authority 2PAg6iM… --final -u mainnet-beta`
   then verify `solana program show 2PAg6iM… -u mainnet-beta` shows **no authority**.
   The site, `agents.md`, and `VERIFY_IT.md` all CLAIM this is burned — the burn makes it true.
5. **Flip web config to mainnet** — in BOTH `index.html` and `escrow/web/demo.html` `ESCROW_CONFIG`:
   `rpc` → `https://api.mainnet-beta.solana.com` (or a private RPC), `mint` → Circle USDC
   (`EPjFWdd5…`). Leave `campaign: "send-climbing"` (the PDA derives the same, resolves to
   the mainnet account once RPC is mainnet). Bump the `?v=` cache-buster on the JS includes.
   Push. Verify the LIVE page shows the mainnet counter.
6. **Pin mainnet addresses** — `agents.md` Live-campaign params (cluster=mainnet, PDA
   `B5Mmhc…`, Circle mint), `VERIFY_IT.md` status table → LIVE.
7. **You become depositor #1** — real $20 deposit on the real campaign. The site's
   "he's the first money in" becomes true.
8. **Un-hide the campaign CTAs on the cheer page** — remove `hidden-until-launch` from both
   `.cta` anchors in `cheerboard/web/cheer.html`.
9. **QR + post the link in the Discord thread** (first paste also tests the OG unfurl).

---

## THE TRUST MODEL (what to say when selling)

Dollar-weighted. In by choice, locked. Out only together: **fund** (a dollar-majority of
depositors approves the address YOU propose), **dissolve** (a dollar-majority votes
no-confidence → everyone refunded), or **timeout** (~6 months → everyone refunded). Only you
can propose a destination; no outsider can move a cent anywhere but back to depositors. The
one honest caveat, stated on the site: the only way *you* could redirect funds is by
depositing more than everyone else combined — so they're trusting the named organizer not to.
Sybil-proof (cheap wallets can't reach a dollar-majority) and, once the upgrade key is burned,
the code can never change. Pitch script: `sales_kit/PITCH_SCRIPT.md`.

---

## ③ HACKATHON SUBMISSIONS (Sunday deadline)

- [ ] **Demo video** — the only unbuilt deliverable. Beats: real gym → wall render → the flow →
      live counter → cheer board smashed → on-chain proof (`REHEARSALS.md`).
- [ ] **Bank the cheers before demoing**: `node cheerboard/scripts/commit_board.cjs` (commit-only, button never pauses).
- [ ] **MagicBlock** Luma "Submission: Solana Blitz v6" — repo + video/live link.
- [ ] **Superteam Earn** — submit on the listing.
- [ ] **Curious / Ârc** — live pitch (use `STATEMENT.md`, both registers).
- [ ] **Fulgur** — rolling form at thearccity.com/fulgur/rfs.

Judge/track research: `HACKATHON.md`.

---

## OPERATIONAL GOTCHAS

- **git push 403**: the macOS keychain hands back the wrong GitHub account. Use:
  ```
  TOKEN=$(gh auth token --user Loringtonian)
  git -c credential.helper= -c credential.helper='!f() { echo "username=Loringtonian"; echo "password='"$TOKEN"'"; }; f' push origin main
  ```
- **Stale JS**: `deposit.js` / `counter.js` load with `?v=<timestamp>` cache-busters. Bump on change.
- **GitHub Pages** takes ~1 min to rebuild after a push; always cache-bust when verifying live.
- **Never tell anyone to send USDC directly to an address** — a deposit must go through the page
  (it creates the receipt = badge + vote + refund). Direct transfers become stranded dust. (Both pages warn this.)
- **Program dump hash**: raw `solana program dump` is zero-padded to max-len; truncate to 296,544 bytes before hashing.

---

## STATE AS OF THIS BUILD

- Contract v4 dollar-weighted: FINAL — 19/19 tests, two adversarial audits closed, byte-reproducible.
- Devnet: clean chain (program `2PAg6iM…`), three rehearsals (`REHEARSALS.md`) proving all three
  endings incl. the dollar-weight boundary live, plus the `send-climbing` demo campaign ($100 in it).
- Frontend: dollar-weighted account parsing verified against live devnet data; both pages carry the
  dollar-weight copy + the never-send-directly warning; config points at devnet demo (flip at launch).
- Cheer board: unchanged; CTAs on the cheer page still hidden until launch.
- Mainnet: **not deployed.** 2.5 SOL is pre-positioned on the deployer wallet. Nothing collected from anyone.
