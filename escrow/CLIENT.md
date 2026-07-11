# CLIENT.md — how the petition page talks to the escrow

> **Working reference implementation: `web/demo.html`** (live at
> `/escrow/web/demo.html` on the Pages site, linked from the main page CTA).
> It already does: URL-param config (`?rpc= &program= &campaign= &mint=`),
> Phantom/Solflare universal-link handoff when no wallet is injected,
> receipt-existence-driven UI (deposited → badge + withdraw; not → deposit),
> and raw-instruction building with the discriminators below (no Anchor JS
> needed in the browser). `web/counter.js` takes the same URL params.
> Devnet campaign values land in `DEVNET_STATE.md` when `scripts/devnet_go.sh`
> runs (blocked on devnet SOL as of 2026-07-11 midday).

Program: `ns_climb_escrow` — ID `7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw`
(regenerate per DEPLOY.md if you redeploy fresh; the ID is the program keypair's pubkey).

The IDL (needed by any Anchor JS client) is at `target/idl/ns_climb_escrow.json`
after `anchor build`. Copy it next to the web code that needs it.

## Accounts you care about

| Account        | Address                                                            | What                              |
|----------------|--------------------------------------------------------------------|-----------------------------------|
| Campaign (PDA) | seeds `["campaign", <campaign_id>]`                                 | All counter state lives here      |
| Vault (PDA)    | seeds `["vault", campaign]`                                         | Program-owned USDC token account  |
| Receipt (PDA)  | seeds `["receipt", campaign, depositor]`                            | One per depositor; proof of deposit |

`scripts/init_campaign.ts` prints the campaign PDA when the campaign is created —
paste it into `web/counter.js` `CAMPAIGN_ADDRESS`.

## 1. Live counter (no wallet, no libraries)

`web/counter.js` — already written, dependency-free. It POSTs `getAccountInfo`
to the RPC and parses the Campaign account bytes directly. Page hookup:

```html
<div id="escrow-counter" class="fine"></div>
<script src="escrow/counter.js"></script>
```

Campaign byte layout (after Anchor's 8-byte discriminator), all little-endian:

```
offset 8    admin      32 bytes
offset 40   mint       32 bytes
offset 72   buildout   32 bytes
offset 104  campaign_id  4-byte len L + L bytes   (VARIABLE — offsets below shift by L)
+0          goal            u64
+8          deadline        i64
+16         total_escrowed  u64
+24         depositor_count u32
+28         tier_counts     [u32; 3]   ($20 / $100 / $1000 depositors)
+40         dissolve_votes  u32
+44         approved        u8 (bool)
+45         dissolved       u8 (bool)
+46         released        u8 (bool)
+47         bump            u8
```
Receipt/Badge: `8 disc | 32 campaign | 32 depositor | 8 amount | 1 voted | 1 bump`.
Vote instructions + full v2 semantics: agents.md.

Counter text: tier breakdown ("N supporters · M founders · K patrons") ·
`total_escrowed / 1e6` dollars · `total/goal` percent. Poll every 15s; keep
last state on RPC hiccups.

## 2. Deposit flow (phone-first — depositor is standing in front of you)

The realistic phone flow is **wallet-adapter in the mobile wallet's in-app
browser** (Phantom / Solflare both ship one). QR-code the page URL; the
depositor opens it inside their wallet app; the page builds one transaction:

1. (If missing) create the depositor's USDC ATA — usually exists if they hold USDC.
2. `deposit` instruction.

With Anchor JS — the Anchor 1.x TS client is **`@anchor-lang/core`** (the old
`@coral-xyz/anchor` package stops at 0.32.x and does not exist for 1.x):

```js
const provider = new anchor.AnchorProvider(connection, window.solana, {});
const program = new anchor.Program(idl, provider); // idl JSON, has the program id
const [campaign] = PublicKey.findProgramAddressSync(
  [Buffer.from("campaign"), Buffer.from(CAMPAIGN_ID)], program.programId);
const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), campaign.toBuffer()], program.programId);
const [receipt] = PublicKey.findProgramAddressSync(
  [Buffer.from("receipt"), campaign.toBuffer(), wallet.publicKey.toBuffer()],
  program.programId);
await program.methods.deposit().accounts({
  depositor: wallet.publicKey,
  campaign, vault,
  depositorToken: getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey),
  receipt,
  tokenProgram: TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
}).rpc();
```

Raw instruction encoding, if you skip Anchor JS: 8-byte discriminator =
first 8 bytes of `sha256("global:deposit")`, no args. Same pattern for
`withdraw` (`"global:withdraw"`). Account order exactly as in the structs in
`programs/ns-climb-escrow/src/lib.rs`.

`deposit` takes ONE argument, `amount: u64` (USDC base units), and the
program rejects anything but the tier menu: 20_000_000 / 100_000_000 /
1_000_000_000 ($20/$100/$1000, `TIER_AMOUNTS` in lib.rs). Instruction data =
8-byte discriminator + u64 LE amount. One deposit per wallet (the receipt PDA
enforces it); withdraw returns exactly the receipt's amount and closes it, so
a wallet can re-deposit at any tier (that's also the tier-upgrade path).
The campaign account carries `tier_counts: [u32;3]` for the counter's
"N supporters · M founders · K patrons" breakdown (layout in agents.md).

**Solana Pay**: a bare Solana Pay transfer QR moves USDC to an address — it
can NOT call a program, so a plain transfer QR would be a donation, not an
escrow. Use a Solana Pay **transaction request** (QR encodes a URL your server
returns the deposit tx from) only if you later host an endpoint; GitHub Pages
alone can't. The in-wallet-browser flow above needs no server.

## 3. Withdraw flow ("deposit, not donation" — show this button prominently)

Same shape as deposit, `program.methods.withdraw()`, accounts as in the
`Withdraw` struct (no `systemProgram` needed). Works at ANY time until funds
are released — enforced in the program (`withdraw` checks only `!released`),
not just hidden in the UI.

## 4. Admin ops (Lorin, CLI)

```bash
# create the campaign (prints campaign PDA for the page config)
CAMPAIGN_ID=ns-climbing-wall GOAL_USDC=2000 DEADLINE_DAYS=30 \
BUILDOUT=<buildout-wallet> USDC_MINT=<see DEPLOY.md> \
npx ts-node scripts/init_campaign.ts

# approve (greenlight co-sign), then release — via anchor console or a 5-line
# script mirroring init_campaign.ts with .approveRelease() / .release()
```

Release destination must be the USDC token account owned by the `buildout`
address fixed at init — the program rejects anything else.
