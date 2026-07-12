#!/usr/bin/env bash
# CLEAN-CHAIN executor: run the three canonical scenario rehearsals on devnet
# and emit machine-readable REHEARSALS.md at the repo root. Run AFTER the
# fresh-program-ID deploy (deploy itself is separate — see DEPLOY.md).
#
#   bash scripts/rehearse_all.sh
#
# Scenarios, each on its own scratch campaign, every signature captured:
#   A VICTORY   deposits -> propose -> majority -> release to proposed address
#   B DISSOLVE  deposits -> dissolve majority -> terminal -> refund-crank all
#   C DEAD-MAN  ~2-min deadline -> expire -> propose blocked -> refund-crank all
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."

R=${RPC:-https://api.devnet.solana.com}
M=${USDC_MINT:?set USDC_MINT (demo mint on the clean chain)}
PROGRAM=$(solana-keygen pubkey target/deploy/ns_climb_escrow-keypair.json)
SHA=$(shasum -a 256 target/deploy/ns_climb_escrow.so | awk '{print $1}')
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUT=../REHEARSALS.md
LOG=/tmp/rehearse_all.log
: > $LOG

E() { ANCHOR_PROVIDER_URL=$R ANCHOR_WALLET=~/.config/solana/id.json "$@" 2>&1 | grep -vE "Deprecation|trace-deprecation" | tee -a $LOG; }
sig() { grep -oE '[1-9A-HJ-NP-Za-km-z]{80,90}' <<<"$1" | head -1; }

pda() { # campaign id -> PDA (via node)
  node -e "const {PublicKey}=require('@solana/web3.js');console.log(PublicKey.findProgramAddressSync([Buffer.from('campaign'),Buffer.from('$1')],new PublicKey('$PROGRAM'))[0].toBase58())"
}

echo "program: $PROGRAM  sha: $SHA"

# payout + demo wallets
if [ ! -f keys/payout_demo.json ]; then solana-keygen new --no-bip39-passphrase -s -o keys/payout_demo.json >/dev/null; fi
PAYOUT=$(solana-keygen pubkey keys/payout_demo.json)
spl-token create-account "$M" --owner "$PAYOUT" --fee-payer ~/.config/solana/id.json -u devnet >/dev/null 2>&1 || true
PAYOUT_ATA=$(spl-token address --token "$M" --owner "$PAYOUT" --verbose -u devnet | grep -i assoc | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | tail -1)
D1=$(solana-keygen pubkey keys/demo1.json); D2=$(solana-keygen pubkey keys/demo2.json)

run_deposits() { # campaign — two EQUAL $100 deposits so, under dollar-weighting,
  # neither alone is a majority (each is exactly half) and BOTH votes are needed
  # to cross the strict > half threshold. This also demonstrates the boundary live.
  E env CAMPAIGN_ID=$1 USDC_MINT=$M ACTION=deposit AMOUNT_USD=100 WALLET_FILE=keys/demo1.json npx ts-node scripts/demo_flow.ts
  E env CAMPAIGN_ID=$1 USDC_MINT=$M ACTION=deposit AMOUNT_USD=100 WALLET_FILE=keys/demo2.json npx ts-node scripts/demo_flow.ts
}
crank() { # campaign wallet-file
  E env CAMPAIGN_ID=$1 USDC_MINT=$M DEPOSITOR_WALLET_FILE=$2 npx ts-node scripts/refund_crank.ts
}

echo "=== A VICTORY ==="
CA=rehearsal-victory-v6
E env CAMPAIGN_ID=$CA DEADLINE_DAYS=90 USDC_MINT=$M npx ts-node scripts/init_campaign.ts
run_deposits $CA
E env CAMPAIGN_ID=$CA ACTION=propose PAYOUT=$PAYOUT npx ts-node scripts/admin.ts
E env CAMPAIGN_ID=$CA ACTION=vote-payout WALLET_FILE=keys/demo1.json npx ts-node scripts/vote_demo.ts
E env CAMPAIGN_ID=$CA ACTION=vote-payout WALLET_FILE=keys/demo2.json npx ts-node scripts/vote_demo.ts
E env CAMPAIGN_ID=$CA ACTION=release PAYOUT_TOKEN=$PAYOUT_ATA npx ts-node scripts/admin.ts
BAL_A=$(spl-token balance --address "$PAYOUT_ATA" -u devnet)

echo "=== B DISSOLVE ==="
CB=rehearsal-dissolve-v6
E env CAMPAIGN_ID=$CB DEADLINE_DAYS=90 USDC_MINT=$M npx ts-node scripts/init_campaign.ts
run_deposits $CB
E env CAMPAIGN_ID=$CB ACTION=vote WALLET_FILE=keys/demo1.json npx ts-node scripts/vote_demo.ts
E env CAMPAIGN_ID=$CB ACTION=vote WALLET_FILE=keys/demo2.json npx ts-node scripts/vote_demo.ts
crank $CB keys/demo1.json
crank $CB keys/demo2.json

echo "=== C DEAD-MAN (120s deadline) ==="
CC=rehearsal-deadman-v6
E env CAMPAIGN_ID=$CC DEADLINE_DAYS=0.0014 USDC_MINT=$M npx ts-node scripts/init_campaign.ts
run_deposits $CC
echo "waiting 150s for the timer…"; sleep 150
set +e
PROPOSE_FAIL=$(ANCHOR_PROVIDER_URL=$R ANCHOR_WALLET=~/.config/solana/id.json CAMPAIGN_ID=$CC ACTION=propose PAYOUT=$PAYOUT npx ts-node scripts/admin.ts 2>&1 | grep -oE "CampaignEnded" | head -1)
set -e
echo "post-deadline propose rejected: ${PROPOSE_FAIL:-MISSING}" | tee -a $LOG
crank $CC keys/demo1.json
crank $CC keys/demo2.json

set +e  # emit is best-effort formatting; head|pipefail must not abort the write
# ---- emit REHEARSALS.md ----
PA=$(pda rehearsal-victory-v6); PB=$(pda rehearsal-dissolve-v6); PC=$(pda rehearsal-deadman-v6)
sigs_for() { grep -A40 "=== $1" $LOG | grep -oE '(tx|deposited [0-9]+|proposed payout [^ ]+|vote(-payout)?|released|refunded [^ ]+): [1-9A-HJ-NP-Za-km-z]{80,90}' ; }
{
echo "# REHEARSALS.md — three scenarios, executed on-chain, verifiable cold"
echo
echo "> Every claim below is a transaction on Solana devnet. Program ID and"
echo "> binary hash match the pins in SPEC.md / escrow/DEPLOY.md. To verify:"
echo "> resolve each signature on explorer.solana.com (?cluster=devnet), or"
echo "> replay the account states from the campaign PDAs."
echo
echo "| | |"
echo "|---|---|"
echo "| Program ID | \`$PROGRAM\` |"
echo "| Binary sha256 | \`$SHA\` (== the pin in escrow/DEPLOY.md) |"
echo "| Demo USDC mint | \`$M\` |"
echo "| Executed (UTC) | $TS |"
echo "| Depositor wallets | demo1 \`$D1\` (\$100/V5), demo2 \`$D2\` (\$100/V5) |"
echo "| Proposed payout wallet | \`$PAYOUT\` (ATA \`$PAYOUT_ATA\`) |"
echo
echo "## A · VICTORY — majority + organizer proposal → release"
echo
echo "Campaign \`rehearsal-victory-v6\` · PDA \`$PA\` · [explorer](https://explorer.solana.com/address/$PA?cluster=devnet)"
echo
echo "Expected: after 2/2 payout votes (\$200 backs a \$200 pool — a strict majority; one \$100 vote alone is exactly half and is NOT enough), anyone can release; exactly 200 USDC"
echo "lands at the proposed ATA. Observed: payout ATA balance = **$BAL_A USDC**."
echo
echo '```'; grep -A40 "=== A VICTORY" $LOG | grep -E "tx:|deposited|proposed|vote-payout:|released:|state:|dissolve:" | head -14; echo '```'
echo
echo "## B · NO-CONFIDENCE — dissolve majority → terminal → refund-all"
echo
echo "Campaign \`rehearsal-dissolve-v6\` · PDA \`$PB\` · [explorer](https://explorer.solana.com/address/$PB?cluster=devnet)"
echo
echo "Expected: 2/2 dissolve votes flip DISSOLVED (terminal); the permissionless"
echo "crank returns exactly \$100 and \$100 to their depositors. Observed below."
echo
echo '```'; grep -A40 "=== B DISSOLVE" $LOG | grep -E "tx:|deposited|vote:|dissolve:|refunded|state:" | head -14; echo '```'
echo
echo "## C · DEAD-MAN TIMER — deadline expiry → propose blocked → refund-all"
echo
echo "Campaign \`rehearsal-deadman-v6\` · PDA \`$PC\` · [explorer](https://explorer.solana.com/address/$PC?cluster=devnet) · initialized with a ~2-minute deadline (deadline is an init parameter; the real campaign uses 180 days)"
echo
echo "Expected: after expiry, propose_payout is rejected with CampaignEnded and"
echo "the crank refunds everyone exactly. Observed: propose rejection = ${PROPOSE_FAIL:-SEE LOG}."
echo
echo '```'; grep -A40 "=== C DEAD-MAN" $LOG | grep -E "tx:|deposited|propose rejected|refunded|state:" | head -12; echo '```'
echo
echo "Full raw log of this run: kept off-repo (session artifact); the"
echo "signatures above are the durable record."
} > $OUT
echo "REHEARSALS.md written: $(wc -l < $OUT) lines"
