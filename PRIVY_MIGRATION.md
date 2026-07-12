# Privy migration — external-wallet connector

Migrates the crowdfunding deposit flow to connect wallets through **Privy**
(external-wallet-only: the same Phantom/Solflare keys sign, Privy owns the
connect modal + session). The on-chain program, the deposit transaction, and
all tx-building in `deposit.js` are **unchanged**.

App ID: `cmrhgep4h01vh0clb7o269ab3`

## What changed

- `escrow/web/deposit.js` — the wallet layer only:
  - `provider()` now prefers `window.PRIVY.wallet` when present (falls back to injected Phantom/Solflare).
  - bootstrap shows the Connect button when `usePrivy` is on (skips the "open in wallet browser" screen).
  - the connect handler opens Privy's modal via `window.PRIVY.connect()`; the injected path stays as fallback.
  - signing (`wallet.p.signTransaction(tx)`) is untouched — Privy's external wallet exposes the same method.
- `escrow/web/privy-island.js` — **new.** A hidden React `PrivyProvider` (loaded from a CDN, no build step) that publishes the contract `deposit.js` consumes:
  - `window.PRIVY.connect()` → `Promise<{ address, signTransaction(tx) }>`
  - `window.PRIVY.wallet` → `{ signTransaction(tx) }` once connected
- `escrow/web/privy-test.html` — **new.** Standalone connect + sign check.
- `index.html` and `escrow/web/demo.html` — added `privyAppId` + `usePrivy` to `ESCROW_CONFIG` and load the island. **`usePrivy` is `false`** on both, so the live flow is unchanged until you flip it.

## Verify before enabling (needs a real browser + wallet — I can't run that here)

1. Serve locally: `cd ~/Project/wallclimbing && python3 -m http.server 8000`
2. Open `http://localhost:8000/escrow/web/privy-test.html`
3. Click **Connect via Privy** → approve → you should see your address.
4. Click **Test sign (no broadcast)** → approve → expect `✓ Signed OK`.

If connect or sign errors with an API-shape message, the SDK version moved. Fix
the two lines marked `// VERIFY` in `privy-island.js`:
- the Solana wallets hook (`useSolanaWallets`), and
- the `signTransaction(tx)` call shape (some versions want `signTransaction({ transaction, connection })`).

## Enable it

Once the test page passes, set `usePrivy: true` in the `ESCROW_CONFIG` block of
`index.html` and `escrow/web/demo.html`. To roll back, set it to `false`.

## Ship it (run in your own Terminal — the sandbox can't do git here)

```
cd ~/Project/wallclimbing
git checkout -b privy-wallet
git add escrow/web/deposit.js escrow/web/privy-island.js escrow/web/privy-test.html \
        index.html escrow/web/demo.html PRIVY_MIGRATION.md
git commit -m "Privy external-wallet connector (behind usePrivy flag)"
git push -u origin privy-wallet
```

Because it's behind `usePrivy:false`, merging this is safe — nothing changes on
the live site until the flag is flipped.
