# DEPLOY.md — MAINNET-FIRST (strategy pivot 2026-07-11: devnet faucets dry, Lorin funds real SOL)

**The path: localnet test suite (correctness gate, 19/19 green) → mainnet deploy
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

## MAINNET SMOKE TEST — Lorin rehearses the collective loop alone (before any QR)

Deposits are LOCKED (no individual withdraw), so the smoke test uses a SCRATCH
campaign where Lorin is the sole depositor — one person IS a strict majority
of one, so he can exercise the full collective machinery solo, with real money,
~15 minutes, ~$25 USDC + ~0.01 SOL in mainnet Phantom:

1. Init a scratch campaign (e.g. CAMPAIGN_ID=ns-wall-smoke) via init_campaign.ts.
2. Point a LOCAL copy of the deposit page at it (do not push); deposit $20 (V1).
   Confirm: wallet -20 USDC; badge shows "$20 locked in the pool ✓"; counter
   reads "1 × V1 · $20 raised".
3. VICTORY leg: propose_payout to a second wallet Lorin controls
   (`ACTION=propose PAYOUT=… admin.ts`), vote yes from Phantom (1/1 = majority),
   release (`ACTION=release PAYOUT_TOKEN=…`). Confirm exactly $20 lands there.
4. DISSOLVE leg (fresh scratch campaign #2): deposit $20 → vote dissolve from
   the page (1/1 majority → DISSOLVED) → run the refund crank
   (`scripts/refund_crank.ts`) → confirm exactly $20 returns to his wallet.
5. Explorer sanity on both campaigns. If ANY step misbehaves: stop, no QR,
   report signatures.
6. THEN init the REAL campaign (send-climbing), flip the web config to it,
   push, verify live — and selling starts.

After the smoke test: update agents.md Live-campaign-parameters (cluster,
PDA, mint), push, and selling can start.

Binary: `target/deploy/ns_climb_escrow.so` — **296,544 bytes**, v4 build (locked pool + DOLLAR-WEIGHTED dual-gate + refunds-only post-deadline + 6-month deadline cap)
(tiers + dissolve vote + Supporter Badge; 2026-07-11, anchor-cli 1.0.2 /
anchor-lang 1.1.2 / solana 4.1.1 / rustc 1.92.0).
**sha256 `0656436312f777e9c382eea98a40af75dc6acfaf65789aefaef0ce6746af646b`** —
this exact artifact passed 19/19 on localnet via --skip-build (auditor freeze protocol, 2026-07-11; hash byte-identical before and after the run, and reproducible across clean rebuilds); deploys ship this
file. Fits the existing --max-len 320000 devnet allocation, so devnet upgrades
in place (NOTE: v1 campaign accounts don't parse under the v2 layout — create
a fresh campaign after upgrading). Auditors: `solana program dump`, truncate
to 296,544 bytes, sha256 must match (procedure in agents.md).
Program ID `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` = pubkey of the
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
CAMPAIGN_ID=send-climbing GOAL_USDC=2000 DEPOSIT_USDC=20 DEADLINE_DAYS=30 \
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

- Localnet: **full suite passing** (test count grows with features; the binary-pinned run lives in the Binary line above) (`tests/escrow.ts`, run 2026-07-11), covering
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
