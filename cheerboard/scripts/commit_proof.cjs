// Proof that commit_board banks the tally WITHOUT pausing the button, run on a
// throwaway board so the live one is never at risk.
//
//   node scripts/commit_proof.cjs
//
// init(base) -> delegate(ER) -> cheer x3 (ER) -> commit_board -> assert:
//   (a) base-layer tally == 3   (the number landed on Solana)
//   (b) base account still owned by the delegation program  (still delegated)
//   (c) more cheers on the ER still succeed and increment   (button never paused)
// then a second commit_board banks the higher number (repeatable), and finally
// undelegate to reclaim rent.

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://api.devnet.solana.com";
const ER_URL = process.env.ER_URL || "https://devnet-router.magicblock.app";
const ER_VALIDATOR = new PublicKey(process.env.ER_VALIDATOR || "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
const DELEGATION_PROGRAM = "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/ns_cheer.json"), "utf8"));
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")))
  );
  const wallet = new anchor.Wallet(kp);
  const baseConn = new Connection(BASE_URL, "confirmed");
  const erConn = new Connection(ER_URL, "confirmed");
  const base = new anchor.Program(idl, new anchor.AnchorProvider(baseConn, wallet, { commitment: "confirmed" }));
  const er = new anchor.Program(idl, new anchor.AnchorProvider(erConn, wallet, { commitment: "confirmed" }));

  const boardId = new anchor.BN(Date.now());
  const [board] = PublicKey.findProgramAddressSync(
    [Buffer.from("board"), boardId.toArrayLike(Buffer, "le", 8)],
    base.programId
  );
  console.log(`SCRATCH board ${board.toBase58()} (boardId ${boardId.toString()})`);

  let sig = await base.methods
    .initialize(boardId)
    .accounts({ board, authority: kp.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`1 initialize     (base) ${sig}`);

  sig = await base.methods
    .delegateBoard(boardId)
    .accounts({ payer: kp.publicKey, pda: board, boardState: board })
    .remainingAccounts([{ pubkey: ER_VALIDATOR, isSigner: false, isWritable: false }])
    .rpc();
  console.log(`2 delegate_board (base) ${sig}`);
  await sleep(3000);

  for (let i = 0; i < 3; i++) {
    sig = await er.methods.cheer(new anchor.BN(Date.now() + i)).accounts({ board, cheerer: kp.publicKey }).rpc();
  }
  console.log(`3 cheer x3       (ER)   ER tally = ${(await er.account.board.fetch(board)).cheers.toString()}`);

  const baseBefore = await base.account.board.fetch(board);
  console.log(`4 BASE tally BEFORE commit = ${baseBefore.cheers.toString()} (expect 0)`);

  sig = await er.methods.commitBoard().accounts({ payer: kp.publicKey, board }).rpc();
  console.log(`5 commit_board   (ER)   ${sig}`);
  await sleep(10000);

  // (a) the number landed on the base layer
  const baseAfter = await base.account.board.fetch(board);
  console.log(`   (a) BASE tally AFTER commit = ${baseAfter.cheers.toString()} (expect 3)`);
  if (baseAfter.cheers.toString() !== "3") throw new Error("(a) FAILED: base tally did not land");

  // (b) still delegated
  const owner = (await baseConn.getAccountInfo(board)).owner.toBase58();
  console.log(`   (b) base owner = ${owner} (expect ${DELEGATION_PROGRAM})`);
  if (owner !== DELEGATION_PROGRAM) throw new Error("(b) FAILED: board is no longer delegated");

  // (c) button never paused — ER still accepts cheers and increments
  for (let i = 0; i < 2; i++) {
    sig = await er.methods.cheer(new anchor.BN(Date.now() + 100 + i)).accounts({ board, cheerer: kp.publicKey }).rpc();
  }
  const erAfter = await er.account.board.fetch(board);
  console.log(`   (c) cheer x2 after commit OK — ER tally = ${erAfter.cheers.toString()} (expect 5), last sig ${sig}`);
  if (erAfter.cheers.toString() !== "5") throw new Error("(c) FAILED: ER stopped incrementing after commit");

  // repeatable: bank the higher number again, no undelegate
  sig = await er.methods.commitBoard().accounts({ payer: kp.publicKey, board }).rpc();
  console.log(`6 commit_board again (ER) ${sig}`);
  await sleep(10000);
  const base2 = await base.account.board.fetch(board);
  const owner2 = (await baseConn.getAccountInfo(board)).owner.toBase58();
  console.log(`   BASE tally after 2nd commit = ${base2.cheers.toString()} (expect 5); still delegated: ${owner2 === DELEGATION_PROGRAM}`);
  if (base2.cheers.toString() !== "5") throw new Error("2nd commit FAILED");
  if (owner2 !== DELEGATION_PROGRAM) throw new Error("2nd commit un-delegated the board");

  // cleanup: undelegate the scratch board (live board is never undelegated)
  sig = await er.methods.undelegateBoard().accounts({ payer: kp.publicKey, board }).rpc();
  console.log(`7 undelegate scratch (ER) ${sig}`);
  console.log("COMMIT PROOF OK — banks the tally, keeps the board delegated, button never pauses");
}

main().catch((e) => { console.error("COMMIT PROOF FAILED:", e); process.exit(1); });
