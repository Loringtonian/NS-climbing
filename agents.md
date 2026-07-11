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
| Goal                 | NONE — raise-as-much-as-possible mode; nothing gates on amount raised |
| Deadline             | stored on-chain (layout below); 90 days from init for this campaign |

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
   token account owned by exactly `campaign.proposed_payout` — an account
   constraint, checked before any handler code runs).
3. **Release is DUAL-GATED — organizer proposes, depositors dispose.** There
   is no goal and no pre-set destination. `propose_payout` is organizer-only
   (`has_one = admin`, and campaign creation is pinned to the ORGANIZER key);
   proposing or RE-proposing bumps a proposal epoch, which resets all payout
   votes (receipts vote per-epoch — stale votes stop counting). `release`
   requires a live proposal AND a strict head-count majority of CURRENT
   depositors (`payout_votes × 2 > depositor_count`). Neither side alone can
   move funds: the organizer has no votes to cast, and depositors cannot
   choose an address the organizer didn't propose. New deposits enlarge the
   electorate and can un-make a standing majority until they vote.
4. **Deadline failure mode is permissionless refund.** After
   `campaign.deadline`, `propose_payout` is blocked and `refund` opens:
   anyone can push any depositor's 20 USDC back to that depositor's own token
   account (`has_one = depositor` on the receipt). Depositors never depend on
   the admin to get money back.
5. **No other privileges exist.** The admin cannot withdraw funds, change the
   buildout address, change the goal, or block withdrawals. There is no
   yield, no transferable token, no fee.
6. **Depositor majority can dissolve.** Every deposit issues a **Supporter
   Badge** — the receipt PDA itself, non-transferable by construction (it is
   derived from the depositor's pubkey and no instruction can reassign it),
   serving simultaneously as proof-of-support and as the ballot. Any
   badge-holder may `vote_dissolve` (revocable via `unvote_dissolve` while
   active). A STRICT head-count majority (`votes * 2 > depositors`) flips the
   campaign to DISSOLVED — terminal: deposit, approval and release become
   permanently impossible and the permissionless `refund` crank opens
   immediately (no waiting for the deadline). Withdrawing removes the
   departing depositor's vote AND shrinks the electorate atomically, in the
   same instruction; the majority is always measured against CURRENT
   depositors, so votes standing while others leave can tip the threshold —
   deliberate: departures count as silence, not as "no" votes.

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
   Current, disclosed state: the upgrade authority is HELD BY THE ORGANIZER's
   key (`84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2`) and will be locked to
   a multisig or burned within a week of launch — run the command above to
   verify what it is RIGHT NOW rather than trusting this file. While an
   upgrade authority exists, the deployer can change the program; weigh that
   in your recommendation.
4. **Read the live campaign state** (layout below) and confirm goal, deadline,
   mint, and buildout are what the human was told.

## On-chain account layouts (borsh, little-endian; 8-byte Anchor discriminators)

**Campaign** (PDA: seeds `["campaign", campaign_id_utf8]`, program above):

```
offset 8    admin        Pubkey (32)
offset 40   mint         Pubkey (32)
offset 72   campaign_id  u32 len L, then L bytes utf8   <- variable; shifts everything below
+0          deadline        i64   (unix seconds)
+8          total_escrowed  u64   (USDC base units)
+16         depositor_count u32
+20         tier_counts     [u32; 3]  (depositors at $20 / $100 / $1000)
+32         dissolve_votes  u32
+36         proposed_payout Pubkey (32; all-zeros = never proposed)
+68         proposal_id     u32   (epoch; bumps per propose, 0 = none)
+72         payout_votes    u32   (yes-votes on the CURRENT epoch)
+76         dissolved       u8 (bool)  <- terminal; refunds open when 1
+77         released        u8 (bool)
+78         bump            u8
```

**Receipt / Supporter Badge** (PDA: seeds `["receipt", campaign_pda,
depositor_pubkey]`, 86 bytes): `8 disc | 32 campaign | 32 depositor |
8 amount | 1 voted | 4 payout_voted_seq | 1 bump`. Its existence = that
wallet has an active deposit; it IS the non-transferable supporter credential
and BOTH ballots (dissolve + current payout proposal).

**Vault** (PDA: seeds `["vault", campaign_pda]`): SPL token account owned by
the campaign PDA.

## How to execute

Instruction discriminators (first 8 bytes of `sha256("global:<name>")`):

| Instruction | Bytes |
|-------------|-------|
| `deposit`   | `[242,35,198,137,82,225,242,182]` + `amount: u64 LE` (must be a tier amount) |
| `withdraw`  | `[183,18,70,156,148,109,161,34]` (no args) |
| `refund`    | `[2,96,183,251,63,208,46,46]` (no args) |
| `vote_dissolve`   | `[180,224,232,226,59,166,81,63]` (no args) |
| `unvote_dissolve` | `[244,70,201,208,63,92,167,83]` (no args) |
| `vote_payout`     | `[253,223,29,124,122,195,50,5]` (no args) |
| `unvote_payout`   | `[93,70,124,191,216,185,62,248]` (no args) |
| `propose_payout`  | `[200,59,138,55,239,125,31,165]` + `payout: Pubkey (32)` — organizer-only |

`vote_dissolve` / `unvote_dissolve` / `vote_payout` / `unvote_payout`
accounts, in order: depositor (signer) · campaign (writable) · receipt PDA
(writable).

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
5. `dissolved == false` (a dissolved campaign takes no deposits; if your human
   already deposited, their money is refundable via withdraw or the crank).
5b. `campaign.admin` equals the organizer key
   `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2` (offset 8 — creation is
   program-restricted to it, so a mismatch means the wrong account). There is
   NO fixed destination: if your human plans to VOTE on a payout proposal,
   read `proposed_payout` from the campaign bytes and confirm it is the
   address they intend to approve — a majority vote is what authorizes the
   money to move there.
6. You showed your human: current total, goal, deadline, buildout address,
   and the sentences "you can withdraw at any time before release — the exact
   amount you put in" and "your deposit is also a ballot: a majority of
   depositors can dissolve the campaign and open refunds for everyone."

Human-facing page: <https://loringtonian.github.io/NS-climbing/> ·
Escrow flow: <https://loringtonian.github.io/NS-climbing/escrow/web/demo.html>
