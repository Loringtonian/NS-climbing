#!/usr/bin/env node
// Build web/leaderboard.json — the historical bulk of the cheer leaderboard.
//
// READ-ONLY against the chain. It sends no instruction, signs nothing, and
// touches no keypair: it walks the board account's transaction history on the
// Ephemeral Rollup, resolves who signed each cheer, and tallies per signer.
//
// The page (web/leaderboard.html) loads this snapshot and then fetches only the
// signatures NEWER than `latestSig` live, so the board is both instant and current.
//
// Refresh:  node cheerboard/scripts/build_leaderboard.cjs
//
// Every cheer is its own transaction signed by a throwaway browser keypair, and
// that pubkey is the pseudonymous identity here. Nothing else about a person is
// known to this script, or knowable from the chain.

const fs = require("fs");
const path = require("path");

const ER_URL = process.env.ER_URL || "https://devnet-router.magicblock.app";
const BASE_URL = process.env.BASE_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = "FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz";
const OUT = path.join(__dirname, "..", "web", "leaderboard.json");

// anchor discriminator for `cheer`, base58-encoded instruction data starts with these 8 bytes
const DISC_CHEER = [23, 127, 15, 40, 49, 42, 21, 88];

const BOARD =
  process.env.BOARD ||
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".board.json"), "utf8")).board;

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 255n));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return bytes;
}

async function rpc(url, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 429 || r.status >= 500) throw new Error("http " + r.status);
      return await r.json();
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
}

async function allSignatures(url, address) {
  const out = [];
  let before = null;
  for (;;) {
    const params = [address, { limit: 1000, ...(before ? { before } : {}) }];
    const j = await rpc(url, { jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params });
    const page = (j && j.result) || [];
    if (!page.length) break;
    out.push(...page);
    before = page[page.length - 1].signature;
    process.stderr.write(`\r  signatures: ${out.length}`);
    if (page.length < 1000) break;
  }
  process.stderr.write("\n");
  return out;
}

// Batch getTransaction: the ER accepts JSON-RPC array batches.
async function fetchSigners(url, sigs, label) {
  const CHUNK = 100;
  const signers = new Map(); // pubkey -> count
  let counted = 0;
  let skipped = 0;
  let firstTime = null;
  let lastTime = null;

  for (let i = 0; i < sigs.length; i += CHUNK) {
    const chunk = sigs.slice(i, i + CHUNK);
    const batch = chunk.map((s, k) => ({
      jsonrpc: "2.0",
      id: k,
      method: "getTransaction",
      params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
    }));
    const res = await rpc(url, batch);
    for (const item of Array.isArray(res) ? res : []) {
      const tx = item && item.result;
      if (!tx || !tx.transaction) { skipped++; continue; }
      const msg = tx.transaction.message;
      const isCheer = (msg.instructions || []).some((ix) => {
        if (ix.programId !== PROGRAM_ID || !ix.data) return false;
        const d = b58decode(ix.data);
        return d && DISC_CHEER.every((b, n) => d[n] === b);
      });
      if (!isCheer) { skipped++; continue; }
      const signer = (msg.accountKeys || []).find((a) => a.signer);
      if (!signer) { skipped++; continue; }
      signers.set(signer.pubkey, (signers.get(signer.pubkey) || 0) + 1);
      counted++;
      const t = tx.blockTime;
      if (t) {
        if (firstTime === null || t < firstTime) firstTime = t;
        if (lastTime === null || t > lastTime) lastTime = t;
      }
    }
    process.stderr.write(`\r  ${label}: ${counted} cheers / ${i + chunk.length} txs`);
  }
  process.stderr.write("\n");
  return { signers, counted, skipped, firstTime, lastTime };
}

(async () => {
  console.error(`board ${BOARD}`);

  // authoritative total, straight off the account
  const acct = await rpc(ER_URL, {
    jsonrpc: "2.0", id: 1, method: "getAccountInfo",
    params: [BOARD, { encoding: "base64", commitment: "confirmed" }],
  });
  let boardTotal = null;
  if (acct && acct.result && acct.result.value) {
    const raw = Buffer.from(acct.result.value.data[0], "base64");
    boardTotal = Number(raw.readBigUInt64LE(48));
  }
  console.error(`on-chain tally: ${boardTotal}`);

  console.error("walking ER history…");
  const erSigs = await allSignatures(ER_URL, BOARD);
  const er = await fetchSigners(ER_URL, erSigs, "ER");

  // The board also lived on base devnet before delegation. Cheers there are real
  // cheers and belong on the board.
  console.error("walking base devnet history…");
  let baseSigs = [];
  let base = { signers: new Map(), counted: 0, skipped: 0, firstTime: null, lastTime: null };
  try {
    baseSigs = await allSignatures(BASE_URL, BOARD);
    if (baseSigs.length) base = await fetchSigners(BASE_URL, baseSigs, "base");
  } catch (e) {
    console.error("  base devnet walk failed (non-fatal):", e.message);
  }

  const merged = new Map(er.signers);
  for (const [k, v] of base.signers) merged.set(k, (merged.get(k) || 0) + v);

  const cheerers = [...merged.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pubkey, cheers]) => ({ pubkey, cheers }));

  const counted = er.counted + base.counted;
  const times = [er.firstTime, base.firstTime].filter((t) => t !== null);

  const out = {
    generatedAt: new Date().toISOString(),
    board: BOARD,
    program: PROGRAM_ID,
    erUrl: ER_URL,
    boardTotal,        // what the account itself says
    countedCheers: counted, // what we could attribute to a signer
    totalCheerers: cheerers.length,
    firstCheerAt: times.length ? Math.min(...times) : null,
    lastCheerAt: er.lastTime,
    // newest ER signature at snapshot time — the page fetches only what came after
    latestSig: erSigs.length ? erSigs[0].signature : null,
    cheerers,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.error(
    `\n${counted} cheers · ${cheerers.length} cheerers · ${er.skipped + base.skipped} non-cheer txs skipped`
  );
  console.error(`board says ${boardTotal}, we attributed ${counted}`);
  console.error(`wrote ${OUT}`);
})();
