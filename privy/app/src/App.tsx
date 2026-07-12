import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignTransaction, useExportWallet } from "@privy-io/react-auth/solana";
import { Connection, PublicKey } from "@solana/web3.js";
import { CLUSTER, RPC, RELAYER, USDC_MINT, TIERS, PROGRAM_ID, CAMPAIGN_ID } from "./config";
import { buildSelfPaidDepositTx } from "./escrow";

const conn = new Connection(RPC, "confirmed");
const short = (a: string) => a.slice(0, 4) + "…" + a.slice(-4);

// The embedded (Privy-managed) Solana wallet — try every identifier Privy has used
// across v3 so we don't miss it if one field name differs.
function pickEmbedded(wallets: any[]) {
  return wallets.find(
    (w) =>
      w?.walletClientType === "privy" ||
      w?.standardWallet?.name === "Privy" ||
      w?.connectorType === "embedded" ||
      w?.type === "embedded"
  );
}

export default function App() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { exportWallet } = useExportWallet();

  const list = wallets || [];
  const embedded = pickEmbedded(list);
  const address: string | undefined = embedded?.address;

  const [usdc, setUsdc] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [showFund, setShowFund] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmTier, setConfirmTier] = useState<number | null>(null);

  // one-time console dump so we can see the wallet shape if anything's off
  useEffect(() => {
    if (authenticated) console.log("[anychain] wallets:", list, "→ embedded:", embedded);
  }, [authenticated, list.length]);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const r = await conn.getParsedTokenAccountsByOwner(new PublicKey(address), { mint: new PublicKey(USDC_MINT) });
      setUsdc(r.value.reduce((s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0));
    } catch { setUsdc(0); }
  }, [address]);

  useEffect(() => {
    refreshBalance();
    const t = setInterval(refreshBalance, 6000);
    return () => clearInterval(t);
  }, [refreshBalance]);

  async function copyAddr() {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  async function deposit(usd: number) {
    if (!address || !embedded) { setStatus("No wallet yet — see the note above."); return; }
    setBusy(true); setSig(null);
    try {
      // 1) relayer tops up the embedded wallet with SOL so it can pay its own gas
      setStatus("Getting your wallet ready…");
      const fg = await fetch(`${RELAYER}/fund-gas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositor: address }),
      }).then((r) => r.json());
      if (fg.error) throw new Error(fg.error);
      // 2) build a fully self-contained deposit (embedded wallet is sole payer) so
      //    Privy's confirmation modal can simulate it cleanly
      setStatus("Building your deposit…");
      const tx = await buildSelfPaidDepositTx(conn, {
        programId: PROGRAM_ID, campaignId: CAMPAIGN_ID, mint: USDC_MINT, depositor: address, usd,
      });
      // 3) sign with the embedded wallet (no Privy modal — showWalletUIs:false; we
      //    already showed our own confirmation), then broadcast it ourselves.
      setStatus("Locking it in…");
      // Privy v3 signTransaction expects the ENCODED tx (Uint8Array), not the object.
      const { signedTransaction } = await signTransaction({ transaction: tx.serialize() as any, wallet: embedded as any });
      setStatus("Sending…");
      const raw: any = signedTransaction instanceof Uint8Array ? signedTransaction
        : (signedTransaction as any)?.serialize ? (signedTransaction as any).serialize() : signedTransaction;
      const signature = await conn.sendRawTransaction(raw, { skipPreflight: false });
      for (let i = 0; i < 40; i++) {
        const s = (await conn.getSignatureStatuses([signature])).value[0];
        if (s?.err) throw new Error("transaction failed on-chain: " + JSON.stringify(s.err));
        if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      setSig(signature);
      setStatus(`🎉 You're in! $${usd} locked in the pool for the wall.`);
      refreshBalance();
    } catch (e: any) {
      console.error("[anychain] deposit failed:", e);
      setStatus("Deposit failed: " + (e?.message || String(e)));
    } finally { setBusy(false); }
  }

  if (!ready) return <div className="wrap"><div className="hero"><h1>Loading…</h1></div></div>;

  if (!authenticated) {
    return (
      <div className="wrap">
        <div className="hero">
          <span className="eyebrow">Any chain · no wallet needed</span>
          <h1>Back the climbing wall <span>at Network School.</span></h1>
          <div className="lede">Log in with email and we give you a Solana wallet — fund it with USDC and your deposit locks into the escrow. No extension, no SOL needed.</div>
        </div>
        <div className="stack">
          <button className="btn" onClick={login}>Log in with email</button>
          <div className="brandnote">Email or wallet · secured by Privy</div>
        </div>
      </div>
    );
  }

  // authenticated but no embedded wallet (e.g. logged in with an external wallet)
  if (!address) {
    const provisioning = list.length === 0;
    return (
      <div className="wrap">
        <div className="hero" style={{ minHeight: 140 }}>
          <span className="eyebrow">Any chain · no wallet needed</span>
          <h1 style={{ fontSize: 24 }}>Almost there.</h1>
        </div>
        <div className="stack">
          <div className="card">
            {provisioning ? (
              <div><span className="spin" style={{ marginRight: 8, verticalAlign: "-2px" }} />Setting up your Solana wallet…</div>
            ) : (
              <div className="fine">You're logged in with an <b>external wallet</b>, so no embedded wallet was created — and this flow needs one. Log out and <b>log in with email</b> instead. (If you already have a Solana wallet, just use the normal deposit page.)</div>
            )}
          </div>
          <button className="btn ghost" onClick={logout}>Log out &amp; use email</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="hero" style={{ minHeight: 140 }}>
        <span className="eyebrow">Any chain · no wallet needed</span>
        <h1 style={{ fontSize: 24 }}>Back the wall <span>at Network School.</span></h1>
      </div>

      <div className="stack">
        <div className="row">
          <button className="chip" onClick={copyAddr} title="copy your wallet address" style={{ cursor: "pointer" }}>
            {copied ? "copied ✓" : short(address)} ⧉
          </button>
          <button className="link" onClick={logout}>log out</button>
        </div>

        <div className="card">
          <div className="label">Your balance</div>
          <div className="bal">{usdc === null ? "…" : `$${usdc.toLocaleString()}`} <span style={{ fontSize: 15, color: "var(--muted)" }}>USDC</span></div>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setShowFund((v) => !v)}>+ Add funds</button>
          {showFund && (
            <div className="fine" style={{ marginTop: 12, lineHeight: 1.6 }}>
              Send <b>USDC on Solana</b> to your wallet address, from any exchange or wallet:
              <div className="chip" style={{ display: "block", marginTop: 8, padding: "10px 12px", wordBreak: "break-all", lineHeight: 1.5 }}>
                {address}
              </div>
              <button className="btn ghost" style={{ marginTop: 8, padding: "10px 14px", fontSize: 14 }} onClick={copyAddr}>
                {copied ? "Copied ✓" : "Copy address"}
              </button>
              <div style={{ marginTop: 10 }}>Bridging from another chain (Base/Eth/etc.) in-app is coming — for now this address takes USDC from anywhere on Solana.</div>
            </div>
          )}
        </div>

        <div className="label" style={{ margin: "4px 2px" }}>Lock in a tier</div>
        {confirmTier !== null ? (
          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Lock ${confirmTier.toLocaleString()} into the escrow?</div>
            <div className="fine" style={{ marginTop: 8, lineHeight: 1.55 }}>
              Your ${confirmTier.toLocaleString()} USDC locks into the pool — no individual withdraw. It only comes back if depositors vote to dissolve, or automatically at the 180-day deadline. You're signing with your own wallet; nobody can move the pool alone.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn" disabled={busy} onClick={() => { const t = confirmTier; setConfirmTier(null); deposit(t); }}>
                Confirm — lock ${confirmTier.toLocaleString()}
              </button>
              <button className="btn ghost" disabled={busy} style={{ width: "auto", padding: "15px 20px" }} onClick={() => setConfirmTier(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          TIERS.map((t) => {
            const need = usdc !== null && usdc < t;
            return (
              <button key={t} className="btn tier" disabled={busy || need} onClick={() => setConfirmTier(t)}>
                <span>Lock in{need ? " — add USDC first" : ""}</span>
                <span className="amt">${t.toLocaleString()}</span>
              </button>
            );
          })
        )}

        {status && <div className="status">{busy && <span className="spin" style={{ marginRight: 8, verticalAlign: "-2px" }} />}{status}</div>}
        {sig && (
          <a className="status" style={{ display: "block" }} target="_blank" rel="noopener"
            href={`https://explorer.solana.com/tx/${sig}${CLUSTER === "devnet" ? "?cluster=devnet" : ""}`}>view your transaction ↗</a>
        )}

        <hr className="sep" />
        <div className="fine">Your badge, vote, and refund live on this wallet. Export the key so they survive no matter what.</div>
        <button className="link" onClick={() => exportWallet()}>Export my wallet key →</button>
      </div>
    </div>
  );
}
