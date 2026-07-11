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
                                                    │
        base layer permanent record ◄── undelegate (ER commits state back)
```

## Layout

- `programs/ns-cheer/` — Anchor program (program ID `FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz`):
  `initialize`, `cheer(nonce)` (nonce only uniquifies rapid-tap signatures),
  `delegate_board` (authority-only), `undelegate_board` (authority-only).
- `scripts/lifecycle.cjs` — full automated test (see verification below).
- `scripts/init_board.cjs` — start a live session: init + delegate, prints the
  board PDA and ready-to-open phone/projector URLs.
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
