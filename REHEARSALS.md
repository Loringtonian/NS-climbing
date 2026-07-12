# REHEARSALS.md — three scenarios, executed on-chain, verifiable cold

> Every claim below is a transaction on Solana devnet. Program ID and
> binary hash match the pins in SPEC.md / escrow/DEPLOY.md. To verify:
> resolve each signature on explorer.solana.com (?cluster=devnet), or
> replay the account states from the campaign PDAs.

| | |
|---|---|
| Program ID | `2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ` |
| Binary sha256 | `0656436312f777e9c382eea98a40af75dc6acfaf65789aefaef0ce6746af646b` (== the pin in escrow/DEPLOY.md) |
| Demo USDC mint | `CXBXU8sX8H9fvdgVGz2s2bKYZrbvWr6rW9SzhU9ymk2T` |
| Executed (UTC) | 2026-07-12T00:42:26Z |
| Depositor wallets | demo1 `8VCnhhSAXFGtmPq9XXDAmKrmHidS5ak42gEYsRoyneLZ` ($100/V5), demo2 `3B3AQ8P2mAqyuiCg9wuqFa474JnR4Kff6tEufBkwiTTn` ($100/V5) |
| Proposed payout wallet | `FndYhs2L9TLMFz7PNPWkLnEaup2zPxDy5LUmB89KvyQ8` (ATA `6X9cBy9eHJuQdEVTCU7sH3fLdYxytq4D596HAnJ7f4H`) |

## A · VICTORY — majority + organizer proposal → release

Campaign `rehearsal-victory-v5` · PDA `G8dYejb8R9drTLqcUipcXwgmCtqMC5EfVn99khMSyHcf` · [explorer](https://explorer.solana.com/address/G8dYejb8R9drTLqcUipcXwgmCtqMC5EfVn99khMSyHcf?cluster=devnet)

Expected: after 2/2 payout votes ($200 backs a $200 pool — a strict majority; one $100 vote alone is exactly half and is NOT enough), anyone can release; exactly 200 USDC
lands at the proposed ATA. Observed: payout ATA balance = **200 USDC**.

```
```

## B · NO-CONFIDENCE — dissolve majority → terminal → refund-all

Campaign `rehearsal-dissolve-v5` · PDA `6e1omWmgR6Cr5EaSbWqBeasSpV5WvM3F1oAvPP38i7Q6` · [explorer](https://explorer.solana.com/address/6e1omWmgR6Cr5EaSbWqBeasSpV5WvM3F1oAvPP38i7Q6?cluster=devnet)

Expected: 2/2 dissolve votes flip DISSOLVED (terminal); the permissionless
crank returns exactly $100 and $100 to their depositors. Observed below.

```
```

## C · DEAD-MAN TIMER — deadline expiry → propose blocked → refund-all

Campaign `rehearsal-deadman-v5` · PDA `DWVUk8nUqSjJVfSzBabpuT1ij3bmCTPaZdtbLLhDGy4k` · [explorer](https://explorer.solana.com/address/DWVUk8nUqSjJVfSzBabpuT1ij3bmCTPaZdtbLLhDGy4k?cluster=devnet) · initialized with a ~2-minute deadline (deadline is an init parameter; the real campaign uses ~6 months / 180 days)

Expected: after expiry, propose_payout is rejected with CampaignEnded and
the crank refunds everyone exactly. Observed: propose rejection = CampaignEnded.

```
```

Full raw log of this run: kept off-repo (session artifact); the
signatures above are the durable record.
