// Generate a relayer keypair. Prints the pubkey + the base58 secret for RELAYER_SECRET_KEY.
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
const kp = Keypair.generate();
console.log("PUBKEY:", kp.publicKey.toBase58());
console.log("RELAYER_SECRET_KEY (base58):", bs58.encode(kp.secretKey));
console.log("\nFund this pubkey with SOL (devnet: solana airdrop / faucet; mainnet: ~0.2 SOL).");
