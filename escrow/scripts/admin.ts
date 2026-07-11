/* Admin ops: status / approve / release.
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
 *   CAMPAIGN_ID=ns-climbing-wall ACTION=status npx ts-node scripts/admin.ts
 *
 * ACTION=status   — print full campaign state (anyone)
 * ACTION=propose  — organizer proposes a payout address (PAYOUT=<pubkey>); resets payout votes
 * ACTION=release  — execute release (anyone; program enforces proposal + majority);
 *                   needs PAYOUT_TOKEN=<USDC token account owned by the proposed address>
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

  if (action === "propose") {
    const payout = new PublicKey(process.env.PAYOUT!);
    const sig = await program.methods.proposePayout(payout).accounts({
      admin: provider.wallet.publicKey,
      campaign,
    }).rpc();
    console.log("proposed payout", payout.toBase58() + ":", sig);
  } else if (action === "release") {
    const payoutToken = new PublicKey(process.env.PAYOUT_TOKEN!);
    const sig = await program.methods.release().accounts({
      executor: provider.wallet.publicKey,
      campaign, vault,
      payoutToken,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    }).rpc();
    console.log("released:", sig);
  }

  const c = await (program.account as any).campaign.fetch(campaign);
  console.log({
    campaign: campaign.toBase58(),
    admin: c.admin.toBase58(),
    mint: c.mint.toBase58(),

    tierCounts: c.tierCounts,
    deadline: new Date(c.deadline.toNumber() * 1000).toISOString(),
    totalEscrowed: c.totalEscrowed.toString(),
    depositorCount: c.depositorCount,
    proposedPayout: c.proposedPayout.toBase58(),
    proposalId: c.proposalId,
    payoutVotes: c.payoutVotes,
    released: c.released,
  });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
