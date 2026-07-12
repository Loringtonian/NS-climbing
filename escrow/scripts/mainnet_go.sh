#!/usr/bin/env bash
# MAINNET bring-up. HUMAN-GATED: run only on Lorin's explicit go — this deploys
# real-money infrastructure and spends real SOL. The script double-checks by
# making you type MAINNET.
#
#   GOAL_USDC=5000 DEADLINE_DAYS=90 BUILDOUT=<pubkey> bash scripts/mainnet_go.sh
#
# Defaults: GOAL_USDC=5000 (rehearsal number — the REAL goal is Lorin's call),
# DEADLINE_DAYS=90, BUILDOUT=deployer wallet (swap to a multisig when it
# exists; it CANNOT be changed after init — a new campaign would be needed).
#
# Cost at current rent (2026-07-11): deploy --max-len 320000 = 2.2284 SOL
# programdata (reclaimable via `solana program close` at end-of-life)
# + 0.0011 program account + ~0.005 init (campaign+vault rent) + tx fees.
# Budget 2.4 SOL minimum on the deployer wallet; 2.5 comfortable.
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."

RPC=${RPC:-https://api.mainnet-beta.solana.com}
USDC=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v   # Circle USDC (mainnet)
DEADLINE_DAYS="${DEADLINE_DAYS:-180}"   # 180 days; contract caps at 180d
CAMPAIGN_ID="${CAMPAIGN_ID:-send-climbing}"   # MUST match the id in every web page's ESCROW_CONFIG
MAX_LEN="${MAX_LEN:-320000}"   # ~12% upgrade cushion over the 296,544-byte build

echo "THIS DEPLOYS TO MAINNET AND SPENDS REAL SOL."
echo "  deployer: $(solana address)   balance: $(solana balance -u "$RPC")"
echo "  campaign: $CAMPAIGN_ID   deadline: ${DEADLINE_DAYS}d   (no goal — raise-max; payout via dual-gate vote)"
echo "  payout: decided later — organizer proposes, depositor dollar-majority approves"
read -r -p "Type MAINNET to proceed: " CONFIRM
[ "$CONFIRM" = "MAINNET" ] || { echo "aborted"; exit 1; }

BAL=$(solana balance -u "$RPC" | awk '{print $1}')
awk "BEGIN{exit !($BAL >= 2.35)}" || { echo "need >= 2.35 SOL on the deployer, have $BAL — aborting"; exit 1; }

echo "== 1/3 deploy program (max-len $MAX_LEN) =="
solana program deploy target/deploy/ns_climb_escrow.so \
  --program-id target/deploy/ns_climb_escrow-keypair.json \
  --max-len "$MAX_LEN" -u "$RPC"

echo "== 2/3 init campaign (Circle USDC) =="
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=~/.config/solana/id.json \
CAMPAIGN_ID=$CAMPAIGN_ID DEADLINE_DAYS=$DEADLINE_DAYS \
USDC_MINT=$USDC npx ts-node scripts/init_campaign.ts | tee /tmp/init_campaign_mainnet.out
PDA=$(grep "campaign PDA:" /tmp/init_campaign_mainnet.out | awk '{print $3}')

echo "== 3/3 record state =="
PAGE="https://loringtonian.github.io/NS-climbing/escrow/web/demo.html?mint=$USDC&rpc=https://api.mainnet-beta.solana.com"
cat > MAINNET_STATE.md <<EOF
# MAINNET deployment state ($(date +%F))

| What         | Value |
|--------------|-------|
| Program      | 2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ |
| Campaign ID  | $CAMPAIGN_ID |
| Campaign PDA | $PDA |
| USDC mint    | $USDC (Circle) |
| Payout       | dual-gate: organizer proposes, depositor dollar-majority approves |
| Deposit page | $PAGE |
| Explorer     | https://explorer.solana.com/address/$PDA |

NEXT (in order):
1. Run the smoke-test protocol in DEPLOY.md — Lorin is depositor #1 with a real
   \$20 before ANY QR goes on a wall.
2. Update agents.md "Live campaign parameters" (cluster=mainnet, PDA, mint) + push.
3. Point web config defaults at mainnet (?rpc param already works; consider a
   private RPC — api.mainnet-beta rate-limits browsers under load).
EOF
cat MAINNET_STATE.md
echo
echo "PHONE URL — DO NOT QR YET. Two gates first:"
echo "  GATE 1 (web flip): demo.html still hardcodes DEVNET (audit fix — no URL params)."
echo "  Edit escrow/web/demo.html: set ESCROW_CONFIG + the page config block to"
echo "    rpc:      https://api.mainnet-beta.solana.com   (or the private RPC)"
echo "    campaign: $CAMPAIGN_ID"
echo "    mint:     $USDC"
echo "  commit + push + verify the LIVE page shows the mainnet counter."
echo "  GATE 2: the smoke test in DEPLOY.md (Lorin = depositor #1)."
echo "  GATE 3 (agent-legibility): update VERIFY_IT.md deployment-status table"
echo "    (Mainnet -> LIVE + program/campaign addresses) AND agents.md Live-campaign"
echo "    parameters; the paste-able prompt's links resolve to the updated files."
echo "    Commit + push both BEFORE the QR goes out."
echo "  Only then QR: $PAGE"
echo
echo "== GATE 4 — BURN THE UPGRADE AUTHORITY *BEFORE THE FIRST REAL DEPOSIT* =="
echo "LAUNCH-BLOCKING under the dollar-weighted trust model: the audited guarantees"
echo "only hold if the code can't change. Run the smoke test on SCRATCH campaigns"
echo "first (DEPLOY.md); once it passes, burn — then create the real campaign and"
echo "take deposits:"
echo "  solana program set-upgrade-authority 2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ --final -u \$RPC"
echo "Verify it took: 'solana program show 2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ -u \$RPC'"
echo "must show NO upgrade authority. The site + agents.md + VERIFY_IT already claim"
echo "this is burned — the burn is what makes the claim true. Do NOT skip it."
