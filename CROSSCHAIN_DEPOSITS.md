# Any-chain / any-wallet deposits — architecture research (2026-07-12)

> Question from an NS friend (crypto-savvy): let people deposit from **any wallet on any
> chain** (incl. Ethereum/EVM) *without changing the immutable Solana contract*. Idea: use
> **Privy**; when the user signs, it bridges into Solana and calls the contract. "See how
> Polymarket does it (bridges everything to Polygon) and replicate for Solana."
>
> Researched via three parallel agents (Privy / EVM→Solana bridges / Polymarket stack).
> This doc = the synthesis + the decision. Nothing here changes the deployed contract.

## The load-bearing constraint (verified in our code)

`Deposit` accounts struct (`escrow/programs/ns-climb-escrow/src/lib.rs`):
- `pub depositor: Signer<'info>` — the depositor **must sign**.
- `depositor_token: token::authority = depositor` — USDC is pulled **from the depositor's own
  token account**, which only the depositor can authorize.
- `receipt` seeds = `["receipt", campaign, depositor.key()]`, `payer = depositor`; handler sets
  `r.depositor = depositor.key()`. The badge/vote/refund **bind to the signer**.

**Consequence:** a deposit can only be made by a Solana keypair that (a) holds the USDC and
(b) signs the tx. No third party can deposit "on someone's behalf." The program is **immutable**
(upgrade authority burned), so this cannot be changed.

## Verdict on the friend's exact mechanism (one signature bridges *and* calls the contract)

**Not possible against our contract.** "Bridge-and-call" primitives exist and are real —
**deBridge DLN Hooks** and **Circle CCTP v2 Hooks** can execute an arbitrary Solana instruction
on arrival (deBridge non-atomic/guaranteed; CCTP atomic via CPI). But with any of them the
Solana **signer is the solver/relayer, not the user** — so our program would bind the receipt to
the solver and, worse, the solver has no authority over the user's token account. The bridge
agent flagged this independently: bridge-and-call only works if `deposit` takes the beneficiary
as a *passed-in account* rather than requiring the depositor to sign. Ours requires the
depositor to sign. **So no bridge can call our `deposit` for the user.**

## The design that DOES work (same one-tap UX, contract untouched)

Split the deposit into two legs that happen behind one user action:

1. **Land USDC on a Solana wallet the user controls.** Use **Privy** to give every user a
   self-custodial **embedded Solana wallet** — even if they log in with email or connect a
   MetaMask/EVM wallet. Fund it by bridging their EVM USDC to that Solana address (Privy has
   built-in "bridge/swap on funding"; or pair with a bridge — cheapest = Circle **CCTP**/Mayan
   MCTP on native USDC, or **deBridge**/Relay/Across).
2. **Fire our `deposit`, signed by the embedded wallet.** The app builds the instruction with
   `depositor = embedded wallet`; **Privy signs it programmatically** (no popup); our
   **fee-payer relayer** covers SOL gas so a zero-SOL user can deposit. Program pulls USDC from
   the embedded wallet → vault, mints the receipt bound to the embedded wallet.

From the user's side: one tap. The embedded wallet is theirs (exportable to Phantom/Solflare),
so badge/vote/refund are genuinely theirs.

### Why this is the Polymarket pattern, adapted
Polymarket = Magic.link email wallets + a **per-user proxy smart-contract** on Polygon + their
own bridge (per-chain deposit addresses → auto-swap to Polygon USDC) + a GSN relayer for gas.
The **proxy-contract trick has no Solana equivalent** (no ERC-4337; Solana funds live in
keypair/PDA token accounts). Privy's embedded Solana wallet + a fee-payer relayer fills exactly
that gap: identity/authorization = the embedded-wallet signature (like Polymarket's EOA sig);
settlement = a normal signed Solana deposit (not a proxy contract).

## Cost / effort
- **Privy:** free under ~499 monthly active wallets (well within this campaign). Stripe-owned.
- **Bridge fees:** negligible (deBridge 0.04% = $0.008 on $20; CCTP ~none on native USDC).
- **Real cost we'd sponsor:** Solana rent per *new* user — receipt PDA is `payer = depositor`,
  so the embedded wallet needs ~0.002–0.003 SOL for the receipt (+ ATA if new) ≈ **$0.40–$2,
  one-time per user**. We dust each embedded wallet that SOL (fee-payer only covers the tx fee,
  not the hard-coded receipt rent). This is the largest line item on a first $20 deposit.
- **Build:** Privy SDK on the frontend + a small **fee-payer relayer backend** (holds SOL,
  co-signs/broadcasts). Order of a few focused days, not a rewrite.

## Risks / tradeoffs
1. **Governance persistence.** Receipt/vote/refund bind to the Privy embedded wallet. Signing +
   key export need Privy's live infra; a user who never exported is locked out of voting if Privy
   is down/gone (refunds still *return* USDC to their wallet address, but they'd need the key to
   move it). **Mitigation: nudge/require key export at deposit time** so rights outlive Privy.
2. **Trust surface vs. the "verify it yourself, no trust" pitch.** The escrow stays trustless;
   but the *on-ramp* adds Privy + a bridge + our relayer. Be clear that's plumbing around a
   trustless core, not part of the escrow's guarantees.
3. **Complexity vs. the dead-simple flow that already works.** Solflare connect → deposit works
   today with zero backend. Privy adds real surface to build, secure, and keep funded.

## The scope spectrum (what to actually build)
- **Tier 0 — manual (0 build):** a short "get Solana USDC in 5 min" blurb (exchange withdraw on
  Solana network, or a bridge like Jumper/Mayan) → deposit via Solflare. Fastest path to traction.
- **Tier 1 — bridge widget (~1 day, no backend):** embed a Jumper/Mayan/LI.FI swap widget on the
  page so an EVM user swaps → Solana USDC into their own Solflare wallet, then deposits. Covers
  the crypto-native EVM crowd without the relayer.
- **Tier 2 — full Privy (~few days + relayer):** log in with email or any wallet, pay from any
  chain, we handle everything. Max reach (incl. non-crypto people). Polymarket-grade UX.

## Provider fact status (for the record)
- Privy: embedded **Solana** wallets ✓, arbitrary-instruction signing ✓, native SOL gas
  sponsorship ✓, built-in cross-chain funding ✓ (exact bridge under "bridge/swap" UNVERIFIED),
  user key export ✓. Docs: docs.privy.io.
- Bridge-and-call on Solana: **deBridge DLN Hooks** and **CCTP v2 Hooks** = production arbitrary
  program execution on arrival; Wormhole/Mayan need custom glue; Relay/Across/LI.FI/Squid deliver
  tokens only (LI.FI *explicitly* excludes Solana from destination calls). But none help us —
  our contract requires the depositor to sign (above).
- Polymarket: Magic.link + own proxy contract + own bridge (per-chain deposit addresses → pUSD on
  Polygon, backed by native USDC) + GSN relayer for gas. Cross-chain bridge provider UNVERIFIED
  (docs say only "our bridge provider"; historically Connext).
