// Create + delegate a cheer board for a live session. Prints the board PDA
// and ready-to-open URLs for the phone page and the projector tally.
//
//   BASE_URL=http://localhost:8999 ER_URL=http://localhost:7799 \
//   ER_VALIDATOR=mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev node scripts/init_board.cjs
//
// End the session with scripts/end_board.cjs (undelegates, commits tally to base).

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://api.devnet.solana.com";
const ER_URL = process.env.ER_URL || "https://devnet-router.magicblock.app";
const ER_VALIDATOR = new PublicKey(process.env.ER_VALIDATOR || "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");

async function main() {
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/ns_cheer.json"), "utf8"));
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")))
  );
  const base = new anchor.Program(
    idl,
    new anchor.AnchorProvider(new Connection(BASE_URL, "confirmed"), new anchor.Wallet(kp), { commitment: "confirmed" })
  );

  const boardId = new anchor.BN(process.env.BOARD_ID || Date.now());
  const [board] = PublicKey.findProgramAddressSync(
    [Buffer.from("board"), boardId.toArrayLike(Buffer, "le", 8)],
    base.programId
  );

  await base.methods
    .initialize(boardId)
    .accounts({ board, authority: kp.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  await base.methods
    .delegateBoard(boardId)
    .accounts({ payer: kp.publicKey, pda: board, boardState: board })
    .remainingAccounts([{ pubkey: ER_VALIDATOR, isSigner: false, isWritable: false }])
    .rpc();

  // Persist for end_board.cjs
  fs.writeFileSync(path.join(__dirname, "../.board.json"), JSON.stringify({ boardId: boardId.toString(), board: board.toBase58() }));

  console.log("board PDA:", board.toBase58(), "(boardId", boardId.toString() + ", delegated to ER)");
  console.log("phone:     web/cheer.html?board=" + board.toBase58() + "&rpc=" + encodeURIComponent(ER_URL));
  console.log("projector: web/tally.html?board=" + board.toBase58() + "&rpc=" + encodeURIComponent(ER_URL));
}

main().catch((e) => { console.error(e); process.exit(1); });
