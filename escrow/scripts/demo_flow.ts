/* Devnet demo driver: deposit or withdraw as a locally-kept test wallet, so the
 * live counter can be watched ticking up/down without a phone wallet.
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
 *   CAMPAIGN_ID=ns-climbing-wall USDC_MINT=<demo mint> \
 *   ACTION=deposit WALLET_FILE=keys/demo1.json npx ts-node scripts/demo_flow.ts
 *
 * ACTION=deposit funds the wallet (SOL from admin + demo-USDC minted by admin)
 * then deposits. ACTION=withdraw withdraws. Wallet keypairs land in keys/
 * (gitignored); reused across runs.
 */
import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow;
  const conn = provider.connection;
  const admin = (provider.wallet as any).payer as Keypair;

  const id = process.env.CAMPAIGN_ID || "ns-climbing-wall";
  const mint = new PublicKey(process.env.USDC_MINT!);
  const action = process.env.ACTION || "deposit";
  const walletFile = process.env.WALLET_FILE || "keys/demo1.json";

  fs.mkdirSync(path.dirname(walletFile), { recursive: true });
  let who: Keypair;
  if (fs.existsSync(walletFile)) {
    who = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletFile, "utf8"))));
  } else {
    who = Keypair.generate();
    fs.writeFileSync(walletFile, JSON.stringify(Array.from(who.secretKey)), { mode: 0o600 });
  }
  console.log("demo wallet:", who.publicKey.toBase58());

  const [campaign] = PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), Buffer.from(id)], program.programId);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), campaign.toBuffer()], program.programId);
  const [receipt] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), campaign.toBuffer(), who.publicKey.toBuffer()], program.programId);

  const tokenAcct = await getOrCreateAssociatedTokenAccount(conn, admin, mint, who.publicKey);

  if (action === "deposit") {
    // gas from admin (devnet airdrops rate-limit; admin subsidizes)
    const bal = await conn.getBalance(who.publicKey);
    if (bal < 0.01e9) {
      const tx = new Transaction().add(SystemProgram.transfer({
        fromPubkey: admin.publicKey, toPubkey: who.publicKey, lamports: 0.02e9 }));
      await provider.sendAndConfirm(tx);
    }
    if (Number(tokenAcct.amount) < 20_000_000) {
      await mintTo(conn, admin, mint, tokenAcct.address, admin, 20_000_000);
    }
    const sig = await program.methods.deposit().accounts({
      depositor: who.publicKey,
      campaign, vault,
      depositorToken: tokenAcct.address,
      receipt,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([who]).rpc();
    console.log("deposited 20:", sig);
  } else {
    const sig = await program.methods.withdraw().accounts({
      depositor: who.publicKey,
      campaign, vault,
      depositorToken: tokenAcct.address,
      receipt,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    }).signers([who]).rpc();
    console.log("withdrew:", sig);
  }

  const c = await (program.account as any).campaign.fetch(campaign);
  console.log("state:", c.depositorCount, "people, total", c.totalEscrowed.toString(), "of goal", c.goal.toString());
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
