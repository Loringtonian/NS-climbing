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
- `web/leaderboard.html` — who has smashed the button the most (below).
- `scripts/build_leaderboard.cjs` — rebuilds the leaderboard history snapshot.

## The leaderboard

`web/leaderboard.html` (short path: `/board.html`) ranks the cheerers. It is
derived from the chain, not from a database — there is no server here.

Every cheer is its own transaction, signed by a throwaway keypair the browser
generates and keeps in `localStorage` (`cheer_kp`). That pubkey **is** the
identity: pseudonymous, unfunded, worthless, and the only thing the chain knows
about a person. The leaderboard walks the board account's transaction history,
resolves the signer of each `cheer` instruction, and tallies per signer. The
page reads `cheer_kp` (read-only, never writes it) to highlight your own row.

Two-stage load, so it opens fast on a phone:

1. **History snapshot** — `web/leaderboard.json`, ~2 KB, precomputed. The full
   walk is ~7,500 transactions and takes ~40 s, which is not something a phone
   should do.
2. **Live tail** — the page fetches only the signatures *newer* than the
   snapshot's `latestSig`, resolves those, and merges. The headline total comes
   straight off the board account every 3 s, so it is always exact.

Refresh the snapshot (read-only; signs nothing, sends no instruction):

```bash
node cheerboard/scripts/build_leaderboard.cjs   # rewrites web/leaderboard.json
```

Names are **opt-in and private**: the page can post a display name + cheer key
to the same private Google Form the deposit page uses. Names land in a private
sheet, never on-chain and never on the public board. The board stays
pseudonymous for everyone.

**Self-check — the honesty property.** The board account holds its own `cheers`
counter, incremented by the program. The leaderboard is built by an entirely
different route (signature history → per-signer attribution). The two must
agree, and the build script prints both:

```
board says 7472, we attributed 7472     # 2026-07-11, 22 cheerers
board says 5414, we attributed 5414     # 2026-07-11, earlier, 20 cheerers
```

Attributed == on-chain tally means every cheer on the board is accounted for to
a signer, with none invented and none dropped. Verify the headline number
yourself against the account:

```bash
curl -s -X POST https://devnet-router.magicblock.app -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["4iYYde668p6FBr9cEsa3L6JZf52DqJBZusvnKbXkEC1C",{"encoding":"base64"}]}' \
  | python3 -c "import sys,json,base64,struct; d=base64.b64decode(json.load(sys.stdin)['result']['value']['data'][0]); print(struct.unpack_from('<Q',d,48)[0],'cheers')"
```

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
