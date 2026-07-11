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
GOAL_USDC="${GOAL_USDC:-5000}"
DEADLINE_DAYS="${DEADLINE_DAYS:-90}"
CAMPAIGN_ID="${CAMPAIGN_ID:-ns-climbing-wall}"
MAX_LEN="${MAX_LEN:-320000}"   # ~12% upgrade cushion over the 285,480-byte build

echo "THIS DEPLOYS TO MAINNET AND SPENDS REAL SOL."
echo "  deployer: $(solana address)   balance: $(solana balance -u "$RPC")"
echo "  campaign: $CAMPAIGN_ID   goal: $GOAL_USDC USDC   deadline: ${DEADLINE_DAYS}d"
echo "  buildout: ${BUILDOUT:-$(solana address)} (IMMUTABLE after init)"
read -r -p "Type MAINNET to proceed: " CONFIRM
[ "$CONFIRM" = "MAINNET" ] || { echo "aborted"; exit 1; }

BAL=$(solana balance -u "$RPC" | awk '{print $1}')
awk "BEGIN{exit !($BAL >= 2.35)}" || { echo "need >= 2.35 SOL on the deployer, have $BAL — aborting"; exit 1; }

echo "== 1/3 deploy program (max-len $MAX_LEN) =="
solana program deploy target/deploy/ns_climb_escrow.so \
  --program-id target/deploy/ns_climb_escrow-keypair.json \
  --max-len "$MAX_LEN" -u "$RPC"

echo "== 2/3 init campaign (Circle USDC) =="
BUILDOUT="${BUILDOUT:-$(solana address)}"
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=~/.config/solana/id.json \
CAMPAIGN_ID=$CAMPAIGN_ID GOAL_USDC=$GOAL_USDC DEADLINE_DAYS=$DEADLINE_DAYS \
BUILDOUT=$BUILDOUT USDC_MINT=$USDC npx ts-node scripts/init_campaign.ts | tee /tmp/init_campaign_mainnet.out
PDA=$(grep "campaign PDA:" /tmp/init_campaign_mainnet.out | awk '{print $3}')

echo "== 3/3 record state =="
PAGE="https://loringtonian.github.io/NS-climbing/escrow/web/demo.html?mint=$USDC&rpc=https://api.mainnet-beta.solana.com"
cat > MAINNET_STATE.md <<EOF
# MAINNET deployment state ($(date +%F))

| What         | Value |
|--------------|-------|
| Program      | 7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw |
| Campaign ID  | $CAMPAIGN_ID |
| Campaign PDA | $PDA |
| USDC mint    | $USDC (Circle) |
| Buildout     | $BUILDOUT |
| Goal         | $GOAL_USDC USDC |
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
echo "== UPGRADE AUTHORITY — scheduled within the week (disclosed; not launch-blocking) =="
echo "Current authority: the deployer key (held by Lorin, disclosed in agents.md)."
echo "Within a week of launch, run ONE of:"
echo "  # hand to a multisig:"
echo "  solana program set-upgrade-authority 7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw \\"
echo "    --new-upgrade-authority <MULTISIG_PUBKEY> -u \$RPC"
echo "  # or burn it (program becomes immutable forever):"
echo "  solana program set-upgrade-authority 7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw --final -u \$RPC"
echo "Then update the disclosure lines in agents.md + demo.html."
