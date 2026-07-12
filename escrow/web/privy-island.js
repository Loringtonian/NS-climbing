/* Privy island — external-wallet-only bridge for the deposit flow.
 *
 * Loads Privy's React SDK from a CDN (no build step, matching this repo) and
 * mounts a HIDDEN PrivyProvider. It publishes a tiny imperative contract on
 * window.PRIVY that deposit.js consumes:
 *
 *   window.PRIVY.connect()  -> Promise<{ address, signTransaction(tx) }>
 *   window.PRIVY.wallet     -> { signTransaction(tx) } | null   (post-connect)
 *
 * The SAME external Phantom/Solflare keys sign; Privy just owns the connect
 * modal + session. Enable per-page with ESCROW_CONFIG.usePrivy = true.
 *
 * NOTE: Privy's Solana hook/method names have shifted across versions. If the
 * test page (privy-test.html) shows a connect/sign error, the two lines to
 * check are marked  // VERIFY  below.
 */
import React, { useEffect } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1";
import { PrivyProvider, useConnectWallet } from "https://esm.sh/@privy-io/react-auth@2?deps=react@18.3.1,react-dom@18.3.1";
import { useSolanaWallets, toSolanaWalletConnectors } from "https://esm.sh/@privy-io/react-auth@2/solana?deps=react@18.3.1,react-dom@18.3.1";

var APP_ID = (window.ESCROW_CONFIG && window.ESCROW_CONFIG.privyAppId) || "";
var RPC = (window.ESCROW_CONFIG && window.ESCROW_CONFIG.rpc) || "https://api.mainnet-beta.solana.com";

function wrap(w) {
  return { address: w.address, signTransaction: function (tx) { return w.signTransaction(tx); } }; // VERIFY: some versions want signTransaction({transaction, connection})
}

function Bridge() {
  var solana = useSolanaWallets();               // VERIFY: hook name for connected Solana wallets
  var wallets = solana && solana.wallets ? solana.wallets : [];
  var connectHook = useConnectWallet();
  var connectWallet = connectHook && connectHook.connectWallet;

  useEffect(function () {
    window.__privyWallets = wallets;
    var w = wallets[0];
    window.PRIVY = Object.assign(window.PRIVY || {}, {
      wallet: w ? { signTransaction: function (tx) { return w.signTransaction(tx); } } : null,
    });
  }, [wallets]);

  useEffect(function () {
    window.PRIVY = Object.assign(window.PRIVY || {}, {
      ready: true,
      connect: function () {
        return new Promise(function (resolve, reject) {
          var pick = function () { return (window.__privyWallets || [])[0]; };
          var existing = pick();
          if (existing) return resolve(wrap(existing));
          try { connectWallet({ walletChainType: "solana-only" }); } catch (e) { try { connectWallet(); } catch (_) {} }
          var n = 0;
          var t = setInterval(function () {
            var w = pick();
            if (w) { clearInterval(t); resolve(wrap(w)); }
            else if (++n > 150) { clearInterval(t); reject(new Error("Privy connect timed out")); } // ~30s
          }, 200);
        });
      },
    });
  }, [connectWallet]);

  return null;
}

function mount() {
  if (!APP_ID) { console.warn("[privy] no ESCROW_CONFIG.privyAppId — island not mounted"); return; }
  var host = document.createElement("div");
  host.id = "privy-root";
  host.style.display = "none";
  document.body.appendChild(host);

  var config = {
    embeddedWallets: { createOnLogin: "off" },            // external wallets only — no embedded/email wallet
    appearance: { walletChainType: "solana-only", theme: "dark", accentColor: "#ff6b4a" },
    externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
    solanaClusters: [{ name: "mainnet-beta", rpcUrl: RPC }],
  };

  createRoot(host).render(
    React.createElement(PrivyProvider, { appId: APP_ID, config: config },
      React.createElement(Bridge))
  );
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
