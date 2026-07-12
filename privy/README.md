# NS-climbing — any-chain deposits (Privy + relayer)

Let anyone — on **any chain, or email-only, with no browser wallet and no SOL** — deposit into
the **existing immutable** Solana escrow, **without changing the contract**.

## ✅ STATUS — PROVEN LIVE ON MAINNET (2026-07-12)

A real end-to-end deposit landed: **email login → Privy embedded Solana wallet → USDC →
deposit into the live `send-climbing` escrow**, relayer-sponsored gas, our own confirmation UI.
Campaign went **$100/1 → $120/2 depositors**. Proof tx:
`4yUCtucNVqzDWkazHgnSCvS6FdoZZKSzCE9H8iTabpVjKdnNDKGaNZ1nqk68E5NNoRn39RmJ7ff1xi5i67TVNHeW`.

**Live (staging):** https://loringtonian.github.io/NS-climbing/anychain/ · relayer
`https://ns-climbing-relayer.fly.dev` (Fly, mainnet, funded) · Privy app `cmrhgep4h01vh0clb7o269ab3`.

### The flow that works (as built, differs from the "co-sign" sketch below)
1. User clicks a tier → **our own in-app confirmation** ("Lock $X into the escrow?").
2. Client calls **`POST /fund-gas`** → relayer sends ~0.006 SOL to the embedded wallet (only if
   it's low on SOL AND already holds USDC — anti-abuse).
3. Client builds a **self-paid** deposit tx (embedded wallet is the sole signer + fee-payer;
   `app/src/escrow.ts::buildSelfPaidDepositTx`).
4. **`signTransaction`** with **`embeddedWallets.showWalletUIs:false`** (set in `main.tsx` — this
   client override beats the dashboard `enforce_wallet_uis`, so Privy's own modal — which can't
   preview a custom-program deposit — never shows). Pass the tx **serialized to a Uint8Array**.
5. Client broadcasts the returned signed bytes and poll-confirms.

### Hard-won gotchas (do not regress)
- Privy v3 `signTransaction` wants the **encoded tx (Uint8Array)**, not the Transaction object
  ("Uint8Array expected" if you pass the object). Use `tx.serialize()`.
- Use **VersionedTransaction (v0)**, not legacy.
- The deposit **must be self-paid** (embedded wallet = fee-payer). A relayer-fee-payer tx makes
  Privy's confirm modal unable to simulate → "error preparing / will likely fail," even though
  the tx is valid.
- Privy's confirm modal **cannot preview a custom-program deposit** → `showWalletUIs:false` +
  our own confirmation. (Client override works; no dashboard change needed.)
- `/fund-gas` confirms by **polling `getSignatureStatuses`**, not `confirmTransaction` (the
  block-height strategy false-fails on the public RPC even when the tx lands).
- `@solana/kit` + `@solana-program/*` must be on **6.x** for the Privy v3 SDK to bundle.

### NEXT (do this to finish)
1. **Fold into the main site** — add an "email / any chain" option to the real deposit page
   (`escrow/web/`) so it's one URL (QRs already point there); retire the `/anychain/` stub. Bring
   the main site's **confetti** on success along (the stub has none).
2. **In-app bridge funding** — "Add funds" currently just shows the address to send USDC to.
   Wire an embeddable **bridge widget** (Across / Jumper) → the embedded wallet address, so users
   fund from Base/Eth/etc. without leaving the page. (Privy's own funding config was a dead end:
   USDC not selectable on the SVM tab + needs a provider API key.)
3. Nudge **key export** at first deposit (governance/refund survive Privy).
4. Restrict the relayer **CORS** to the deploy origin.

Branch: `privy-crosschain`. Main-branch stub build lives at `anychain/` on `main`.

## Why this shape

The deployed escrow is immutable and its `deposit` instruction *requires the depositor to sign*
(it pulls USDC from the depositor's own token account and binds the receipt PDA — badge + vote +
refund — to the signer). So we can't have a bridge deposit "on someone's behalf." **Privy's
embedded Solana wallet is the linchpin:** it gives us the user's signature programmatically, so we
bridge USDC onto that wallet and fire the *exact existing* deposit instruction, signed by it.

```
login (email / any EVM wallet)                                   ┌───────────── relayer ─────────────┐
        │  Privy                                                 │ builds the canonical deposit tx    │
        ▼                                                        │ (feePayer = relayer) and only       │
  embedded SOLANA wallet ──fund (Privy bridges EVM→Solana)──►    │ co-signs a returned tx whose        │
        │  signs (partial)                                       │ message is byte-identical → can't   │
        ▼                                                        │ be tricked into draining            │
  prepare → sign → submit  ───────────────────────────────────► │ gifts ~0.005 SOL rent + pays gas +  │
        │                                                        │ broadcasts                          │
        ▼                                                        └────────────────────────────────────┘
  IMMUTABLE escrow: USDC → vault, receipt PDA minted for the embedded wallet (badge · vote · refund)
```

The one subtlety: the immutable contract makes the **depositor** pay the receipt/ATA rent
(`payer = depositor`), so a zero-SOL Privy wallet can't cover it. The relayer prepends a
`SystemProgram.transfer(relayer → depositor, ~0.005 SOL)` in the same tx (runs first), then the
deposit runs. Relayer pays gas as fee-payer; unused rent lamports stay in the user's own wallet.

## Layout

- `shared/escrow.js` — the deposit tx builder, **ported verbatim** from the audited
  `escrow/web/deposit.js` (contract is immutable → instruction shape is fixed). `config.js` =
  mainnet/devnet params + tiers.
- `relayer/` — Node/Express fee-payer. `server.js` (prepare/submit + validation + rate limit),
  `keygen.js`, `test_deposit.js`. Builds the canonical tx and only co-signs its own message.
- `app/` — Vite + React + **Privy v3** frontend (`@privy-io/react-auth@^3.34`). Login → embedded
  Solana wallet → fund (bridges any EVM chain on mainnet) → deposit via the relayer → export-key nudge.

## What YOU need to provide

1. **Privy App ID** (blocks the frontend run). privy.io → create app (or use the co-hacker's).
   Put in `app/.env.local` as `VITE_PRIVY_APP_ID`. In the Privy **dashboard** enable:
   - **Solana embedded wallets** (Wallets → embedded → Solana)
   - **Login methods**: Email + External wallets
   - **Funding / on-ramp** (and for EVM→Solana bridging, Privy's funding must be enabled)
2. **Relayer SOL** — `cd relayer && npm run keygen`, put the base58 in `relayer/.env` as
   `RELAYER_SECRET_KEY`. Fund the printed pubkey: **devnet** via faucet (free); **mainnet** ~0.2 SOL.
3. **Deploy target** (later) — where the relayer runs (Fly/Railway) + where the app is hosted.
4. A **devnet test campaign** for end-to-end devnet runs — init one under id `PRIVY_TEST` (or set
   `campaignId` in `shared/config.js` to an existing devnet campaign).

## Run it (local, devnet)

```bash
# relayer
cd privy && npm install                 # installs shared deps (web3.js, bs58) at the root
cd relayer && npm install               # express, cors
cp .env.example .env && chmod 600 .env  # fill CLUSTER=devnet + RELAYER_SECRET_KEY
npm start                               # :8787

# app (separate shell)
cd privy/app && npm install
cp .env.example .env.local              # fill VITE_PRIVY_APP_ID, VITE_CLUSTER=devnet
npm run dev                             # :5173
```

## Status (2026-07-12)

- ✅ **Core instruction VERIFIED** — `relayer/test_deposit.js` re-derives the campaign PDA
  `B5Mmhc…` and vault `DGf8Ut…` matching the **live mainnet** accounts, correct `deposit`
  discriminator + `$100→100000000` encoding, 3-ix tx (transfer, createATA, deposit).
- ✅ **Relayer VERIFIED** — boots, `/health` green, `/deposit/prepare` returns a signable tx and
  rejects bad tiers, tamper-check + rate-limit in place, clean shutdown.
- ⏳ **Pending (needs the Privy App ID + funds):** the Privy embedded-wallet signing and the actual
  on-chain settle. Everything up to the signature is proven.

## Known gotchas

- **Privy bridge-funding is mainnet-only** (not devnet). Test the deposit+relayer path on devnet by
  funding the embedded wallet with devnet USDC directly; the EVM→Solana bridge lights up on mainnet.
- **Legacy vs versioned tx:** the relayer builds a legacy `Transaction`; Privy's `signTransaction`
  should accept it. If it rejects legacy at runtime, switch `buildDepositTx` to a `VersionedTransaction`
  (small change) — the accounts/data are identical.
- **Privy v3 hook names** (`useWallets` / `useSignTransaction` / `useFundWallet` / `useExportWallet`,
  all from `@privy-io/react-auth/solana`). Most online tutorials show the deprecated `useSolanaWallets`.
- **Relayer CORS** is currently open — restrict to the deploy origin before production.
