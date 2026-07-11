/* Initialize the campaign. Run with the provider wallet as admin:
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   CAMPAIGN_ID=ns-climbing-wall GOAL_USDC=2000 DEPOSIT_USDC=20 \
 *   DEADLINE_DAYS=30 BUILDOUT=<pubkey> USDC_MINT=<mint> \
 *   npx ts-node scripts/init_campaign.ts
 *
 * Prints the campaign PDA (paste into web/counter.js CAMPAIGN_ADDRESS).
 */
import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // Circle devnet USDC
const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Circle mainnet USDC

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow;

  const id = process.env.CAMPAIGN_ID || "ns-climbing-wall";
  const goal = new BN(Math.round(parseFloat(process.env.GOAL_USDC || "2000") * 1e6));
  const dep = new BN(Math.round(parseFloat(process.env.DEPOSIT_USDC || "20") * 1e6));
  const days = parseFloat(process.env.DEADLINE_DAYS || "30");
  const deadline = new BN(Math.floor(Date.now() / 1000) + Math.round(days * 86400));
  const buildout = new PublicKey(process.env.BUILDOUT || provider.wallet.publicKey);
  const mint = new PublicKey(process.env.USDC_MINT || DEVNET_USDC);

  const [campaign] = PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), Buffer.from(id)],
    program.programId
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), campaign.toBuffer()],
    program.programId
  );

  const sig = await program.methods
    .initializeCampaign(id, goal, dep, deadline, buildout)
    .accounts({
      admin: provider.wallet.publicKey,
      mint,
      campaign,
      vault,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log("tx:", sig);
  console.log("campaign PDA:", campaign.toBase58());
  console.log("vault PDA:", vault.toBase58());
  console.log("admin:", provider.wallet.publicKey.toBase58());
  console.log("buildout:", buildout.toBase58());
  console.log("mint:", mint.toBase58());
  console.log("goal:", goal.toString(), "deposit:", dep.toString(), "deadline:", deadline.toString());
  console.log("(mainnet USDC for reference:", MAINNET_USDC + ")");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
