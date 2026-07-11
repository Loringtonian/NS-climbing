# Statement of affairs — two registers

> The same eight facts, said twice. Version 1 for people, Version 2 for crypto people.
> Displayed on the site under a toggle. Lorin's edit, verbatim — do not paraphrase.

---

## VERSION 1 — PLAIN ENGLISH

**What it is.** A way for a community to fund shared things — first up: a climbing wall at Network School. You put in $20, $100, or $1000 of USDC (one deposit per person). The money genuinely leaves your account and goes into a shared jar that no human being holds — not us, not anyone. The jar is run by a small computer program with fixed rules that nobody can talk out of anything.

**The money can only ever do three things.** ① Build the wall: the organizer names the account the money should go to, and if more than half of the depositors approve that exact account, the jar empties into it. If the organizer names a different account, all approvals reset and voting starts over. ② Dissolve: if more than half of depositors lose confidence and vote to end it, the campaign dies permanently and every person automatically gets their money back. ③ Time out: if 90 days pass with no decision, everyone gets their money back — nothing else is even possible after the deadline. There are no individual take-backs: putting money in together is the whole point.

**Your vote.** Your deposit comes with a voting token stamped to you personally — it can't be sold or given away, so votes can't be bought. One person, one vote, and you can change your mind while the campaign runs.

**How we prove it.** The program's rulebook is public. We ran all three endings for real on Solana's test network and published the receipts (devnet program ID: `42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD`). Best of all: you don't have to trust any of this — copy anything from our repo into your own AI assistant and it can check every claim against the actual code.

**Honest fine print.** For now the organizer can still update the program's rules — this is disclosed, and gets permanently locked within a week of launch. And in the worst imaginable failure, the outcome is: everyone gets refunded.

---

## VERSION 2 — CRYPTO-NATIVE

**What it is.** Non-custodial crowdfunding rails on Solana; campaign #1 funds a climbing wall at Network School. Deposits are SPL USDC at fixed tiers ($20/$100/$1000, one receipt per wallet), locked in a program-owned vault (PDA — no key exists). No admin withdrawal path, no individual exit.

**Three settlement paths, all collective.** ① Release: organizer-gated `propose_payout(address)`; strict head-count majority of current depositors must ratify per proposal-epoch (re-proposal zeroes consent); release is then permissionless and the destination is enforced as an account constraint — token account owned by the proposed address, or the tx reverts. ② Dissolve: >50% no-confidence flips a terminal state; release and proposals brick forever, and a permissionless crank refunds every receipt exactly. ③ Deadline: at T+90d the campaign is refunds-only — release, votes, and proposals are all deadline-gated. Dual-gate invariant: the organizer can't move funds without quorum; quorum can't route funds to an address the organizer didn't propose.

**Governance token.** The deposit receipt is the ballot — a PDA bound to the depositing wallet, non-transferable by construction (stronger than a Token-2022 non-transferable mint: there's no token to transfer). One receipt, one vote, revocable while active. Sybil worst-case is disclosed: buying quorum with $20 wallets can only force dissolve → full refunds, no extraction.

**Verification state.** Deployed on a fresh devnet program ID (`42P4j432MkNbPRJAKTpMJDa1LpfBWAWZhZxAxtY35FsD`) with a clean history: deploy + three scenario executions + demo campaign, 18 signatures published (`REHEARSALS.md`). Reproducible build — the `.so` rebuilds byte-identical from source and hash-matches the on-chain dump. Five adversarial audit passes; all findings closed in the shipped binary. `agents.md` carries full account layouts + discriminators; `VERIFY_IT.md` has the paste-to-your-agent prompt.

**Trust assumptions, disclosed.** Upgrade authority is currently the organizer's key (lock/burn within a week of launch — check `solana program show`, don't trust the docs). Until then, guarantees are code-enforced modulo that key.
