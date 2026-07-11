#!/usr/bin/env bash
# One-shot devnet bring-up, runnable the moment the deployer wallet has ~2.8 SOL.
# deploy program -> create demo USDC mint -> init campaign -> scripted
# deposit+withdraw rehearsal -> print state, page URLs, and DEVNET_STATE.md.
#
#   GOAL_USDC=5000 DEADLINE_DAYS=90 BUILDOUT=<pubkey> bash scripts/devnet_go.sh
#
# GOAL_USDC defaults to 5000 — Lorin's chosen goal (2026-07-11). BUILDOUT defaults to the deployer wallet.
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."

RPC=https://api.devnet.solana.com
DEADLINE_DAYS="${DEADLINE_DAYS:-90}"
CAMPAIGN_ID="${CAMPAIGN_ID:-ns-climbing-wall}"

BAL=$(solana balance -u devnet | awk '{print $1}')
echo "deployer balance: $BAL SOL"
awk "BEGIN{exit !($BAL >= 2.3)}" || { echo "need >= 2.3 SOL, aborting"; exit 1; }

echo "== 1/5 deploy program =="
solana program deploy target/deploy/ns_climb_escrow.so \
  --program-id target/deploy/ns_climb_escrow-keypair.json --max-len 320000 -u devnet

echo "== 2/5 create demo USDC mint (6 decimals, we control minting) =="
MINT=$(spl-token create-token --decimals 6 -u devnet --output json | python3 -c "import json,sys; print(json.load(sys.stdin)['commandOutput']['address'])")
echo "demo mint: $MINT"

echo "== 3/5 init campaign =="
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=~/.config/solana/id.json \
CAMPAIGN_ID=$CAMPAIGN_ID DEADLINE_DAYS=$DEADLINE_DAYS \
USDC_MINT=$MINT npx ts-node scripts/init_campaign.ts | tee /tmp/init_campaign.out
PDA=$(grep "campaign PDA:" /tmp/init_campaign.out | awk '{print $3}')

echo '== 4/5 rehearsal: \$20 deposit -> withdraw -> \$100 deposit (tier checks) =='
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=~/.config/solana/id.json CAMPAIGN_ID=$CAMPAIGN_ID \
  USDC_MINT=$MINT ACTION=deposit AMOUNT_USD=20 WALLET_FILE=keys/demo1.json npx ts-node scripts/demo_flow.ts
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=~/.config/solana/id.json CAMPAIGN_ID=$CAMPAIGN_ID \
  USDC_MINT=$MINT ACTION=withdraw WALLET_FILE=keys/demo1.json npx ts-node scripts/demo_flow.ts
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=~/.config/solana/id.json CAMPAIGN_ID=$CAMPAIGN_ID \
  USDC_MINT=$MINT ACTION=deposit AMOUNT_USD=100 WALLET_FILE=keys/demo1.json npx ts-node scripts/demo_flow.ts

echo "== 5/5 record state =="
PAGE="https://loringtonian.github.io/NS-climbing/escrow/web/demo.html?mint=$MINT"
cat > DEVNET_STATE.md <<EOF
# Devnet deployment state ($(date +%F))

| What         | Value |
|--------------|-------|
| Program      | 42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD |
| Campaign ID  | $CAMPAIGN_ID |
| Campaign PDA | $PDA |
| Demo mint    | $MINT (we control minting — fund a phone wallet: \`spl-token mint $MINT 20 <their-ata> -u devnet\` or scripts/demo_flow.ts) |
| Payout       | dual-gate: organizer proposes, depositor majority approves |
| Deposit page | $PAGE |
| Explorer     | https://explorer.solana.com/address/$PDA?cluster=devnet |

Ceremony rehearsed at deploy time: scripted deposit -> withdraw -> deposit all
confirmed (see terminal log). NEXT: update agents.md "Live campaign parameters"
with the PDA + mint above.
EOF
cat DEVNET_STATE.md
echo
echo "PHONE URL (QR this): $PAGE"
