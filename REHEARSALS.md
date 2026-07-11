# REHEARSALS.md — three scenarios, executed on-chain, verifiable cold

> Every claim below is a transaction on Solana **devnet**. The program and
> binary match the pins in `SPEC.md` / `escrow/DEPLOY.md`. To verify: resolve
> any signature at `https://explorer.solana.com/tx/<signature>?cluster=devnet`,
> or read the campaign PDAs' account states. This program ID's entire on-chain
> history is: one deploy, these three rehearsals, and the phone-test campaign
> — nothing else.

| | |
|---|---|
| Program ID | `42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD` |
| Deploy signature | `4tvyirEKwkeqQh68kkADydbhvRUMxUYMAi6qzgyfqzuh88Rf6PknN9PhftY3pwqaAmLunVwZXkQP7MRcR5fwtV5X` |
| Binary sha256 | `b6fdd452de20636b7e5a16025bbf16b5e972e4ffef8686d55d1ea2ac9cacd7f7` (== the pin in `escrow/DEPLOY.md`; trim the program dump to 295,112 bytes and hash it) |
| Demo USDC mint | `4k4aakX2MycnKcw6Urvurjxvn4WCYimFPhG3UDBGiZMD` (devnet test mint, 6 decimals) |
| Executed (UTC) | 2026-07-11 ~10:13–10:20 |
| Depositors | demo1 `8VCnhhSAXFGtmPq9XXDAmKrmHidS5ak42gEYsRoyneLZ` ($100 / V5) · demo2 `3B3AQ8P2mAqyuiCg9wuqFa474JnR4Kff6tEufBkwiTTn` ($20 / V1) |
| Proposed payout | wallet `DEUJCsLb3pSMmYRYJ8MKve33TwTzE3RRG286u8NmBzEV` · ATA `9UZrd6RTSV2TZh9RzrUjKHno43yVG83xvGVoFR47KXCQ` |

## A · VICTORY — organizer proposal + depositor majority → release

Campaign `rehearsal-victory` · PDA `EPn2YereVzMyTb839wjGRQ4Uzavp5gcs4fmupw3ywcUi` · [account](https://explorer.solana.com/address/EPn2YereVzMyTb839wjGRQ4Uzavp5gcs4fmupw3ywcUi?cluster=devnet)

**Expected:** deposits lock $120; after the organizer proposes and BOTH
depositors (2/2, strict majority) vote yes, anyone can release; exactly
120 USDC (one transfer) lands at the proposed address's ATA.
**Observed:** all transactions confirmed in order; the release transaction
`Q7d2Thdj…` transfers 120 USDC vault→ATA (inspect it on the explorer);
campaign account shows `released: true`.

| # | Action | Signature |
|---|--------|-----------|
| 1 | initialize_campaign | `3xikpZzwV6rgxSJGYNbQoj15kUwhNdQ1PCzDkYrLn7ttFjU6QFqykGgWNXz1paThycHVgpvyiY8HxQevsgLyBSkH` |
| 2 | deposit $100 (demo1) | `CsSrrgXDFicth7VKndn9xeqoebkfxnUB6buixHPcJTcrKvavwTFRVDDu71E4Vo86m1NaJH2LY6ZDywQhQaBsy2X` |
| 3 | deposit $20 (demo2) | `T2ifwXKJeVbXYrL2PzxY1Tge1wwi9DPq4JFKU3WrWu1rNaiDPvV6sfYgWnboTi6PerbF9Gq7QpucXV7HCCtkoJv` |
| 4 | propose_payout (organizer) | `5ZLUmc5QXbUjPB9u38aRQ56H2ghex3EHUbtfNj7rxxi8VZzjmKRrZ9RJMBJsTdhd4coL3jm9n8ne7qyLhDVyox1Z` |
| 5 | vote_payout demo1 (1/2 — no release possible) | `48otmXgT5Zkc8nK9WFzjoAaCeY2T7XsLvyfkBVJjWnCJEsgZzUTfbW6qzD15ZLLpba5LHpc4Px6PyfDv66buyJMY` |
| 6 | vote_payout demo2 (2/2 — strict majority) | `4GCNaimDMggRDf5xxkuWaU6pZJiPNEAW7m6CffCJKKWNNfkLionW3hNqGdWSh15znD2pbTbDGfvvwtho2UibMpFY` |
| 7 | release (permissionless) → 120 USDC to the proposed ATA | `Q7d2ThdjaEGdEeKGHCUs5ENG5fVZ5xVo57aMDQFGR3FYwukBQAyKnRHyzo5PhBEPgUGXvDL48JXGKEKjDBH7x1S` |

## B · NO-CONFIDENCE — dissolve majority → terminal → refund-all

Campaign `rehearsal-dissolve` · PDA `5SKZs7Do5xhhk5DuMN3hmM9WSC8tvQgwQSCKkdVtsGDe` · [account](https://explorer.solana.com/address/5SKZs7Do5xhhk5DuMN3hmM9WSC8tvQgwQSCKkdVtsGDe?cluster=devnet)

**Expected:** deposits lock $120; the first dissolve vote (1/2) does NOT flip
the campaign (exactly half is not a strict majority); the second (2/2) flips
DISSOLVED — terminal; the permissionless crank then returns exactly $100 to
demo1 and $20 to demo2. **Observed:** vote 1 left `dissolved: false`, vote 2
flipped `dissolved: true`; both refunds confirmed; final state 0 depositors, $0.

| # | Action | Signature |
|---|--------|-----------|
| 1 | initialize_campaign | `4DFu3wfgbU1VSdCG8DsiuHC8wSFyDunmPmLpgNRLQ11BNPNxwPqSqqqTQMP2RQaWR1yWzWFs3nondnSFWe65Zd9F` |
| 2 | deposit $100 (demo1) | `2eakQesZDtiC9bbrhm1nXaLTdKCFkBuECMq66uW6ja9HWo1JVsuEDN3dMJW5MnojpEfEuH3YoEX22gTRHursioFx` |
| 3 | deposit $20 (demo2) | `2uyB8nBuwu1KG3eLH4P4QYD2fHSxmurEsALSnYhJfk2uJtPx2jXoYn4Li7rtgHkj85NEqB7ZdoFSEFUJsTeVAoSY` |
| 4 | vote_dissolve demo1 (1/2 — not dissolved) | `7LGwdebekb1og45nu5EdXekiXETGN6opJRQeyhFhRALKL3qH51reT4Z3Qyqbvx5iTRKqWinu3Jp72vQo3HUZrgd` |
| 5 | vote_dissolve demo2 (2/2 — DISSOLVED) | `F8BRrTUgfs5GsJPYsp32oT3kjE1TKE1nDdirRhwqjVBXahcbbXYbK5xS139QSUAiAJDZzdE5qoxcGSQYQNW9TDu` |
| 6 | refund crank → $100 to demo1 | `2saTn2GkpyoiM8bg6qdjxGVs6pMNUtS1J94EiMjpDAZmtLme7jNiD2L138oTyoh1sLNZJ7FPFMymwYZjXSneP1uY` |
| 7 | refund crank → $20 to demo2 | `2Hmxgtoe62FVYgrADyWfVY6f1hHekSnL1GoXKwsumSKioRh5qGcxgCpgAujrFBD7VT7XuVYLtTHSFKxePy6GiQdi` |

## C · DEAD-MAN TIMER — expiry → everything closed but refunds

Campaign `rehearsal-deadman` · PDA `ChcfbVig9siaeLofUY1ReFfnXPVGhqWDybYdeZRZxUZ7` · [account](https://explorer.solana.com/address/ChcfbVig9siaeLofUY1ReFfnXPVGhqWDybYdeZRZxUZ7?cluster=devnet) · initialized with a ~2-minute deadline (deadline is an init parameter; the real campaign uses 90 days)

**Expected:** deposits lock $120; after expiry, `propose_payout` is REJECTED
(`CampaignEnded` — demonstrating the audit fix: post-deadline is refunds-only,
the same gate closes `vote_payout` and `release`); the crank refunds everyone
exactly. **Observed:** post-deadline propose rejected with `CampaignEnded`
(a rejected instruction produces no on-chain signature — reproduce it by
calling propose_payout on this expired campaign); both refunds confirmed;
final state 0 depositors, $0.

| # | Action | Signature |
|---|--------|-----------|
| 1 | initialize_campaign (~120 s deadline) | `4a5JRH4QzRMKD3QNKxNUg9Q8b5sqizbh3TyLZovx7E4RJt89B255b75BpVRAgo32pcGDev8unpQvjXMFoUZcwBQD` |
| 2 | deposit $100 (demo1) | `2F1iNe1nEaLe2h7b3upn61kkvMWinxg3z5JZgC4YPR8RUeo9rdP7CrkLrWoQpLgQff9GQy19XZZr3VL4xhjgMGt9` |
| 3 | deposit $20 (demo2) | `2r8uRL6wnThaZ7VFddNtsoMetXDCCruCXzjoNJbagsPX3xJCUHDEaZQFgZzbE6TJtYJGHDfPphAZaBv17NQ7x3Yc` |
| 4 | (expiry) propose_payout attempt → REJECTED `CampaignEnded` | — (failed by design; no on-chain tx) |
| 5 | refund crank → $100 to demo1 | `3oJFczGbiaTNT4pTNi73JXb4bGTvqFcMvSyYYFWNr9t3GdwUREuURLkHgDs9LXUcHxZvPraWLojnsqcvqKoRSpD8` |
| 6 | refund crank → $20 to demo2 | `3rs6Vu8eV4KNPWKHsfswb8u79idiHXBvJv8xE6DDmJW9JmThgWRBJLYh2oCmUNec4J4DhUALNQwvUk7ic1ngb6ur` |

---

Reproduce any of this yourself: the scripts that generated these
transactions are `escrow/scripts/rehearse_all.sh` (driver),
`init_campaign.ts`, `demo_flow.ts`, `vote_demo.ts`, `admin.ts`,
`refund_crank.ts`. The build-verification procedure (source → binary →
on-chain bytes) is in `agents.md`; the contract's full specification is
`SPEC.md`.
