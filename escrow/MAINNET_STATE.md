# MAINNET deployment state (2026-07-12) — LIVE

| What | Value |
|------|-------|
| Program ID | `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` |
| Binary sha256 | `facd1bb3b9e6a1f2d9041a2d81c48d904f3ac392cc16211bae482e9d2b190fa5` (296,544 B) — deployed program hash-matches this (truncate the dump to 296,544 B) |
| Upgrade authority | **BURNED** (`--final`). `solana program show 2PAg… -u mainnet-beta` → `Authority: none`. Code is immutable forever. |
| Campaign ID | `send-climbing` |
| Campaign PDA | `B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd` |
| Vault PDA | `DGf8UtSPsKAcuRxmRYxQtZ5PSNWKYVxHzHeppbKeUfmV` |
| USDC mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle) |
| Deadline | 180 days from init (unix `1799376686`) |
| Deposit page | https://loringtonian.github.io/NS-climbing/ (and escrow/web/demo.html) — configs point at mainnet + Circle USDC |
| Explorer | https://explorer.solana.com/address/B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd |

Deploy sig: `3prTegCD5bqMGZTEXfPJQHfzG5tvqmtw1Z8dAaoXie3VMXodaZYMxT8AjzsTEQE1nVKM5KMZ2CZbFn8svdJwHrmm`
Init sig: `boPMVTx9AYg5GEFpHZm7pSYMqZXnATrQnhq3L8GyJGAXjv42FzgyMT6ft54fHM2BiMyUtAxpUJaDDFvnquDg6Lk`

Model: dollar-weighted dual-gate (`payout_vote_amount × 2 > total_escrowed`), dollar-majority
dissolve, 180-day timeout refund. Verify against source per `agents.md` / `VERIFY_IT.md`.
