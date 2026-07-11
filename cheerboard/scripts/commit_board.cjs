// "Bank the cheers" — push the live tally to the Solana base layer WITHOUT
// undelegating. The board stays on the ER and the button keeps working; run
// this as often as you like mid-session (e.g. between promo pushes).
//
//   node scripts/commit_board.cjs                 # board from .board.json
//   BOARD=<pda> node scripts/commit_board.cjs     # explicit board
//
// Contrast with end_board.cjs, which undelegates (final commit, board leaves
// the ER, cheering stops until re-delegated).

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://api.devnet.solana.com";
const ER_URL = process.env.ER_URL || "https://devnet-router.magicblock.app";
const DELEGATION_PROGRAM = "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";

async function main() {
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/ns_cheer.json"), "utf8"));
  const board = new PublicKey(
    process.env.BOARD ||
      JSON.parse(fs.readFileSync(path.join(__dirname, "../.board.json"), "utf8")).board
  );
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")))
  );
  const wallet = new anchor.Wallet(kp);
  const baseConn = new Connection(BASE_URL, "confirmed");
  const er = new anchor.Program(idl, new anchor.AnchorProvider(new Connection(ER_URL, "confirmed"), wallet, { commitment: "confirmed" }));
  const base = new anchor.Program(idl, new anchor.AnchorProvider(baseConn, wallet, { commitment: "confirmed" }));

  const before = await er.account.board.fetch(board);
  console.log(`board ${board.toBase58()}`);
  console.log(`ER tally now: ${before.cheers.toString()}`);

  const sig = await er.methods.commitBoard().accounts({ payer: kp.publicKey, board }).rpc();
  console.log(`commit_board (ER): ${sig}`);

  await new Promise((r) => setTimeout(r, 8000));
  const after = await base.account.board.fetch(board);
  const owner = (await baseConn.getAccountInfo(board)).owner.toBase58();
  console.log(`BASE tally: ${after.cheers.toString()}`);
  console.log(`still delegated: ${owner === DELEGATION_PROGRAM ? "YES" : "NO (owner " + owner + ")"} — button keeps working`);
}

main().catch((e) => { console.error(e); process.exit(1); });
