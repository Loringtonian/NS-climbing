/* Permissionless refund crank: push a depositor's escrow back to them after
 * the deadline or a dissolution. The provider wallet pays gas; tokens can only
 * go to the receipt's depositor.
 *
 *   ANCHOR_PROVIDER_URL=… ANCHOR_WALLET=… CAMPAIGN_ID=<id> USDC_MINT=<mint> \
 *   DEPOSITOR_WALLET_FILE=keys/demo1.json npx ts-node scripts/refund_crank.ts
 */
import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow;

  const id = process.env.CAMPAIGN_ID!;
  const mint = new PublicKey(process.env.USDC_MINT!);
  const depositor = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.DEPOSITOR_WALLET_FILE!, "utf8")))
  ).publicKey;

  const [campaign] = PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), Buffer.from(id)], program.programId);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), campaign.toBuffer()], program.programId);
  const [receipt] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), campaign.toBuffer(), depositor.toBuffer()], program.programId);

  const sig = await program.methods
    .refund()
    .accounts({
      cranker: provider.wallet.publicKey,
      depositor,
      campaign,
      vault,
      depositorToken: getAssociatedTokenAddressSync(mint, depositor),
      receipt,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("refunded", depositor.toBase58().slice(0, 8) + "…:", sig);
  const c = await (program.account as any).campaign.fetch(campaign);
  console.log("state:", c.depositorCount, "depositors, total", c.totalEscrowed.toString(), "dissolved:", c.dissolved);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
