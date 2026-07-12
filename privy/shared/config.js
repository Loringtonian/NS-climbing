// Escrow deployment configs. Mainnet values are the LIVE immutable program.
export const CONFIGS = {
  mainnet: {
    cluster: "mainnet-beta",
    rpc: "https://solana-rpc.publicnode.com", // browser-CORS-open; api.mainnet-beta 403s browsers
    program: "2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ",
    campaignId: "send-climbing",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Circle USDC (mainnet)
  },
  devnet: {
    cluster: "devnet",
    rpc: "https://api.devnet.solana.com",
    program: "2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ", // same program id on devnet
    campaignId: "PRIVY_TEST", // init a fresh devnet campaign for testing (see README)
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Circle USDC (devnet)
  },
};

// Deposit tiers ($). The relayer only sponsors these amounts.
export const TIERS = [20, 100, 1000];
