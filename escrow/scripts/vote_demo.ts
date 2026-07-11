/* Cast / remove a dissolve vote as a scripted wallet (devnet rehearsals).
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
 *   CAMPAIGN_ID=<id> ACTION=vote|unvote WALLET_FILE=keys/demo1.json npx ts-node scripts/vote_demo.ts
 */
import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow;

  const id = process.env.CAMPAIGN_ID || "ns-climbing-wall-v2";
  const action = process.env.ACTION || "vote";
  const who = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.WALLET_FILE || "keys/demo1.json", "utf8")))
  );
  const [campaign] = PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), Buffer.from(id)], program.programId);
  const [receipt] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), campaign.toBuffer(), who.publicKey.toBuffer()], program.programId);

  const m = action === "vote" ? program.methods.voteDissolve() : program.methods.unvoteDissolve();
  const sig = await m
    .accounts({ depositor: who.publicKey, campaign, receipt })
    .signers([who])
    .rpc();
  console.log(`${action}:`, sig);

  const c = await (program.account as any).campaign.fetch(campaign);
  console.log("votes:", c.dissolveVotes, "of", c.depositorCount, "depositors — dissolved:", c.dissolved);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
