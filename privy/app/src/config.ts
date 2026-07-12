export const CLUSTER = (import.meta.env.VITE_CLUSTER || "devnet") as "devnet" | "mainnet";

const NET = {
  devnet:  { rpc: "https://api.devnet.solana.com", wss: "wss://api.devnet.solana.com", caip: "solana:devnet",
             usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" },
  mainnet: { rpc: "https://solana-rpc.publicnode.com", wss: "wss://api.mainnet-beta.solana.com", caip: "solana:mainnet",
             usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
}[CLUSTER];

export const RPC = NET.rpc;
export const WSS = NET.wss;
export const CAIP = NET.caip;
export const USDC_MINT = NET.usdc;
export const RELAYER = import.meta.env.VITE_RELAYER_URL || "http://localhost:8787";
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;
export const TIERS = [20, 100, 1000];
export const PROGRAM_ID = "2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ";
export const CAMPAIGN_ID = CLUSTER === "mainnet" ? "send-climbing" : "PRIVY_TEST";
