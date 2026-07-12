# Handoff — NS Climbing pitch deck (Slides integration)

> For the agent taking over slideshow work. Everything you need is here.
> Working dir: `Projects/NS-climbing/deck/`. Date: 2026-07-12.

## What the deck IS (done, good)

- **`deck/NS_Climbing_Pitch.pptx`** — 12-slide hackathon pitch, v3. Regenerate with
  **`python3 deck/build_pitch.py`** (idempotent). It's been rendered/verified and emailed to
  Lorin three times (v1→v3). Lean (~700 KB).
- **Generators (all committed):**
  - `build_pitch.py` — the deck. python-pptx, 16:9. Brand: near-black `#0E1116`, vermilion
    `#FF6B4A`, amber `#FFB24A`, mint-green `#7FE0B2`, Arial. Footer on every slide.
  - `gen_escrow.py` / `gen_arch.py` — the two Gemini (nano-banana-pro, `gemini-3-pro-image-preview`)
    architecture diagrams: escrow contract + MagicBlock ER flow. Key loaded from
    `Projects/Personal_Media_Archive/.env` (`GEMINI_API_KEY`). Output PNGs are **gitignored**
    (regenerable) — run these before `build_pitch.py` if the PNGs are missing.
  - `push_to_slides.py` — see "the open task" below.
- **Deck story (v3, do NOT regress these — Lorin's explicit calls):**
  - Spine = **two-layer funnel**: "The rollup is where a community discovers it wants something;
    the mainnet contract is where it proves it." Slide order: measurement problem → thesis →
    **Layer 1 = MagicBlock cheer board (foregrounded)** → escrow Layer 2 → scan-to-cheer QR →
    honest fundable → "don't trust us, ask your agent" close.
  - **MagicBlock is emphasized** (Layer 1 first, 3 slides). Lead the live demo with the mobile
    cheer board — the MagicBlock $500 prize is reserved for best mobile build.
  - **Honest framing (hard requirement):** it is **human-driven, NOT an autonomous agent DAO.**
    Slide 11 says so plainly. Do not overclaim the agentic angle.
  - Facts: **180 days** (not 90), **dollar-weighted** (not head-count), **immutable / upgrade
    authority burned**. `sales_kit/PITCH_SCRIPT.md` was stale (90 days, head-count majority) and
    was CORRECTED 2026-07-12 — it is now safe to use. Tier perks were reset the same day:
    V1 $20 = Discord shout-out, V5 $100 = sharpie your name on the wall, V10 $1000 = founding
    plaque (the plaque is TOP tier only — $20 does not get you on it).
  - **Superteam dropped** (we don't use TxODDS/TxLINE sports data → ineligible).
  - QR on slides 10 + 12 → `tinyurl.com/sendcheer` (301 → live cheer board; verified).
- **Verify a build:** `soffice --headless --convert-to pdf --outdir <tmp> NS_Climbing_Pitch.pptx`
  then `pdftoppm -png` → montage with PIL. (LibreOffice at `/Applications/LibreOffice.app/...`.)
- **Deliver a file to Lorin:** `Projects/Brain_Superpowers/Memes/send_email.py "subj" "body" <files>`
  → his gmail. (AgentMail has a ~5 MB attachment cap — keep the deck lean; the diagram helper
  re-encodes to JPEG for this reason.)

## THE OPEN TASK — get it into Lorin's Google Slides, editable + live-editable

Lorin does NOT want email+manual-import. He wants it created/edited **directly in Google Slides**
(a previous agent did this for his "Second Brain presentation"). Here's the full state:

**The mechanism** (how the previous agent did it): a **service account**
`sb-slides-editor@chessbot-coach.iam.gserviceaccount.com`, key at
`~/.config/sb_slides/slides-sa.json` (scope: `presentations`). It edits an existing presentation
by ID via the Slides API `batchUpdate`. Reference tool:
`Personal_Operations/Network_School/Second_Brain_Talk/slides_edit.py`.

**What I already did:**
- **Enabled the Drive API** on the `chessbot-coach` GCP project (was disabled) via
  `gcloud services enable drive.googleapis.com --project=chessbot-coach` (Lorin's gcloud is
  authed as him with cloud-platform scope; worked non-interactively).
- Wrote **`deck/push_to_slides.py`** — uploads the pptx via the SA, converts to Google Slides,
  shares to Lorin. **It fails with `storageQuotaExceeded`** — see the wall.

**The wall (consumer-Gmail limitation):** a service account has **zero Drive storage** and
**cannot own files on a consumer Gmail account** (no domain-wide delegation on consumer). So the
SA can only **edit files Lorin already owns and shared with it** — currently just one:
"Second Brain presentation". It **cannot create** a new Lorin-owned deck.

**Two unblock paths — both need ONE action from Lorin (he was deciding which when this handed off):**

1. **rclone write re-auth (fastest; preserves the exact pptx design).** Lorin's rclone `gdrive:`
   remote was **read-only**; I already bumped its config scope to `drive` (`rclone config update
   gdrive: scope drive`). Lorin must run **`rclone config reconnect gdrive:`** and approve in the
   browser (grants read-write to his Drive). Then YOU run:
   ```
   rclone copyto "deck/NS_Climbing_Pitch.pptx" "gdrive:NS Climbing — Pitch Deck.pptx" --drive-import-formats pptx
   rclone lsjson "gdrive:" --include "NS Climbing*"   # grab the id
   ```
   → editable Slides owned by Lorin at `https://docs.google.com/presentation/d/<id>/edit`.
   (Then `push_to_slides.py` isn't needed; rclone did the convert.)

2. **Share-with-SA (no OAuth; but you rebuild via the API).** Lorin makes a blank deck at
   `slides.new`, Share → adds `sb-slides-editor@chessbot-coach.iam.gserviceaccount.com` as
   **Editor**, hands you the URL. Then you build the deck into it via the Slides API `batchUpdate`
   (model on `slides_edit.py`). **Caveat:** Slides API `createImage` needs a **public image URL**
   — the repo is public (GitHub Pages), so commit the diagram/QR PNGs (currently gitignored) and
   use `raw.githubusercontent.com` / pages URLs. This path is much more work than #1.

**Recommendation:** push Lorin toward path #1 (one browser approve, then the finished deck lands
intact). Only rebuild via the Slides API (#2) if he refuses the OAuth.

## NS constraints (respect these)
- Community-only content; don't post the deck/page publicly or name the exact location in
  anything shareable; no photos of other NS residents. (The deck uses stock wall/gym imagery +
  the anonymized emoji-face cheer board — fine.)
- Don't push the NS-climbing repo anywhere but its existing `github.com/Loringtonian/NS-climbing`
  remote. Git push uses the `Loringtonian` token (see `TOMORROW.md` § Operational gotchas).

## Where the rest of the project is
`TOMORROW.md` is the project cold-start doc (mainnet live/immutable, cheer board live, deposit
flow via Solflare, hackathon submission plan in §④). `CROSSCHAIN_DEPOSITS.md` = the Privy/any-chain
architecture (deferred, separate agent/thread).
