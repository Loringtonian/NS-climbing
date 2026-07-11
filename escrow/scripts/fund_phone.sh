#!/usr/bin/env bash
# Fund a phone wallet for the devnet tap-through in one shot: a pinch of devnet
# SOL (fees + receipt rent) + demo USDC minted to their ATA. 2 minutes total.
#
#   bash scripts/fund_phone.sh <PHONE_WALLET_ADDRESS> [USDC_DOLLARS] [SOL]
#
# Defaults: 1100 demo-USDC (covers any tier incl. V10 + a retry), 0.05 SOL.
# Mint comes from DEVNET_STATE.md (written by devnet_go.sh) or $USDC_MINT.
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."

ADDR="${1:?usage: fund_phone.sh <address> [usdc_dollars] [sol]}"
USD="${2:-1100}"
SOL="${3:-0.05}"
MINT="${USDC_MINT:-$(grep "Demo mint" DEVNET_STATE.md | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -1)}"
[ -n "$MINT" ] || { echo "no demo mint found — run devnet_go.sh first or set USDC_MINT"; exit 1; }

echo "funding $ADDR: $SOL SOL + $USD demo-USDC (mint $MINT)"
solana transfer "$ADDR" "$SOL" --allow-unfunded-recipient -u devnet
spl-token create-account "$MINT" --owner "$ADDR" --fee-payer ~/.config/solana/id.json -u devnet 2>/dev/null || true
ATA=$(spl-token address --token "$MINT" --owner "$ADDR" --verbose -u devnet | grep -i "associated" | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -1)
spl-token mint "$MINT" "$USD" "$ATA" -u devnet
echo "done: $ADDR has $SOL SOL + $USD demo-USDC. Phantom must be in devnet mode (Settings -> Developer)."
