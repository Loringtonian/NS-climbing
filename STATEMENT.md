# Statement of affairs — two registers

> The same facts, said twice. Version 1 for people, Version 2 for crypto people.
> Displayed on the site under a toggle. Lorin's voice — REWRITTEN 2026-07-12 for
> the dollar-weighted model; Lorin to review before launch.

---

## VERSION 1 — PLAIN ENGLISH

**What it is.** A way for a community to fund shared things — first up: a climbing wall at Network School. You put in $20, $100, or $1000 of USDC (one deposit per person). The money genuinely leaves your account and goes into a shared jar that no person can quietly empty — it's run by a small computer program with fixed rules that nobody can talk out of anything.

**The money can only ever do three things.** ① Build the wall: the organizer names the account the money should go to, and if depositors holding more than half the dollars in the jar approve that exact account, the jar empties into it. If the organizer names a different account, all approvals reset and voting starts over. ② Dissolve: if depositors holding more than half the dollars lose confidence and vote to end it, the campaign dies permanently and every person automatically gets their money back. ③ Time out: if 180 days pass with no decision, everyone gets their money back — nothing else is even possible after the deadline. There are no individual take-backs: putting money in together is the whole point.

**Your vote.** Your deposit comes with a voting token stamped to you personally — it can't be sold or given away. Its weight is the amount you put in: a $1000 supporter has fifty times the say of a $20 supporter. That's deliberate — the people putting up the most to build this are the ones who decide, and nobody can swamp the vote with a pile of cheap throwaway wallets.

**How we prove it.** The program's rulebook is public. We ran all three endings for real on Solana's test network and published the receipts. Before any real money is taken, we permanently lock the program so its rules can never change again — and you can confirm that lock yourself with one command, you don't have to take our word. Best of all: copy anything from our repo into your own AI assistant and it can check every claim against the actual code.

**Being upfront about the one risk.** Here's the honest truth. Votes go by dollars, and I'm the only one who can propose where the money goes. So I could put in more money than everyone else combined, vote it through, and send the pool to myself. The code doesn't stop me from doing that. Nothing does, unless we start checking everyone's ID, and we're not doing that. So it comes down to one thing: do you trust me not to?

I'm putting my face on this — my real name, my personal GitHub, my own community. That's what we're trying to build at Network School: high trust networks, where a person gives their word out in the open and stakes their reputation on it. I'm giving my word of honor that I'm doing my best to make this wall happen, and that the money only moves the way this page says.

But don't take my word for it. My Claude audited this contract and told me it's secure, and I trust my Claude — so have yours audit it too. Don't take my word, take the word of a very intelligent AI. Everything's public so you can. Short of me trashing my own reputation, nobody — not me, not a depositor, not a stranger — can move a dollar anywhere but back to the people who put it in. Worst case, everyone gets their money back.

One more honest thing: someone with deep pockets could stall the wall by depositing a bunch just to dilute a vote. Then everyone waits out the 180 days and gets refunded. It's annoying but nobody loses money.

— Lorin Symington

---

## VERSION 2 — CRYPTO-NATIVE

**What it is.** Non-custodial crowdfunding rails on Solana; campaign #1 funds a climbing wall at Network School. Deposits are SPL USDC at fixed tiers ($20/$100/$1000, one receipt per wallet), locked in a program-owned vault (PDA — no key exists). No admin withdrawal path, no individual exit.

**Three settlement paths, all collective and dollar-weighted.** ① Release: organizer-gated `propose_payout(address)`; depositors backing a strict majority of the pooled dollars must ratify per proposal-epoch (`payout_vote_amount * 2 > total_escrowed`; re-proposal zeroes consent); release is then permissionless and the destination is enforced as an account constraint — token account owned by the proposed address, or the tx reverts. ② Dissolve: `dissolve_amount * 2 > total_escrowed` flips a terminal state; release and proposals brick forever, and a permissionless crank refunds every receipt exactly. ③ Deadline: at the 180-day deadline the campaign is refunds-only — release, votes, and proposals are all deadline-gated. Dual-gate invariant: the organizer can't move funds without a dollar-quorum; a dollar-quorum can't route funds to an address the organizer didn't propose.

**Governance token.** The deposit receipt is the ballot — a PDA bound to the depositing wallet, non-transferable by construction (stronger than a Token-2022 non-transferable mint: there's no token to transfer). Vote weight = the receipt's own locked `amount`; one receipt per wallet, revocable while active. Head-count sybil is dead by construction: matching one $1000 vote takes >50 wallets each holding real, locked capital, so cheap-wallet capture can't reach quorum.

**Trust assumption, disclosed precisely.** Voting is by dollars and only the organizer can propose a destination, so the sole extraction path is the organizer out-depositing the rest of the pool combined (locking > total_escrowed of everyone else, then self-proposing and self-ratifying); the honest assumption is that the named organizer does not do this. No outside actor can move funds anywhere but back to depositors. Griefing surface, disclosed: a well-capitalized actor can dilute a standing release majority by depositing (delaying to the deadline refund) — delay, never extraction.

**Verification state.** Deployed on a fresh devnet program ID with a clean history: deploy + three scenario executions + demo campaign (signatures published in `REHEARSALS.md`). Reproducible build — the `.so` rebuilds byte-identical from source and hash-matches the on-chain dump. Two independent adversarial audit passes on the dollar-weighted model; all findings closed in the shipped binary. Upgrade authority is burned before real deposits (verify with `solana program show` — expect no authority; don't trust the docs). `agents.md` carries full account layouts + discriminators; `VERIFY_IT.md` has the paste-to-your-agent prompt.
