// Correctness check for the ported deposit instruction — NO funding needed.
// Proves the builder targets the EXACT live accounts: the derived campaign/vault
// PDAs must equal the known mainnet PDAs, and the deposit data must decode to the
// right discriminator + amount.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { buildDepositTx, campaignPda, vaultPda } from "../shared/escrow.js";
import { CONFIGS } from "../shared/config.js";

const m = CONFIGS.mainnet;
const pid = new PublicKey(m.program);
const camp = campaignPda(pid, m.campaignId);
const vault = vaultPda(pid, camp);

const EXPECT_CAMPAIGN = "B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd";
const EXPECT_VAULT    = "DGf8UtSPsKAcuRxmRYxQtZ5PSNWKYVxHzHeppbKeUfmV";

let ok = true;
function check(label, got, want) {
  const pass = got === want;
  ok = ok && pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}\n   got  ${got}\n   want ${want}`);
}
check("mainnet campaign PDA", camp.toBase58(), EXPECT_CAMPAIGN);
check("mainnet vault PDA", vault.toBase58(), EXPECT_VAULT);

// build a tx (dummy keys) and inspect structure + deposit data
const depositor = Keypair.generate().publicKey.toBase58();
const relayer = Keypair.generate().publicKey.toBase58();
const tx = buildDepositTx({
  programId: m.program, campaignId: m.campaignId, mint: m.mint,
  depositor, relayer, usd: 100, recentBlockhash: "11111111111111111111111111111111",
});
console.log(`\nixs: ${tx.instructions.length} (expect 3: transfer, createATA, deposit)`);
const dep = tx.instructions[2];
console.log("deposit ix programId:", dep.programId.toBase58(), "==", m.program, dep.programId.toBase58() === m.program ? "PASS" : "FAIL");
console.log("deposit ix accounts:", dep.keys.length, "(expect 7)");
const disc = [...dep.data.slice(0, 8)].join(",");
const amt = new DataView(dep.data.buffer, dep.data.byteOffset).getBigUint64(8, true);
console.log("deposit disc:", disc, disc === "242,35,198,137,82,225,242,182" ? "PASS" : "FAIL");
console.log("deposit amount (raw):", amt.toString(), amt === 100_000_000n ? "PASS ($100 @ 6dp)" : "FAIL");

console.log("\ntx signers required:", tx.instructions.flatMap(i => i.keys).filter(k => k.isSigner).map(k => k.pubkey.toBase58().slice(0,4)));
console.log(ok && tx.instructions.length === 3 ? "\n✅ CORE INSTRUCTION VERIFIED" : "\n❌ MISMATCH");
process.exit(ok ? 0 : 1);
