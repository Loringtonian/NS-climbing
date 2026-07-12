import { Buffer } from "buffer";
// @solana/web3.js needs a Buffer global in the browser
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import App from "./App";
import { PRIVY_APP_ID, RPC, WSS, CAIP } from "./config";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          walletChainType: "ethereum-and-solana",
          theme: "dark",
          accentColor: "#ff6b4a",
        },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
        solana: {
          rpcs: {
            [CAIP]: {
              rpc: createSolanaRpc(RPC),
              rpcSubscriptions: createSolanaRpcSubscriptions(WSS),
            },
          },
        },
        // provision a self-custodial embedded Solana wallet for users without one
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
