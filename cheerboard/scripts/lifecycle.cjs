// Cheer-board ER lifecycle test: init(base) -> cheer(base sanity) ->
// delegate(base->ER) -> cheer-SPAM(ER, timed) -> read ER tally ->
// undelegate(ER->base) -> verify committed tally on base.
//
// Local rig (SETUP.md in Projects/PopUp_Markets — shared toolchain):
//   BASE_URL=http://localhost:8999 ER_URL=http://localhost:7799 \
//   ER_VALIDATOR=mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev node scripts/lifecycle.cjs
// Devnet: defaults below (router picks ER vs base per delegated accounts).

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://api.devnet.solana.com";
const ER_URL = process.env.ER_URL || "https://devnet-router.magicblock.app";
const ER_VALIDATOR = new PublicKey(process.env.ER_VALIDATOR || "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
const SPAM = parseInt(process.env.SPAM || "30", 10);

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

  console.log(`wallet ${kp.publicKey.toBase58()} base balance ${(await baseConn.getBalance(kp.publicKey)) / 1e9} SOL`);

  const boardId = new anchor.BN(Date.now());
  const [board] = PublicKey.findProgramAddressSync(
    [Buffer.from("board"), boardId.toArrayLike(Buffer, "le", 8)],
    base.programId
  );
  console.log(`boardId ${boardId.toString()} pda ${board.toBase58()}`);

  // 1. init — base
  let sig = await base.methods
    .initialize(boardId)
    .accounts({ board, authority: kp.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`1 initialize      (base) ${sig}`);

  // 2. one cheer on base while undelegated (sanity: program works without ER)
  sig = await base.methods
    .cheer(new anchor.BN(1))
    .accounts({ board, cheerer: kp.publicKey })
    .rpc();
  console.log(`2 cheer           (base) ${sig}`);

  // 3. delegate — base, pinned to the local/asia ER validator
  sig = await base.methods
    .delegateBoard(boardId)
    .accounts({ payer: kp.publicKey, pda: board, boardState: board })
    .remainingAccounts([{ pubkey: ER_VALIDATOR, isSigner: false, isWritable: false }])
    .rpc();
  console.log(`3 delegate_board  (base) ${sig}`);
  await new Promise((r) => setTimeout(r, 3000));

  // 4a. phone-case probe: can an UNFUNDED throwaway key cheer on the ER?
  const throwaway = Keypair.generate();
  const erThrow = new anchor.Program(
    idl,
    new anchor.AnchorProvider(erConn, new anchor.Wallet(throwaway), { commitment: "confirmed", skipPreflight: true })
  );
  let throwawayWorks = false;
  try {
    sig = await erThrow.methods
      .cheer(new anchor.BN(Date.now()))
      .accounts({ board, cheerer: throwaway.publicKey })
      .rpc();
    throwawayWorks = true;
    console.log(`4a cheer unfunded-throwaway (ER) WORKS ${sig}`);
  } catch (e) {
    console.log(`4a cheer unfunded-throwaway (ER) FAILED: ${String(e).split("\n")[0]}`);
    console.log(`   -> phone page must use a funded/relayed payer on this cluster`);
  }

  // 4b. cheer SPAM on the ER, timed (the "feels real-time" number)
  const t0 = Date.now();
  const sigs = [];
  for (let i = 0; i < SPAM; i++) {
    sigs.push(
      er.methods
        .cheer(new anchor.BN(t0 + i))
        .accounts({ board, cheerer: kp.publicKey })
        .rpc()
    );
  }
  await Promise.all(sigs);
  const ms = Date.now() - t0;
  console.log(`4b ${SPAM} cheers  (ER)   in ${ms}ms = ${((SPAM * 1000) / ms).toFixed(1)} cheers/sec`);

  // 5. read tally from ER
  const erBoard = await er.account.board.fetch(board);
  const expected = 1 + SPAM + (throwawayWorks ? 1 : 0);
  console.log(`5 ER tally = ${erBoard.cheers.toString()} (expected ${expected})`);

  // 6. undelegate — commits tally to base
  sig = await er.methods
    .undelegateBoard()
    .accounts({ payer: kp.publicKey, board })
    .rpc();
  console.log(`6 undelegate      (ER)   ${sig}`);
  await new Promise((r) => setTimeout(r, 5000));

  // 7. final read from BASE — proves the commit round-trip
  const baseBoard = await base.account.board.fetch(board);
  console.log(`7 BASE tally after undelegate = ${baseBoard.cheers.toString()} (expected ${expected})`);
  if (baseBoard.cheers.toString() !== String(expected)) throw new Error("BASE TALLY MISMATCH");
  console.log("LIFECYCLE OK");
}

main().catch((e) => {
  console.error("LIFECYCLE FAILED:", e);
  process.exit(1);
});
