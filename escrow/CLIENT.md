# CLIENT.md — how the web front-end talks to the escrow (v4, dollar-weighted locked model)

> **Working reference implementation: `web/deposit.js`** — ONE shared,
> audited flow module loaded by both the standalone deposit page
> (`web/demo.html`, the QR target) and the inline embed on the main
> `index.html`. Read it before writing anything new; extend it rather than
> forking it. `web/counter.js` is the read-only data pipeline (raised hero,
> tier chips, supporters strip, payout panel). `web/devnet.html` is the only
> URL-param-driven page (labeled DEVNET TEST MODE); the production pages
> hardcode config — audit requirement, see "Config" below.

## The model, in three sentences (full law: ../SPEC.md)

Deposits are LOCKED — there is NO withdraw instruction and the UI must never
suggest one. Money moves only by collective outcome, and votes are weighted by dollars
deposited (not by wallet): dual-gate release (organizer proposes a payout
address + depositors backing a strict majority of the pooled dollars approve),
dollar-majority dissolve → refund crank, or the 180-day deadline → refund
crank. The badge (receipt PDA) is simultaneously proof-of-support and both
ballots, with vote weight equal to the deposited amount.

## Config — hardcoded, never from URL params

Every page sets `window.ESCROW_CONFIG` inline (the audit found URL-param
config to be a phishing primitive on the trusted domain):

```js
window.ESCROW_CONFIG = {
  rpc: "https://api.devnet.solana.com",   // mainnet: flip at launch (GATE 1 in mainnet_go.sh)
  program: "2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ",
  campaign: "send-climbing",
  mint: "CXBXU8sX8H9fvdgVGz2s2bKYZrbvWr6rW9SzhU9ymk2T" // devnet demo mint; mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
};
```

Program ID `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` — the clean-chain
deployment, binary pinned in `DEPLOY.md`, scenario proofs in
`../REHEARSALS.md`. (Old head-count-model ID `42P4j432…` is DEPRECATED — this
dollar-weighted v4 is a fresh clean-chain deployment.)

## Accounts (PDAs, derived client-side)

| Account | Seeds | What |
|---------|-------|------|
| Campaign | `["campaign", campaign_id_utf8]` | all public state (layout below) |
| Vault | `["vault", campaign]` | program-owned USDC pool |
| Badge (receipt) | `["receipt", campaign, depositor]` | per-wallet lock record + both ballots |

## Campaign account layout (borsh, after the 8-byte discriminator, little-endian)

```
offset 8    admin        Pubkey (32)
offset 40   mint         Pubkey (32)
offset 72   campaign_id  u32 len L + L bytes   <- variable; shifts fields below
+0          deadline           i64
+8          total_escrowed     u64
+16         depositor_count    u32
+20         tier_counts        [u32; 3]   ($20 / $100 / $1000 depositors)
+32         dissolve_amount    u64   (USDC base units backing dissolve — DOLLAR-weighted)
+40         proposed_payout    Pubkey (32; all-zeros = never proposed)
+72         proposal_id        u32   (epoch; 0 = none)
+76         payout_vote_amount u64   (USDC base units backing the CURRENT epoch)
+84         dissolved          u8
+85         released           u8
+86         bump               u8
```

Votes are DOLLAR-WEIGHTED: `dissolve_amount` / `payout_vote_amount` are u64 sums
of USDC base units, and a strict majority is `tally * 2 > total_escrowed`.

Badge layout (86 bytes): `8 disc | 32 campaign | 32 depositor | 8 amount |
1 voted | 4 payout_voted_seq | 1 bump`. Vote weight = `amount`. The wallet's
payout vote counts only while `payout_voted_seq == campaign.proposal_id`.

## Instruction encodings (sha256("global:<name>")[0..8]; no IDL needed)

| Instruction | Discriminator | Args |
|-------------|---------------|------|
| `deposit` | `[242,35,198,137,82,225,242,182]` | `amount: u64 LE` — must be exactly 20e6 / 100e6 / 1000e6 |
| `vote_dissolve` | `[180,224,232,226,59,166,81,63]` | none |
| `unvote_dissolve` | `[244,70,201,208,63,92,167,83]` | none |
| `vote_payout` | `[253,223,29,124,122,195,50,5]` | none |
| `unvote_payout` | `[93,70,124,191,216,185,62,248]` | none |
| `propose_payout` | `[200,59,138,55,239,125,31,165]` | `payout: Pubkey (32)` — organizer-only |
| `release` | `[253,249,15,206,28,127,193,241]` | none — permissionless once the dual gate stands (and only before the deadline) |
| `refund` | `[2,96,183,251,63,208,46,46]` | none — permissionless crank, open only post-dissolution/post-deadline |

**Names are OFF-chain by policy** (privacy: never publish a name↔wallet link
someone didn't publish themselves). The deposit transaction is exactly the
audited shape — no extra instructions, ever. After a confirmed deposit, an
optional inline "Who are you?" field background-POSTs (fetch, mode no-cors,
fire-and-forget) to a private Google Forms `formResponse` endpoint with two
entry params: the typed name (control-chars stripped, 100-char cap) and the
wallet address. Config: `ESCROW_CONFIG.nameForm = { endpoint, nameEntry,
walletEntry }` — while `endpoint` is empty the field is hidden entirely.
The visible privacy line ships with the field: "Names live in a private list
held by the organizer — nothing but your deposit ever touches the chain."

Account orders (all in `deposit.js` already):
- `deposit`: depositor (signer, w) · campaign (w) · vault (w) · depositor's
  USDC ATA (w) · badge PDA (w) · Token program · System program. Prepend a
  create-ATA-idempotent instruction (data `[1]`, ATA program) as demo.html does.
- votes (`vote_*`/`unvote_*`): depositor (signer) · campaign (w) · badge (w).
- `refund`: cranker (signer) · depositor (w, receives badge rent) · campaign
  (w) · vault (w) · depositor's USDC ATA (w) · badge (w) · Token program.

## UI state machine (what deposit.js implements — keep parity)

1. **No injected wallet** (plain mobile browser): show Phantom/Solflare
   universal links that reopen the same URL inside the wallet's browser.
2. **Connected, no badge**: show the three tier buttons (V1/V5/V10) + the
   locked-pool fine print. There is NO withdraw button anywhere.
3. **Connected, badge exists**: show "Supporter Badge — $X locked in the
   pool ✓", the Discord wayfinding line ("NS Discord → #discussion →
   send-climbing" — URL comes from `ESCROW_CONFIG.discordThread` when set,
   plain text until then), the locked note, the quiet dissolve-vote link with
   live votes/threshold, and — when a payout proposal is live — the payout
   panel's Vote/Unvote button plus a smaller Discord line for voters.
4. **Dissolved**: badge holders see "refunds open; anyone can crank them".
   **Released**: counter says so; everything else inert.

Counter line format: `"N × V1 · N × V5 · N × V10 · $TOTAL raised"` (+ state
suffix). No goal, no percent — there is no goal in the program.

## Admin / ops (organizer only, CLI)

```bash
# create a campaign (organizer key required by the program)
CAMPAIGN_ID=… DEADLINE_DAYS=180 USDC_MINT=… npx ts-node scripts/init_campaign.ts
# propose / release / status
CAMPAIGN_ID=… ACTION=propose PAYOUT=<pubkey> npx ts-node scripts/admin.ts
CAMPAIGN_ID=… ACTION=release PAYOUT_TOKEN=<usdc-ata-of-proposed> npx ts-node scripts/admin.ts
CAMPAIGN_ID=… ACTION=status npx ts-node scripts/admin.ts
# crank refunds (anyone) once dissolution/deadline opens them
CAMPAIGN_ID=… USDC_MINT=… DEPOSITOR_WALLET_FILE=… npx ts-node scripts/refund_crank.ts
```

Release destination must be a USDC token account owned by exactly the
proposed address — the program rejects everything else, before handler code
runs.
