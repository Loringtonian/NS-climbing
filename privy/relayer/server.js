// NS-climbing deposit relayer — sponsors SOL gas + gifts the rent the immutable
// contract charges to `payer = depositor`, so a zero-SOL Privy embedded wallet
// can deposit. SECURITY: the relayer BUILDS the canonical tx and only co-signs a
// returned tx whose message is byte-identical to what it built — it can never be
// tricked into signing an arbitrary (draining) transaction.
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { Connection, Keypair, VersionedTransaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { buildDepositTx } from "../shared/escrow.js";
import { CONFIGS, TIERS } from "../shared/config.js";

const PORT    = process.env.PORT || 8787;
const CLUSTER = process.env.CLUSTER || "devnet";       // devnet | mainnet
const cfg     = CONFIGS[CLUSTER];
if (!cfg) throw new Error(`unknown CLUSTER ${CLUSTER}`);
const conn    = new Connection(cfg.rpc, "confirmed");

function loadRelayer() {
  const s = (process.env.RELAYER_SECRET_KEY || "").trim();
  if (!s) throw new Error("RELAYER_SECRET_KEY missing (base58 or JSON array)");
  const secret = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s);
  return Keypair.fromSecretKey(secret);
}
const relayer = loadRelayer();

const app = express();
app.use(cors());                     // TODO: restrict origin to the deploy domain
app.use(express.json({ limit: "64kb" }));

// canonical tx cache (id -> {msg, ts}); short TTL, blockhash ~valid 60-90s
const pending = new Map();
const TTL = 90_000;
setInterval(() => { const n = Date.now(); for (const [k, v] of pending) if (n - v.ts > TTL) pending.delete(k); }, 30_000).unref?.();

// crude global rate-limit so a bad actor can't drain the relayer's SOL via rent gifts
let windowStart = Date.now(), windowCount = 0;
const MAX_PER_MIN = Number(process.env.MAX_PER_MIN || 60);
function underLimit() {
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; windowCount = 0; }
  return ++windowCount <= MAX_PER_MIN;
}

app.get("/health", async (_req, res) => {
  try {
    const bal = await conn.getBalance(relayer.publicKey);
    res.json({ ok: true, cluster: CLUSTER, relayer: relayer.publicKey.toBase58(), sol: bal / 1e9, program: cfg.program, campaign: cfg.campaignId });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// 1) build the canonical deposit tx; return it unsigned for the embedded wallet to partial-sign
app.post("/deposit/prepare", async (req, res) => {
  try {
    if (!underLimit()) return res.status(429).json({ error: "rate limited" });
    const { depositor, usd } = req.body || {};
    if (!TIERS.includes(Number(usd))) return res.status(400).json({ error: "invalid tier" });
    new PublicKey(depositor); // throws if malformed
    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    const tx = buildDepositTx({
      programId: cfg.program, campaignId: cfg.campaignId, mint: cfg.mint,
      depositor, relayer: relayer.publicKey.toBase58(), usd: Number(usd), recentBlockhash: blockhash,
    });
    const id = randomUUID();
    pending.set(id, { msg: Buffer.from(tx.message.serialize()).toString("base64"), ts: Date.now() });
    res.json({ id, tx: Buffer.from(tx.serialize()).toString("base64") });
  } catch (e) { res.status(400).json({ error: String(e?.message || e) }); }
});

// 2) receive the depositor-signed tx, verify it's OUR tx untouched, co-sign + broadcast
app.post("/deposit/submit", async (req, res) => {
  try {
    const { id, signedTx } = req.body || {};
    const rec = pending.get(id);
    if (!rec) return res.status(400).json({ error: "unknown or expired id" });
    const tx = VersionedTransaction.deserialize(Buffer.from(signedTx, "base64"));
    // tamper check: the returned message must equal the one we built
    if (Buffer.from(tx.message.serialize()).toString("base64") !== rec.msg)
      return res.status(400).json({ error: "transaction does not match prepared deposit" });
    pending.delete(id);
    // depositor already signed; relayer fills its (feePayer + transfer) slot, preserving depositor's
    tx.sign([relayer]);
    if (tx.signatures.some((s) => s.every((b) => b === 0)))
      return res.status(400).json({ error: "missing depositor signature" });
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(sig, "confirmed");
    res.json({ sig });
  } catch (e) { res.status(400).json({ error: String(e?.message || e) }); }
});

// serve the built frontend (vite dist copied to relayer/public at deploy) so the
// app + API share one origin. API routes above are matched first; this is the SPA fallback.
const PUBLIC = new URL("./public/", import.meta.url).pathname;
app.use(express.static(PUBLIC));
app.get("*", (_req, res) => res.sendFile(PUBLIC + "index.html", (err) => { if (err) res.status(404).end(); }));

app.listen(PORT, () => console.log(`relayer on :${PORT} — ${CLUSTER} — feePayer ${relayer.publicKey.toBase58()}`));
