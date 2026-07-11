# Cheer board — live "I want this wall" tally on a MagicBlock Ephemeral Rollup

The eligibility flourish, deliberately separate from the escrow money rail
(`../escrow/`). One tiny PDA holds one number, never funds. During the live
pitch it is delegated to an Ephemeral Rollup: everyone in the room smashes a
button on their phone (no wallet, no SOL — an in-page throwaway key signs;
ER transactions are gasless), and the projector tally spikes in real time.
Undelegating commits the final tally back to the base layer as a permanent
record.

```
initialize (base) ──► delegate (base→ER) ──► cheer × N (ER, gasless, ~10ms)
                                              │     │
        snapshot, board keeps cheering ◄── commit   │
                                                    │
        base layer permanent record ◄── undelegate (ER commits state back)
```

## Layout

- `programs/ns-cheer/` — Anchor program (program ID `FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz`):
  `initialize`, `cheer(nonce)` (nonce only uniquifies rapid-tap signatures),
  `delegate_board` (authority-only), `commit_board` (authority-only),
  `undelegate_board` (authority-only).
- `scripts/lifecycle.cjs` — full automated test (see verification below).
- `scripts/init_board.cjs` — start a live session: init + delegate, prints the
  board PDA and ready-to-open phone/projector URLs.
- `scripts/commit_board.cjs` — **bank the cheers** mid-session (below).
- `scripts/commit_proof.cjs` — proves commit-without-pause on a throwaway board.
- `scripts/end_board.cjs` — end it: undelegate, print final base-layer tally.
- `web/cheer.html` — phone button page (config via `?board=<pda>&rpc=<er-url>`).
- `web/tally.html` — projector view, 300ms polling (same query params).

## Run it (local rig)

Uses the shared MagicBlock rig from `Projects/PopUp_Markets/SETUP.md`
(mb-test-validator :8999 + ephemeral-validator :7799 — exact flags and
gotchas there; ONE validator stack at a time on this 16GB machine).

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd cheerboard
anchor build
solana program deploy target/deploy/ns_cheer.so \
  --program-id target/deploy/ns_cheer-keypair.json --url http://localhost:8999

BASE_URL=http://localhost:8999 ER_URL=http://localhost:7799 \
ER_VALIDATOR=mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev node scripts/init_board.cjs

python3 -m http.server 8789 --directory web   # then open the printed URLs
```

Phones on the same wifi need the machine's LAN IP in place of localhost, in
BOTH the page URL and its `rpc=` param. Devnet path: deploy with the same
commands against devnet (needs ~2.4 SOL) and drop the env overrides — the
Magic Router (`https://devnet-router.magicblock.app`) routes cheers to the ER
automatically; use it as `rpc=` in the page URLs.

## Bank the cheers (snapshot to Solana, without pausing the button)

`commit_board` pushes the running tally to the base layer and **leaves the board
delegated** — the ER copy stays live and people keep smashing the button. Run it
as often as you like during a session (e.g. after each promo push):

```bash
cd cheerboard && node scripts/commit_board.cjs     # board from .board.json
BOARD=<pda> node scripts/commit_board.cjs          # or an explicit board
```

It prints the ER tally, the commit signature, the new base-layer tally, and
re-checks that the board is still delegated. `end_board.cjs` is the *other*
thing — it undelegates, which is final and stops the cheering until you
re-delegate. Use `commit_board` for snapshots; use `end_board` once, at the end.

## Verification record (2026-07-11, devnet — commit_board)

- **Scratch board** `C2gNbkEQU3ubiKpic7Np3dzLid91BaUba5hJGmGgCL6d` (`commit_proof.cjs`):
  init → delegate → 3 cheers on the ER → `commit_board` → base-layer tally **0 → 3**,
  base account **still owned by the delegation program**, and 2 further ER cheers
  **still incremented (3 → 5)**. A second `commit_board` banked 5 and left it
  delegated. **COMMIT PROOF OK.**
- **Live board** `4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C`: ER tally 3,195
  → `commit_board` (sig `s8asuvcwn4i46htme4RzQ6NXajxtQCGJhQ6dwDmKpss9zrB4FCygsVQcGmZGfXFBiyWi9FPzgzn1TjCvBCYifR1`)
  → **base-layer tally 3,195** (it was 0 — never committed before), still
  delegated, and a post-commit test cheer still incremented (3,195 → 3,196).

## Verification record (2026-07-11, local rig)

- `lifecycle.cjs`: **LIFECYCLE OK** — init(base) → cheer(base) → delegate →
  **unfunded throwaway key cheers on ER: WORKS** (the no-wallet phone story) →
  **30 cheers in 82ms = 366 cheers/sec** → ER tally 32/32 → undelegate →
  **base-layer tally 32/32 after commit**.
- Web loop, headless browser: 7 taps on `cheer.html` → ER tally 7; second
  round of 5 taps live-ticked `tally.html` 7 → 12 (300ms poll, rate counter
  showing); `end_board.cjs` undelegated and the base layer read back 12.
- UNVERIFIED: devnet run (blocked on devnet SOL — same faucet drought as the
  escrow, see `../escrow/DEPLOY.md`); real-phone multi-device load.
