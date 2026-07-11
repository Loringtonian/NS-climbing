#!/usr/bin/env bash
# Devnet VICTORY rehearsal: the full happy path on the live cluster —
# deposits -> propose_payout -> votes to majority -> release -> funds land
# at exactly the proposed address. Prints every signature.
#
#   CAMPAIGN_ID=<id> bash scripts/victory_rehearsal.sh
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."

R=${RPC:-https://api.devnet.solana.com}
M=${USDC_MINT:-4k4aakX2MycnKcw6Urvurjxvn4WCYimFPhG3UDBGiZMD}
C=${CAMPAIGN_ID:?set CAMPAIGN_ID}
E() { ANCHOR_PROVIDER_URL=$R ANCHOR_WALLET=~/.config/solana/id.json CAMPAIGN_ID=$C USDC_MINT=$M "$@"; }

echo "== deposits =="
E env ACTION=deposit AMOUNT_USD=100 WALLET_FILE=keys/demo1.json npx ts-node scripts/demo_flow.ts | grep -E "deposited|state:"
E env ACTION=deposit AMOUNT_USD=20  WALLET_FILE=keys/demo2.json npx ts-node scripts/demo_flow.ts | grep -E "deposited|state:"

echo "== organizer proposes payout =="
# dedicated demo payout wallet (gitignored keys/)
if [ ! -f keys/payout_demo.json ]; then solana-keygen new --no-bip39-passphrase -s -o keys/payout_demo.json >/dev/null; fi
PAYOUT=$(solana-keygen pubkey keys/payout_demo.json)
PAYOUT_ATA=$(spl-token create-account "$M" --owner "$PAYOUT" --fee-payer ~/.config/solana/id.json -u devnet --output json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['commandOutput']['address'])" || spl-token address --token "$M" --owner "$PAYOUT" --verbose -u devnet | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | tail -1)
echo "payout wallet: $PAYOUT  ata: $PAYOUT_ATA"
E env ACTION=propose PAYOUT=$PAYOUT npx ts-node scripts/admin.ts | grep -E "proposed|state|Votes" || true

echo "== depositor votes to majority =="
E env ACTION=vote-payout WALLET_FILE=keys/demo1.json npx ts-node scripts/vote_demo.ts | grep -E "vote|dissolve:"
E env ACTION=vote-payout WALLET_FILE=keys/demo2.json npx ts-node scripts/vote_demo.ts | grep -E "vote|dissolve:"

echo "== permissionless release =="
E env ACTION=release PAYOUT_TOKEN=$PAYOUT_ATA npx ts-node scripts/admin.ts | grep -E "released|proposedPayout|payoutVotes|released:"

echo "== funds landed =="
spl-token balance --address "$PAYOUT_ATA" -u devnet
echo "VICTORY_OK — explorer: https://explorer.solana.com/address/$PAYOUT_ATA?cluster=devnet"
