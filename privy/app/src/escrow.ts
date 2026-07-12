// Client-side deposit builder for the SELF-PAID flow: the embedded wallet is the
// sole signer AND fee-payer (after the relayer tops it up with SOL). This makes
// the tx fully self-contained, so Privy's confirmation modal can simulate it
// cleanly (real amount + fee) — no relayer co-signature to wait on.
// Instruction shape ported verbatim from the audited escrow/web/deposit.js.
import {
  PublicKey, TransactionInstruction, SystemProgram,
  TransactionMessage, VersionedTransaction, Connection,
} from "@solana/web3.js";

const TOKEN_PID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const DISC_DEPOSIT = Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]);
const enc = new TextEncoder();

const campaignPda = (pid: PublicKey, id: string) =>
  PublicKey.findProgramAddressSync([enc.encode("campaign"), enc.encode(id)], pid)[0];
const vaultPda = (pid: PublicKey, camp: PublicKey) =>
  PublicKey.findProgramAddressSync([enc.encode("vault"), camp.toBytes()], pid)[0];
const receiptPda = (pid: PublicKey, camp: PublicKey, dep: PublicKey) =>
  PublicKey.findProgramAddressSync([enc.encode("receipt"), camp.toBytes(), dep.toBytes()], pid)[0];
const ata = (owner: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN_PID.toBytes(), mint.toBytes()], ATA_PID)[0];

function depositData(usd: number) {
  const data = new Uint8Array(16);
  data.set(DISC_DEPOSIT, 0);
  new DataView(data.buffer).setBigUint64(8, BigInt(usd) * 1_000_000n, true);
  return data;
}
function createAtaIdempotentIx(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ATA_PID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PID, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from([1]),
  });
}

export async function buildSelfPaidDepositTx(
  conn: Connection,
  opts: { programId: string; campaignId: string; mint: string; depositor: string; usd: number }
): Promise<VersionedTransaction> {
  const pid = new PublicKey(opts.programId);
  const mint = new PublicKey(opts.mint);
  const dep = new PublicKey(opts.depositor);
  const camp = campaignPda(pid, opts.campaignId);
  const vault = vaultPda(pid, camp);
  const myAta = ata(dep, mint);

  const depositIx = new TransactionInstruction({
    programId: pid,
    keys: [
      { pubkey: dep, isSigner: true, isWritable: true },
      { pubkey: camp, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: myAta, isSigner: false, isWritable: true },
      { pubkey: receiptPda(pid, camp, dep), isSigner: false, isWritable: true },
      { pubkey: TOKEN_PID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: depositData(opts.usd),
  });

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: dep,                       // embedded wallet pays its own (topped-up) gas
    recentBlockhash: blockhash,
    instructions: [createAtaIdempotentIx(dep, dep, mint), depositIx],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}
