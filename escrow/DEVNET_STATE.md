# Devnet deployment state (2026-07-12) — v4 dollar-weighted, clean chain

Fresh program ID, clean history: this program's entire on-chain past is the v4
deploy, the three scenario rehearsals (`../REHEARSALS.md`), and the
`send-climbing` demo campaign below. No head-count-era artifacts.

| What | Value |
|------|-------|
| Program ID (devnet + mainnet) | `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` |
| Binary sha256 | `0656436312f777e9c382eea98a40af75dc6acfaf65789aefaef0ce6746af646b` (296,544 B; byte-reproducible; pinned in `DEPLOY.md`) |
| Demo USDC mint (devnet) | `CXBXU8sX8H9fvdgVGz2s2bKYZrbvWr6rW9SzhU9ymk2T` (we control minting: `spl-token mint <mint> 100 <ata> -u devnet`) |
| Demo campaign ID | `send-climbing` |
| Demo campaign PDA | `B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd` ([explorer](https://explorer.solana.com/address/B5MmhcNPzqJgFZ9fP8Ntrdr4UTZAtUb8xgVZfLi8yQXd?cluster=devnet)) |
| Deadline | 180 days (~6 months) from init; contract caps at 190 |
| Deposit page | https://loringtonian.github.io/NS-climbing/escrow/web/demo.html |
| Model | DOLLAR-WEIGHTED dual-gate (`payout_vote_amount × 2 > total_escrowed`); dollar-majority dissolve; ~6-month timeout refund |

Deployed-program verification (done at deploy time): `solana program dump`,
truncate to 296,544 bytes, sha256 == the pin above. Upgrade authority on devnet
is the deployer key (devnet is disposable); on mainnet it is BURNED before real
deposits.

Rehearsals (`../REHEARSALS.md`) ran on their own scratch campaigns and proved
all three endings on-chain, including the dollar-weight boundary live (a $100
vote of a $200 pool — exactly half — did NOT release; the second $100 vote did).

NEXT: mainnet deploy on Lorin's go (`scripts/mainnet_go.sh`), then pin the
mainnet campaign PDA in `agents.md` + `VERIFY_IT.md`.
