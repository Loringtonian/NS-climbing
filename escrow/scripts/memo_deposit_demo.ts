import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as fs from "fs";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow;
  const conn = provider.connection;
  const admin = (provider.wallet as any).payer as Keypair;
  const mint = new PublicKey(process.env.USDC_MINT!);

  const who = Keypair.generate();
  fs.writeFileSync("keys/demo3.json", JSON.stringify(Array.from(who.secretKey)), { mode: 0o600 });
  // gas + tokens from admin
  const tx0 = new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: who.publicKey, lamports: 0.02e9 }));
  await provider.sendAndConfirm(tx0);
  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, who.publicKey);
  await mintTo(conn, admin, mint, ata.address, admin, 20_000_000);

  const [campaign] = PublicKey.findProgramAddressSync([Buffer.from("campaign"), Buffer.from("ns-climbing-wall")], program.programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), campaign.toBuffer()], program.programId);
  const [receipt] = PublicKey.findProgramAddressSync([Buffer.from("receipt"), campaign.toBuffer(), who.publicKey.toBuffer()], program.programId);

  const depositIx = await program.methods.deposit(new BN(20_000_000)).accounts({
    depositor: who.publicKey, campaign, vault, depositorToken: ata.address, receipt,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }).instruction();
  const memoIx = new TransactionInstruction({
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    keys: [],
    data: Buffer.from("send-climbing: Demo Three", "utf8"),
  });
  const tx = new Transaction().add(depositIx, memoIx);
  tx.feePayer = who.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(who);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  console.log("memo-deposit sig:", sig);
  console.log("receipt:", receipt.toBase58());
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
