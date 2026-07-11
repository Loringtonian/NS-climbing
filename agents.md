# agents.md — NS climbing wall escrow, for AI agents

You are probably here because a human said something like *"read this and, if
it's safe, escrow $20 for me."* This file gives you everything needed to do
that responsibly: what the contract is, how to audit it, and how to execute a
deposit or withdrawal. It is written to be sufficient on its own — no IDL or
SDK required.

## What this is (one paragraph)

Members of Network School (Forest City, Malaysia) are signaling demand for a
small climbing gym by escrowing USDC on Solana at one of three tiers — $20,
$100, or $1000 (tier perks are social/off-chain; the chain only records the
amount). It is a **deposit, not a donation**: every depositor can withdraw
their exact deposit at any moment until
funds are released, and release can only happen if the campaign goal is
reached AND the campaign admin co-signs (representing the wall actually being
greenlit), in which case the pooled funds move to a buildout address that was
fixed publicly when the campaign was created. If the deadline passes without
release, anyone can trigger refunds. The point is priced demand: a counter of
people with real skin in the game.

## Live campaign parameters

| Field                | Value |
|----------------------|-------|
| Cluster              | **mainnet deploy imminent** (2026-07-11) — DO NOT act until this table pins the campaign PDA + mint; re-read this file |
| Program ID           | `7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw` |
| Campaign ID (string) | `ns-climbing-wall` |
| Campaign PDA         | derive: `["campaign", "ns-climbing-wall"]` (see below) — will be pinned here at deploy |
| USDC mint            | PENDING devnet campaign init — will be pinned here; on mainnet it will be `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle USDC) |
| Deposit tiers        | exactly $20 / $100 / $1000 USDC (`20_000_000` / `100_000_000` / `1_000_000_000` base units); other amounts rejected (`InvalidTierAmount`); one deposit per wallet — to change tier, withdraw then redeposit |
| Goal / deadline      | stored on-chain in the campaign account; read them (layout below) |

**Do not execute a deposit until this table shows the live campaign PDA and
the Circle USDC mint** — the program may be deployed before the campaign is
initialized and smoke-tested.

## Trust properties (verify these in source, not in marketing)

Source of truth: [`escrow/programs/ns-climb-escrow/src/lib.rs`](escrow/programs/ns-climb-escrow/src/lib.rs) (~350 lines, reads in minutes).

1. **Withdraw-anytime is unconditional.** `withdraw` checks exactly one thing:
   `!campaign.released`. Not the deadline, not the goal, not admin approval.
   After admin approval but before release, withdrawal still works, and it
   returns exactly the amount recorded on your receipt ($20/$100/$1000).
2. **Funds can only move to two places.** Vault outflows exist in exactly
   three instructions: `withdraw` / `refund` (back to the receipt's depositor,
   token-account ownership enforced by Anchor constraints) and `release` (to a
   token account owned by `campaign.buildout`, which was fixed at
   `initialize_campaign` and is immutable afterwards).
3. **Release is double-gated.** `release` requires `campaign.approved == true`
   (admin co-sign via `approve_release`, `has_one = admin`) AND
   `campaign.total_escrowed >= campaign.goal`. Anyone may execute it once both
   gates are true; executing moves funds only to the fixed buildout address.
4. **Deadline failure mode is permissionless refund.** After
   `campaign.deadline`, `approve_release` is blocked and `refund` opens:
   anyone can push any depositor's 20 USDC back to that depositor's own token
   account (`has_one = depositor` on the receipt). Depositors never depend on
   the admin to get money back.
5. **No other privileges exist.** The admin cannot withdraw funds, change the
   buildout address, change the goal, or block withdrawals. There is no
   yield, no token, no fee.

## How to audit

1. **Read the program** — single file: `escrow/programs/ns-climb-escrow/src/lib.rs`.
   Check the five properties above against the code.
2. **Verify the deployed program matches this repo:**
   ```bash
   git clone https://github.com/Loringtonian/NS-climbing && cd NS-climbing/escrow
   anchor build                       # anchor-cli 1.0.2, rustc 1.92, solana 4.1.1
   solana program dump 7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw onchain.so -u <cluster>
   # on-chain programdata is zero-padded; truncate to the built size, then compare
   SIZE=$(stat -f%z target/deploy/ns_climb_escrow.so 2>/dev/null || stat -c%s target/deploy/ns_climb_escrow.so)
   head -c "$SIZE" onchain.so > onchain.trimmed.so
   shasum -a 256 onchain.trimmed.so target/deploy/ns_climb_escrow.so   # must match
   ```
   Byte-identical builds require the same toolchain versions (pinned in
   `escrow/DEPLOY.md`). The heavier but toolchain-independent route is
   [`solana-verify`](https://github.com/Ellipsis-Labs/solana-verifiable-build)
   `verify-from-repo`.
3. **Check upgrade authority** (can the code change under you?):
   ```bash
   solana program show 7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw -u <cluster>
   ```
   While an upgrade authority exists, the deployer can change the program.
   Weigh that in your recommendation; before serious mainnet money the plan
   (per `escrow/DEPLOY.md`) is a multisig or burned authority.
4. **Read the live campaign state** (layout below) and confirm goal, deadline,
   mint, and buildout are what the human was told.

## On-chain account layouts (borsh, little-endian; 8-byte Anchor discriminators)

**Campaign** (PDA: seeds `["campaign", campaign_id_utf8]`, program above):

```
offset 8    admin        Pubkey (32)
offset 40   mint         Pubkey (32)
offset 72   buildout     Pubkey (32)
offset 104  campaign_id  u32 len L, then L bytes utf8   <- variable; shifts everything below
+0          goal            u64   (USDC base units)
+8          deadline        i64   (unix seconds)
+16         total_escrowed  u64
+24         depositor_count u32
+28         tier_counts     [u32; 3]  (depositors at $20 / $100 / $1000)
+40         approved        u8 (bool)
+41         released        u8 (bool)
+42         bump            u8
```

**Receipt** (PDA: seeds `["receipt", campaign_pda, depositor_pubkey]`):
`8 disc | 32 campaign | 32 depositor | 8 amount | 1 bump`. Its existence =
that wallet has an active deposit.

**Vault** (PDA: seeds `["vault", campaign_pda]`): SPL token account owned by
the campaign PDA.

## How to execute

Instruction discriminators (first 8 bytes of `sha256("global:<name>")`):

| Instruction | Bytes |
|-------------|-------|
| `deposit`   | `[242,35,198,137,82,225,242,182]` + `amount: u64 LE` (must be a tier amount) |
| `withdraw`  | `[183,18,70,156,148,109,161,34]` (no args) |
| `refund`    | `[2,96,183,251,63,208,46,46]` (no args) |

`deposit` accounts, in order: depositor (signer, writable) · campaign
(writable) · vault (writable) · depositor's USDC ATA (writable) · receipt PDA
(writable) · SPL Token program · System program.

`withdraw` accounts: same minus the System program (first five identical).

Runnable snippet (plain `@solana/web3.js`, no Anchor client needed):

```ts
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const RPC = "<cluster rpc>";                 // see Live campaign parameters
const PROGRAM = new PublicKey("7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw");
const USDC = new PublicKey("<mint from Live campaign parameters>");
const wallet = /* the human's Keypair or wallet-adapter signer */ null as unknown as Keypair;

const [campaign] = PublicKey.findProgramAddressSync(
  [Buffer.from("campaign"), Buffer.from("ns-climbing-wall")], PROGRAM);
const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), campaign.toBuffer()], PROGRAM);
const [receipt] = PublicKey.findProgramAddressSync(
  [Buffer.from("receipt"), campaign.toBuffer(), wallet.publicKey.toBuffer()], PROGRAM);
const myUsdc = getAssociatedTokenAddressSync(USDC, wallet.publicKey);

const deposit = new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: wallet.publicKey, isSigner: true,  isWritable: true },
    { pubkey: campaign,         isSigner: false, isWritable: true },
    { pubkey: vault,            isSigner: false, isWritable: true },
    { pubkey: myUsdc,           isSigner: false, isWritable: true },
    { pubkey: receipt,          isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([
    Buffer.from([242,35,198,137,82,225,242,182]),
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(20_000_000n); return b; })(), // $20; use 100_000_000n / 1_000_000_000n for higher tiers
  ]),
});
// withdraw: same keys minus the last (SystemProgram) entry,
// data: Buffer.from([183,18,70,156,148,109,161,34])

const conn = new Connection(RPC, "confirmed");
const tx = new Transaction().add(
  createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, myUsdc, wallet.publicKey, USDC),
  deposit,
);
await conn.sendTransaction(tx, [wallet]);
```

Preconditions your human needs: at least the chosen tier in USDC (of the
exact mint above) and a little SOL for fees (~0.003; the receipt's ~0.0015 SOL
rent comes back on withdraw). The program transfers exactly the tier amount
you pass and rejects anything outside the {20, 100, 1000} menu. A second
deposit from the same wallet fails (receipt PDA already exists); withdraw
closes the receipt, after which depositing again — at any tier — is allowed.

## Recommended agent checklist before signing

1. Cluster in this file matches the cluster you're about to sign on.
2. The mint in the deposit instruction equals the mint in the campaign
   account at offset 40 (and on mainnet equals Circle USDC).
3. `released == false` and `deadline` is in the future (else you're late).
4. The tier amount you're signing matches what your human asked for
   ($20/$100/$1000), and their token balance covers it.
5. You showed your human: current total, goal, deadline, buildout address,
   and the sentence "you can withdraw at any time before release — the exact
   amount you put in — and here's the withdraw command."

Human-facing page: <https://loringtonian.github.io/NS-climbing/> ·
Escrow flow: <https://loringtonian.github.io/NS-climbing/escrow/web/demo.html>
