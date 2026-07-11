// End a live cheer session: undelegate the board (commits the final tally to
// the base layer) and print it. Reads .board.json written by init_board.cjs.

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://api.devnet.solana.com";
const ER_URL = process.env.ER_URL || "https://devnet-router.magicblock.app";

async function main() {
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/ns_cheer.json"), "utf8"));
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, "../.board.json"), "utf8"));
  const board = new PublicKey(saved.board);
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")))
  );
  const er = new anchor.Program(
    idl,
    new anchor.AnchorProvider(new Connection(ER_URL, "confirmed"), new anchor.Wallet(kp), { commitment: "confirmed" })
  );
  const base = new anchor.Program(
    idl,
    new anchor.AnchorProvider(new Connection(BASE_URL, "confirmed"), new anchor.Wallet(kp), { commitment: "confirmed" })
  );

  const sig = await er.methods.undelegateBoard().accounts({ payer: kp.publicKey, board }).rpc();
  console.log("undelegated:", sig);
  await new Promise((r) => setTimeout(r, 5000));
  const b = await base.account.board.fetch(board);
  console.log("final tally on base layer:", b.cheers.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
