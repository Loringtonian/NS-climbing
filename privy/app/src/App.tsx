import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignTransaction,
  useFundWallet,
  useExportWallet,
} from "@privy-io/react-auth/solana";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { CLUSTER, RPC, RELAYER, USDC_MINT, TIERS } from "./config";

const conn = new Connection(RPC, "confirmed");
const u8ToB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64ToU8 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const short = (a: string) => a.slice(0, 4) + "…" + a.slice(-4);

export default function App() {
  const { ready, authenticated, login, logout } = usePrivy();
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
      setUsdc(r.value.reduce((s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0));
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositor: address, usd }),
      }).then((r) => r.json());
      if (prep.error) throw new Error(prep.error);

      const tx = VersionedTransaction.deserialize(b64ToU8(prep.tx));
      setStatus("Approve the signature in your wallet…");
      const { signedTransaction } = await signTransaction({ transaction: tx as any, wallet: embedded as any });

      setStatus("Sponsoring gas + locking it in…");
      const out = await fetch(`${RELAYER}/deposit/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prep.id, signedTx: u8ToB64(signedTransaction) }),
      }).then((r) => r.json());
      if (out.error) throw new Error(out.error);

      setSig(out.sig);
      setStatus(`🎉 You're in! $${usd} locked in the pool for the wall.`);
      refreshBalance();
    } catch (e: any) {
      setStatus("Deposit failed: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="wrap"><div className="hero"><h1>Loading…</h1></div></div>;
  }

  if (!authenticated) {
    return (
      <div className="wrap">
        <div className="hero">
          <span className="eyebrow">Any chain · no wallet needed</span>
          <h1>Back the climbing wall <span>at Network School.</span></h1>
          <div className="lede">
            Log in with email or any wallet. We give you a Solana wallet, you top it up from
            whatever chain you're on, and your deposit locks into the escrow — no browser
            extension, no SOL needed.
          </div>
        </div>
        <div className="stack">
          <button className="btn" onClick={login}>Log in or connect a wallet</button>
          <div className="brandnote">Email or any wallet · secured by Privy</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="hero" style={{ minHeight: 150 }}>
        <span className="eyebrow">Any chain · no wallet needed</span>
        <h1 style={{ fontSize: 24 }}>Back the wall <span>at Network School.</span></h1>
      </div>

      <div className="stack">
        <div className="row">
          <span className="chip">{address ? short(address) : "provisioning wallet…"}</span>
          <button className="link" onClick={logout}>log out</button>
        </div>

        <div className="card">
          <div className="label">Your balance</div>
          <div className="bal">{usdc === null ? "…" : `$${usdc.toLocaleString()}`} <span style={{ fontSize: 15, color: "var(--muted)" }}>USDC</span></div>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={addFunds}>
            + Add funds {CLUSTER === "mainnet" ? "(from any chain)" : "(devnet)"}
          </button>
        </div>

        <div className="label" style={{ margin: "4px 2px" }}>Lock in a tier</div>
        {TIERS.map((t) => {
          const need = usdc !== null && usdc < t;
          return (
            <button key={t} className="btn tier" disabled={busy || need} onClick={() => deposit(t)}>
              <span>Lock in{need ? " — add funds first" : ""}</span>
              <span className="amt">${t.toLocaleString()}</span>
            </button>
          );
        })}

        {status && (
          <div className="status">
            {busy && <span className="spin" style={{ marginRight: 8, verticalAlign: "-2px" }} />}
            {status}
          </div>
        )}
        {sig && (
          <a className="status" style={{ display: "block" }} target="_blank" rel="noopener"
            href={`https://explorer.solana.com/tx/${sig}${CLUSTER === "devnet" ? "?cluster=devnet" : ""}`}>
            view your transaction ↗
          </a>
        )}

        <hr className="sep" />
        <div className="fine">
          Your badge, vote, and refund live on this wallet. Export the key so they survive no matter what.
        </div>
        <button className="link" onClick={() => exportWallet()}>Export my wallet key →</button>
      </div>
    </div>
  );
}
