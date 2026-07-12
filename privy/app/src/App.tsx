import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignTransaction,
  useFundWallet,
  useExportWallet,
} from "@privy-io/react-auth/solana";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { CLUSTER, RPC, RELAYER, USDC_MINT, TIERS } from "./config";

const conn = new Connection(RPC, "confirmed");
const u8ToB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64ToU8 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const short = (a: string) => a.slice(0, 4) + "…" + a.slice(-4);

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { fundWallet } = useFundWallet();
  const { exportWallet } = useExportWallet();

  const embedded = wallets.find((w: any) => w?.standardWallet?.name === "Privy");
  const address: string | undefined = embedded?.address;

  const [usdc, setUsdc] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const r = await conn.getParsedTokenAccountsByOwner(new PublicKey(address), {
        mint: new PublicKey(USDC_MINT),
      });
      const bal = r.value.reduce(
        (s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount || 0),
        0
      );
      setUsdc(bal);
    } catch {
      setUsdc(0);
    }
  }, [address]);

  useEffect(() => {
    refreshBalance();
    const t = setInterval(refreshBalance, 8000);
    return () => clearInterval(t);
  }, [refreshBalance]);

  async function addFunds() {
    if (!address) return;
    // Privy's funding UI — on mainnet this can BRIDGE USDC from any EVM chain
    // (Ethereum/Base/Arbitrum/Polygon/Optimism) onto this Solana wallet.
    await fundWallet(address, { cluster: { name: CLUSTER === "mainnet" ? "mainnet-beta" : "devnet" } } as any);
    refreshBalance();
  }

  async function deposit(usd: number) {
    if (!address || !embedded) return;
    setBusy(true);
    setSig(null);
    setStatus(`Preparing your $${usd} deposit…`);
    try {
      const prep = await fetch(`${RELAYER}/deposit/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositor: address, usd }),
      }).then((r) => r.json());
      if (prep.error) throw new Error(prep.error);

      const tx = Transaction.from(b64ToU8(prep.tx));
      setStatus("Signing in your embedded wallet…");
      const { signedTransaction } = await signTransaction({ transaction: tx as any, wallet: embedded as any });

      setStatus("Sponsoring gas + broadcasting…");
      const out = await fetch(`${RELAYER}/deposit/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prep.id, signedTx: u8ToB64(signedTransaction) }),
      }).then((r) => r.json());
      if (out.error) throw new Error(out.error);

      setSig(out.sig);
      setStatus(`🎉 You're in! $${usd} locked in the pool.`);
      refreshBalance();
    } catch (e: any) {
      setStatus("Deposit failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Shell><p>Loading…</p></Shell>;

  if (!authenticated) {
    return (
      <Shell>
        <h1>Back the climbing wall — from any chain</h1>
        <p style={{ color: "#9aa4b2" }}>
          Log in with email or any wallet. We give you a Solana wallet, you fund it from whatever
          chain you're on, and your deposit locks into the escrow — no browser extension, no SOL needed.
        </p>
        <button style={btn} onClick={login}>Log in / Connect</button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#9aa4b2", fontSize: 13 }}>
          {address ? `Solana wallet ${short(address)}` : "provisioning wallet…"}
        </span>
        <button style={linkBtn} onClick={logout}>log out</button>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, color: "#9aa4b2" }}>Your balance</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {usdc === null ? "…" : `$${usdc.toLocaleString()} USDC`}
        </div>
        <button style={btnGhost} onClick={addFunds}>
          Add funds {CLUSTER === "mainnet" ? "(any chain →  Solana)" : "(devnet)"}
        </button>
      </div>

      <div style={{ fontSize: 13, color: "#9aa4b2", margin: "6px 2px" }}>Lock in a tier</div>
      <div style={{ display: "grid", gap: 10 }}>
        {TIERS.map((t) => (
          <button key={t} style={btn} disabled={busy || (usdc !== null && usdc < t)}
            onClick={() => deposit(t)}>
            Lock ${t.toLocaleString()}
            {usdc !== null && usdc < t ? " — add funds first" : ""}
          </button>
        ))}
      </div>

      {status && <p style={{ color: "#ffb24a", marginTop: 14, wordBreak: "break-all" }}>{status}</p>}
      {sig && (
        <a style={{ color: "#ffb24a" }} target="_blank" rel="noopener"
          href={`https://explorer.solana.com/tx/${sig}${CLUSTER === "devnet" ? "?cluster=devnet" : ""}`}>
          view your transaction ↗
        </a>
      )}

      <div style={{ marginTop: 22, borderTop: "1px solid #262c36", paddingTop: 14 }}>
        <div style={{ fontSize: 13, color: "#9aa4b2" }}>
          Your badge, vote, and refund live on this wallet. Export the key so they survive no matter what.
        </div>
        <button style={linkBtn} onClick={() => exportWallet()}>Export my wallet key →</button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0e1116", color: "#f2f4f7",
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: "40px 22px", display: "grid", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { width: "100%", padding: "15px 18px", borderRadius: 999, border: 0,
  background: "#ff6b4a", color: "#0e1116", fontWeight: 800, fontSize: 16, cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btn, background: "transparent", color: "#f2f4f7",
  border: "1px solid #262c36", marginTop: 10 };
const linkBtn: React.CSSProperties = { background: "none", border: 0, color: "#9aa4b2",
  textDecoration: "underline", cursor: "pointer", fontSize: 13, padding: 0 };
const card: React.CSSProperties = { background: "#161b22", border: "1px solid #262c36",
  borderRadius: 16, padding: 18, marginTop: 6 };
