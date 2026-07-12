// NS-climbing escrow — deposit transaction builder, ported VERBATIM from the
// audited escrow/web/deposit.js. The on-chain program is IMMUTABLE, so this
// instruction shape is fixed: depositor signs, USDC moves from the depositor's
// ATA into the vault, a receipt PDA (badge + vote + refund) is minted for the
// depositor, and the depositor pays the receipt/ATA rent.
//
// The ONLY change vs the wallet-extension path: the fee payer is a relayer (not
// the depositor), and we prepend a SystemProgram.transfer(relayer -> depositor)
// so a zero-SOL Privy embedded wallet can still cover the rent the contract
// hard-codes to `payer = depositor`. Order matters: the transfer runs first.
import {
  PublicKey, Transaction, TransactionInstruction, SystemProgram,
} from "@solana/web3.js";

export const TOKEN_PID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ATA_PID   = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// anchor discriminator for `deposit(amount: u64)` (from deposit.js:38)
const DISC_DEPOSIT = Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]);

const enc = new TextEncoder();

export function campaignPda(programId, campaignId) {
  return PublicKey.findProgramAddressSync(
    [enc.encode("campaign"), enc.encode(campaignId)], programId)[0];
}
export function vaultPda(programId, campaign) {
  return PublicKey.findProgramAddressSync(
    [enc.encode("vault"), campaign.toBytes()], programId)[0];
}
export function receiptPda(programId, campaign, depositor) {
  return PublicKey.findProgramAddressSync(
    [enc.encode("receipt"), campaign.toBytes(), depositor.toBytes()], programId)[0];
}
export function ata(owner, mint) {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PID.toBytes(), mint.toBytes()], ATA_PID)[0];
}

function depositData(usd) {
  // 8-byte disc + u64 LE amount at 6 decimals (USDC)
  const data = new Uint8Array(16);
  data.set(DISC_DEPOSIT, 0);
  new DataView(data.buffer).setBigUint64(8, BigInt(usd) * 1_000_000n, true);
  return data;
}

// createAssociatedTokenAccountIdempotent (data = [1]) — safe if the ATA exists.
function createAtaIdempotentIx(payer, owner, mint) {
  const myAta = ata(owner, mint);
  return new TransactionInstruction({
    programId: ATA_PID,
    keys: [
      { pubkey: payer,  isSigner: true,  isWritable: true },
      { pubkey: myAta,  isSigner: false, isWritable: true },
      { pubkey: owner,  isSigner: false, isWritable: false },
      { pubkey: mint,   isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PID, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from([1]),
  });
}

// The exact `deposit` instruction (deposit.js:455). depositor is signer+writable
// (it pays the receipt rent); accounts order matches the Anchor Deposit struct.
function depositIx({ programId, campaign, vault, depositor, mint, usd }) {
  const myAta = ata(depositor, mint);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: depositor, isSigner: true,  isWritable: true },
      { pubkey: campaign,  isSigner: false, isWritable: true },
      { pubkey: vault,     isSigner: false, isWritable: true },
      { pubkey: myAta,     isSigner: false, isWritable: true },
      { pubkey: receiptPda(programId, campaign, depositor), isSigner: false, isWritable: true },
      { pubkey: TOKEN_PID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: depositData(usd),
  });
}

// Rent buffer the relayer gifts the depositor so a zero-SOL embedded wallet can
// pay the ATA (~0.00204 SOL) + receipt PDA (~0.0015 SOL) rent the contract
// charges to `payer = depositor`. ~0.005 SOL leaves margin; unused lamports stay
// in the user's own wallet.
export const RENT_GIFT_LAMPORTS = 5_000_000; // 0.005 SOL

/**
 * Build the unsigned deposit Transaction for the relayer-sponsored flow.
 * @returns {Transaction} feePayer=relayer, needs BOTH relayer (feePayer + transfer)
 *          and depositor (embedded wallet) signatures. Client partial-signs with
 *          the embedded wallet, relayer co-signs + broadcasts.
 */
export function buildDepositTx({
  programId, campaignId, mint, depositor, relayer, usd, recentBlockhash,
}) {
  const pid = new PublicKey(programId);
  const mintPk = new PublicKey(mint);
  const dep = new PublicKey(depositor);
  const relay = new PublicKey(relayer);
  const campaign = campaignPda(pid, campaignId);
  const vault = vaultPda(pid, campaign);

  const tx = new Transaction();
  tx.feePayer = relay;
  tx.recentBlockhash = recentBlockhash;
  // 1) relayer gifts rent so the zero-SOL embedded wallet can cover it
  tx.add(SystemProgram.transfer({
    fromPubkey: relay, toPubkey: dep, lamports: RENT_GIFT_LAMPORTS,
  }));
  // 2) ensure the depositor's USDC ATA exists (idempotent), depositor pays
  tx.add(createAtaIdempotentIx(dep, dep, mintPk));
  // 3) the audited deposit instruction
  tx.add(depositIx({ programId: pid, campaign, vault, depositor: dep, mint: mintPk, usd }));
  return tx;
}
