# DEPLOY.md — devnet now, mainnet when funded

Binary: `target/deploy/ns_climb_escrow.so` — **279,336 bytes** (build 2026-07-11,
anchor-cli 1.0.2 / anchor-lang 1.1.2 / solana 4.1.1 / rustc 1.92.0).
Program ID `7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw` = pubkey of the
gitignored keypair `target/deploy/ns_climb_escrow-keypair.json`. If that file is
ever lost or you want a fresh ID: `solana-keygen new -o target/deploy/ns_climb_escrow-keypair.json`,
put the new pubkey in `declare_id!` (lib.rs), `Anchor.toml`, `web/counter.js`,
`web/demo.html`, and rebuild.

Toolchain (shared with Projects/PopUp_Markets, installed 2026-07-11):
- solana 4.1.1 at `~/.local/share/solana/install/active_release/bin` (PATH via `~/.profile`)
- anchor 1.0.2 prebuilt binary at `~/.cargo/bin/anchor`
- Anchor 1.x note: `anchor test` wants `surfpool`; we run
  `solana-test-validator` ourselves + `anchor test --skip-local-validator`.
- SBPF gotcha (verified 2026-07-11): the build is SBPF **v0**. Devnet and
  mainnet both still accept v0 deploys (SIMD-0500 inactive there). But
  `solana-test-validator` activates ALL features including SIMD-0500
  ("Disable deployment of SBPF v0/v1/v2"), so LOCALNET needs:
  `solana-test-validator --deactivate-feature B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g`.
  When SIMD-0500 activates on mainnet (someday), rebuild with `--arch v3`.

## Wallets / keys (all gitignored, never committed)

| Key | Path | Role |
|--------------------|--------------------------------------------------|-----------------------------------------|
| Deployer + admin | `~/.config/solana/id.json` | Pays deploy; signs `approve_release` |
| Program keypair | `escrow/target/deploy/ns_climb_escrow-keypair.json` | Fixes the program ID |
| Buildout address | — set at `initialize_campaign` | Where funds go on release (multisig later; any pubkey now) |

## Devnet (costs nothing — airdropped SOL only)

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd /Users/lts/Desktop/Second_Brain/Projects/NS-climbing/escrow
solana config set -u devnet
solana airdrop 5          # repeat if rate-limited; deploy needs ~2.6 SOL
anchor deploy --provider.cluster devnet
# campaign (goal/deposit/deadline/buildout are parameters):
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
CAMPAIGN_ID=ns-climbing-wall GOAL_USDC=2000 DEPOSIT_USDC=20 DEADLINE_DAYS=30 \
BUILDOUT=<pubkey> USDC_MINT=<mint> npx ts-node scripts/init_campaign.ts
```

Devnet mint options:
- **Demo mint we control** (what the deployed demo uses — lets us hand test-USDC
  to any phone wallet instantly): see `scripts/` + the values recorded in
  `DEVNET_STATE.md` after deployment.
- **Circle devnet USDC** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` —
  real-feeling demo; depositors self-serve test USDC at faucet.circle.com
  (select Solana Devnet), Phantom/Solflare switched to devnet.

## Mainnet — exact cost (REPORT ONLY; no spend without Lorin's go)

One-time, at current rent parameters (`solana rent`, measured 2026-07-11):

| Item | SOL |
|--------------------------------------------------------------|------------|
| Program deploy, default (2× size upgrade headroom, 558,717 B) | 3.8896 |
| — OR tight deploy `--max-len 279336` (no growth headroom) | 1.9454 |
| Program account (36 B) | 0.0011 |
| Campaign account (179 B) | 0.0021 |
| Vault token account (165 B) | 0.0020 |
| Tx fees + buffer for ops | ~0.05 |
| IDL on-chain (`anchor idl init`, optional — skip it) | 0.1144 |

**Bottom line: ~2.0 SOL (tight) or ~3.95 SOL (default headroom), one-time.**
Rent is a refundable deposit: `solana program close` later reclaims the
programdata rent to the authority (which also bricks the program — end-of-life
only). Each depositor pays their own ~0.0015 SOL receipt rent and gets it back
on withdraw/refund (receipt closes to them).

Mainnet switch checklist:
1. Fund `~/.config/solana/id.json` with ~2.1 SOL (tight) — **ask Lorin first**.
2. `solana config set -u mainnet-beta`
3. `anchor deploy --provider.cluster mainnet -- --max-len 279336` (tight; use
   default no-flag deploy if we want in-place upgrade headroom instead).
4. `init_campaign.ts` with `USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
   (Circle mainnet USDC) and the REAL buildout address (multisig when it exists).
5. Point `web/counter.js` + `web/demo.html` config at mainnet RPC + new campaign
   PDA. Public GitHub Pages traffic should use a free-tier private RPC
   (e.g. Helius) — `api.mainnet-beta.solana.com` rate-limits browsers.
6. Upgrade authority stays with the deployer key for now. Before serious money:
   transfer to a multisig or burn it (`solana program set-upgrade-authority --final`)
   so "the code can't change under you" is provable.

## Verification record (2026-07-11)

- Localnet: **15/15 tests passing** (`tests/escrow.ts`, run 2026-07-11), covering
  deposit/withdraw counter ticks, withdraw-AFTER-approval, dual release gates,
  wrong-destination rejection, post-release freeze, and the post-deadline
  permissionless refund crank. Re-run:
  `solana-test-validator --reset --quiet --deactivate-feature B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g &`
  then `anchor test --skip-local-validator`.
- Counter module: rendered correct live state from chain in a headless browser
  ("2 people · $40 escrowed · 100% of goal · FUNDED") against the localnet
  campaign, including PDA auto-discovery. JS-package note: the Anchor 1.x TS
  client is `@anchor-lang/core` (NOT `@coral-xyz/anchor`, which ends at 0.32);
  import `BN` from `bn.js` directly (the ESM namespace misses the re-export).
- Devnet deployment state (program, campaign PDA, demo mint, explorer links):
  `DEVNET_STATE.md` (written at deploy time).
