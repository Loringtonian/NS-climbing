#!/usr/bin/env bash
# Devnet bring-up for the cheer board: deploy ns_cheer + init/delegate a board
# on MagicBlock's PUBLIC devnet ER router — the publicly-visible integration.
# Costs ~2.24 SOL rent (--max-len 320000) + fees, devnet SOL only.
#
#   bash scripts/devnet_go_cheer.sh
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."

BAL=$(solana balance -u devnet | awk '{print $1}')
echo "deployer devnet balance: $BAL SOL"
awk "BEGIN{exit !($BAL >= 2.3)}" || { echo "need >= 2.3 SOL for cheer deploy, aborting"; exit 1; }

echo "== 1/3 deploy ns_cheer to devnet =="
solana program deploy target/deploy/ns_cheer.so \
  --program-id target/deploy/ns_cheer-keypair.json --max-len 320000 -u devnet

echo "== 2/3 init + delegate board (MagicBlock devnet router, Asia ER) =="
# init_board.cjs defaults: BASE=api.devnet.solana.com, ER=devnet-router.magicblock.app,
# validator MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57 (Asia)
node scripts/init_board.cjs | tee /tmp/init_board_devnet.out
BOARD=$(grep "board PDA:" /tmp/init_board_devnet.out | awk '{print $3}')

echo "== 3/3 record =="
cat >> ../escrow/DEVNET_STATE.md <<EOF

## Cheer board (devnet, MagicBlock ER router) — $(date +%F)

| What          | Value |
|---------------|-------|
| Program       | FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz |
| Board PDA     | $BOARD (delegated to the devnet ER) |
| Phone page    | https://loringtonian.github.io/NS-climbing/cheerboard/web/cheer.html?board=$BOARD&rpc=https%3A%2F%2Fdevnet-router.magicblock.app |
| Projector     | https://loringtonian.github.io/NS-climbing/cheerboard/web/tally.html?board=$BOARD&rpc=https%3A%2F%2Fdevnet-router.magicblock.app |
| Explorer (program) | https://explorer.solana.com/address/FxkompVBzfCN6HsZpbwGW72AanCaFkAFiEcMqoi9c3Wz?cluster=devnet |
| Explorer (board)   | https://explorer.solana.com/address/$BOARD?cluster=devnet |

End a session (undelegate -> tally commits to base): \`node scripts/end_board.cjs\` from cheerboard/.
EOF
tail -20 ../escrow/DEVNET_STATE.md
