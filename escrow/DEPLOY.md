# DEPLOY.md — MAINNET-FIRST (strategy pivot 2026-07-11: devnet faucets dry, Lorin funds real SOL)

**The path: localnet test suite (correctness gate, 18/18 green) → mainnet deploy
via `scripts/mainnet_go.sh` (human-gated) → the smoke-test protocol below →
QR goes on the wall.** Devnet instructions kept further down for reference only.

## Mainnet bring-up (human-gated)

1. Lorin sends SOL to the deployer wallet `84PE7wqGnj5bBJkcLzB3LviriK5XgF5fUU3VmTjhkss2`
   (`~/.config/solana/id.json`). **Send 2.5 SOL** — breakdown: programdata rent
   2.2284 (deploy `--max-len 320000`, ~12% upgrade cushion; reclaimable via
   `solana program close` at end-of-life) + 0.0011 program account + ~0.005
   campaign+vault rent + fees + slack. Tight alternative (`MAX_LEN=285480`):
   1.9881 rent → 2.2 SOL send, but zero room to ever patch the program.
2. On Lorin's explicit go: `GOAL_USDC=<real goal> BUILDOUT=<address> bash scripts/mainnet_go.sh`
   — the script echoes deployer/goal/buildout and requires typing MAINNET.
   BUILDOUT is IMMUTABLE after init; deployer wallet is the default, multisig
   preferred when it exists.
3. Run the smoke test below. Only then publish the QR.

## MAINNET SMOKE TEST — Lorin is depositor #1 (before any QR goes up)

Real-money loop test, ~10 minutes, from Lorin's phone with ~$25 USDC + ~0.01 SOL
in Phantom (mainnet, no network switching needed):

1. Open the deposit page URL printed by mainnet_go.sh (MAINNET_STATE.md) →
   "Open in Phantom" → connect.
2. **Deposit $20 (V1).** Confirm: wallet shows -20 USDC; page flips to
   "You're on the board — $20 escrowed ✓"; counter reads "1 × V1 · $20 escrowed".
3. **Withdraw.** Confirm: wallet shows +20 USDC back (exact); counter returns
   to zero; receipt rent (~0.0015 SOL) came back too.
4. **Re-deposit $20** and leave it in — campaign opens with its first real deposit.
5. Sanity on the explorer link in MAINNET_STATE.md: vault balance = 20 USDC,
   depositor_count = 1.
If ANY step misbehaves: stop, do not distribute the QR, report exactly what
happened (tx signatures + screenshots) — funds are withdrawable the whole time.

After the smoke test: update agents.md Live-campaign-parameters (cluster,
PDA, mint), push, and selling can start.

Binary: `target/deploy/ns_climb_escrow.so` — **301,896 bytes**, v2 build
(tiers + dissolve vote + Supporter Badge; 2026-07-11, anchor-cli 1.0.2 /
anchor-lang 1.1.2 / solana 4.1.1 / rustc 1.92.0).
**sha256 `780bf7588ea251407fb5fb3c960f71c221e3513fe98603e96c4711f870f2a6cf`** —
this exact artifact passed the full 30/30 suite on localnet; deploys ship this
file. Fits the existing --max-len 320000 devnet allocation, so devnet upgrades
in place (NOTE: v1 campaign accounts don't parse under the v2 layout — create
a fresh campaign after upgrading). Auditors: `solana program dump`, truncate
to 301,896 bytes, sha256 must match (procedure in agents.md).
Program ID `7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw` = pubkey of the
gitignored keypair `target/deploy/ns_climb_escrow-keypair.json`. If that file is
ever lost or you want a fresh ID: `solana-keygen new -o target/deploy/ns_climb_escrow-keypair.json`,
put the new pubkey in `declare_id!` (lib.rs), `Anchor.toml`, `web/counter.js`,
`web/demo.html`, and rebuild.

Toolchain (installed 2026-07-11):
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

## Devnet (REFERENCE ONLY — retired 2026-07-11, faucets were dry all day)

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

## Mainnet — cost table (numbers measured 2026-07-11 via `solana rent`)

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
