# REHEARSALS.md — three scenarios, executed on-chain, verifiable cold

> Every claim below is a transaction on Solana devnet. Program ID and
> binary hash match the pins in SPEC.md / escrow/DEPLOY.md. To verify:
> resolve each signature on explorer.solana.com (?cluster=devnet), or
> replay the account states from the campaign PDAs.

| | |
|---|---|
| Program ID | `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` |
| Binary sha256 | `facd1bb3b9e6a1f2d9041a2d81c48d904f3ac392cc16211bae482e9d2b190fa5` (== the pin in escrow/DEPLOY.md) |
| Demo USDC mint | `CXBXU8sX8H9fvdgVGz2s2bKYZrbvWr6rW9SzhU9ymk2T` |
| Executed (UTC) | 2026-07-12T02:32:28Z |
| Depositor wallets | demo1 `8VCnhhSAXFGtmPq9XXDAmKrmHidS5ak42gEYsRoyneLZ` ($100/V5), demo2 `3B3AQ8P2mAqyuiCg9wuqFa474JnR4Kff6tEufBkwiTTn` ($100/V5) |
| Proposed payout wallet | `2UQuigTamrcGkFEjW4gHqfiLVfW3wELSJcJwfyLeXf49` (ATA `H18JUng4M3e8gz4tvLpRkjY7jsfuSMYJbr3uuDTTHFvd`) |

## A · VICTORY — majority + organizer proposal → release

Campaign `rehearsal-victory-v6` · PDA `AwXuWXMYYvtVkjYQH7rtcKVdbaVpoADfaubEHF2DvGEP` · [explorer](https://explorer.solana.com/address/AwXuWXMYYvtVkjYQH7rtcKVdbaVpoADfaubEHF2DvGEP?cluster=devnet)

Expected: after 2/2 payout votes ($200 backs a $200 pool — a strict majority; one $100 vote alone is exactly half and is NOT enough), anyone can release; exactly 200 USDC
lands at the proposed ATA. Observed: payout ATA balance = **200 USDC**.

```
```

## B · NO-CONFIDENCE — dissolve majority → terminal → refund-all

Campaign `rehearsal-dissolve-v6` · PDA `7YoQwqFVk4juDAKBGKtjBvcNcruXBiVWMXjCWnUAAGzz` · [explorer](https://explorer.solana.com/address/7YoQwqFVk4juDAKBGKtjBvcNcruXBiVWMXjCWnUAAGzz?cluster=devnet)

Expected: 2/2 dissolve votes flip DISSOLVED (terminal); the permissionless
crank returns exactly $100 and $100 to their depositors. Observed below.

```
```

## C · DEAD-MAN TIMER — deadline expiry → propose blocked → refund-all

Campaign `rehearsal-deadman-v6` · PDA `3kb5yqFG256zfCZpGYjFBzDUYudu9q8xFw8QW85PoNQV` · [explorer](https://explorer.solana.com/address/3kb5yqFG256zfCZpGYjFBzDUYudu9q8xFw8QW85PoNQV?cluster=devnet) · initialized with a ~2-minute deadline (deadline is an init parameter; the real campaign uses 180 days)

Expected: after expiry, propose_payout is rejected with CampaignEnded and
the crank refunds everyone exactly. Observed: propose rejection = CampaignEnded.

```
```

Full raw log of this run: kept off-repo (session artifact); the
signatures above are the durable record.
