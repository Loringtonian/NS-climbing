# ARCHITECTURE notes — decisions worth defending

## Supporter Badge: why the receipt PDA, not a Token-2022 non-transferable mint

The badge must be three things at once: proof-of-support (plaque credential),
the dissolve ballot, and non-transferable (votes can't be bought). We
evaluated Token-2022's NonTransferable extension — a real mint, one badge
token per depositor — and rejected it. It would add a mint account + an ATA
per depositor (~0.002 SOL each), mint/burn CPIs in deposit/withdraw, freeze-
authority bookkeeping, and a whole second asset whose lifecycle must be kept
in sync with the escrow's. And its non-transferability is a property the
extension enforces; the receipt PDA's non-transferability is a property of
the address itself — the account is derived from the depositor's pubkey
(`["receipt", campaign, depositor]`) and no instruction in the program can
reassign `depositor`. There is nothing to transfer, delegate, or approve.
Strictly stronger soulboundness, zero extra rent, zero new failure surface.
The ballot bit (`voted`) lives on the badge, so vote accounting is atomic
with deposit/withdraw by construction. Display layer: the deposit page reads
the badge and renders "Supporter Badge — $X escrowed ✓"; the explorer link
in agents.md is the verifiable public view. If a wallet-visible collectible
is ever wanted, a display-only Token-2022 mint can be layered on later
without touching escrow logic.

## Dissolve vote: strict head-count majority, electorate = current depositors

`votes * 2 > depositor_count` (exact integer strict-majority). The check runs
after every event that changes either number: vote cast, withdraw, refund.
Withdrawing removes the departing depositor's cast vote and shrinks the
electorate in the same instruction — so a standing minority vote can become
the majority as others leave. Deliberate: departure is silence, not a "no".
DISSOLVED is terminal because no code path ever unsets it; release/approve/
deposit gate on it, and the refund crank treats it exactly like a passed
deadline. One deposit = one vote regardless of tier — a $1000 patron and a
$20 supporter have the same ballot weight (head-count, not capital-weighted,
matching the "counter of people" premise).
