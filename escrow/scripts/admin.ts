/* Admin ops: status / approve / release.
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
 *   CAMPAIGN_ID=ns-climbing-wall ACTION=status npx ts-node scripts/admin.ts
 *
 * ACTION=status   — print full campaign state (anyone)
 * ACTION=approve  — admin greenlight co-sign (wallet must be campaign admin)
 * ACTION=release  — execute release (anyone; program enforces goal + approval);
 *                   needs BUILDOUT_TOKEN=<USDC token account owned by buildout>
 */
import * as anchor from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow;

  const id = process.env.CAMPAIGN_ID || "ns-climbing-wall";
  const action = process.env.ACTION || "status";
  const [campaign] = PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), Buffer.from(id)], program.programId);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), campaign.toBuffer()], program.programId);

  if (action === "approve") {
    const sig = await program.methods.approveRelease().accounts({
      admin: provider.wallet.publicKey,
      campaign,
    }).rpc();
    console.log("approved:", sig);
  } else if (action === "release") {
    const buildoutToken = new PublicKey(process.env.BUILDOUT_TOKEN!);
    const sig = await program.methods.release().accounts({
      executor: provider.wallet.publicKey,
      campaign, vault,
      buildoutToken,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    }).rpc();
    console.log("released:", sig);
  }

  const c = await (program.account as any).campaign.fetch(campaign);
  console.log({
    campaign: campaign.toBase58(),
    admin: c.admin.toBase58(),
    mint: c.mint.toBase58(),
    buildout: c.buildout.toBase58(),
    goal: c.goal.toString(),
    tierCounts: c.tierCounts,
    deadline: new Date(c.deadline.toNumber() * 1000).toISOString(),
    totalEscrowed: c.totalEscrowed.toString(),
    depositorCount: c.depositorCount,
    approved: c.approved,
    released: c.released,
  });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
