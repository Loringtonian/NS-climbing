import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
type Program = any;
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

const USDC = (n: number) => new BN(n * 1_000_000); // 6 decimals

describe("ns-climb-escrow v4 (dollar-weighted dual-gate vote)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow as Program;
  const conn = provider.connection;

  const admin = provider.wallet as anchor.Wallet; // = ORGANIZER on localnet
  const alice = Keypair.generate();
  const bob = Keypair.generate();
  const carol = Keypair.generate();
  const dave = Keypair.generate();
  const stranger = Keypair.generate();
  const payoutA = Keypair.generate();
  const payoutB = Keypair.generate();

  let mint: PublicKey;
  const usdc: Record<string, PublicKey> = {};

  const campaignPda = (id: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), Buffer.from(id)],
      program.programId
    )[0];
  const vaultPda = (campaign: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), campaign.toBuffer()],
      program.programId
    )[0];
  const receiptPda = (campaign: PublicKey, depositor: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), campaign.toBuffer(), depositor.toBuffer()],
      program.programId
    )[0];

  const fetchC = (camp: PublicKey) => (program.account as any).campaign.fetch(camp);

  const init = (id: string, deadlineSecs: number, who = admin.publicKey, signers: Keypair[] = []) => {
    const b = program.methods
      .initializeCampaign(id, new BN(Math.floor(Date.now() / 1000) + deadlineSecs))
      .accounts({
        admin: who,
        mint,
        campaign: campaignPda(id),
        vault: vaultPda(campaignPda(id)),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      });
    return signers.length ? b.signers(signers).rpc() : b.rpc();
  };

  const deposit = (who: Keypair, dollars: number, camp: PublicKey) =>
    program.methods
      .deposit(USDC(dollars))
      .accounts({
        depositor: who.publicKey,
        campaign: camp,
        vault: vaultPda(camp),
        depositorToken: usdc[who.publicKey.toBase58()],
        receipt: receiptPda(camp, who.publicKey),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([who])
      .rpc();

  const castVote = (method: string, who: Keypair, camp: PublicKey) =>
    (program.methods as any)[method]()
      .accounts({ depositor: who.publicKey, campaign: camp, receipt: receiptPda(camp, who.publicKey) })
      .signers([who])
      .rpc();

  const propose = (payout: PublicKey, camp: PublicKey) =>
    program.methods
      .proposePayout(payout)
      .accounts({ admin: admin.publicKey, campaign: camp })
      .rpc();

  const release = (destToken: PublicKey, camp: PublicKey) =>
    program.methods
      .release()
      .accounts({
        executor: stranger.publicKey,
        campaign: camp,
        vault: vaultPda(camp),
        payoutToken: destToken,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([stranger])
      .rpc();

  const refund = (who: PublicKey, whoUsdc: PublicKey, camp: PublicKey) =>
    program.methods
      .refund()
      .accounts({
        cranker: stranger.publicKey,
        depositor: who,
        campaign: camp,
        vault: vaultPda(camp),
        depositorToken: whoUsdc,
        receipt: receiptPda(camp, who),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([stranger])
      .rpc();

  before(async () => {
    for (const kp of [alice, bob, carol, dave, stranger]) {
      const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }
    mint = await createMint(conn, admin.payer, admin.publicKey, null, 6);
    // generous throwaway balances — carol funds a $1000 deposit in ~11
    // separate campaigns (locked, mostly non-refunded), so she needs headroom.
    const bal: [Keypair, number][] = [
      [alice, 5000_000_000],
      [bob, 5000_000_000],
      [carol, 30000_000_000],
      [dave, 5000_000_000],
      [stranger, 2000_000_000],
    ];
    for (const [kp, amt] of bal) {
      const ata = await createAssociatedTokenAccount(conn, admin.payer, mint, kp.publicKey);
      usdc[kp.publicKey.toBase58()] = ata;
      await mintTo(conn, admin.payer, mint, ata, admin.payer, amt);
    }
    // payout destination token accounts (owned by the proposed addresses)
    usdc[payoutA.publicKey.toBase58()] = await createAssociatedTokenAccount(conn, admin.payer, mint, payoutA.publicKey);
    usdc[payoutB.publicKey.toBase58()] = await createAssociatedTokenAccount(conn, admin.payer, mint, payoutB.publicKey);
  });

  it("initializes clean: no goal, no destination, zero vote weight", async () => {
    const id = "t-init";
    await init(id, 3600);
    const c = await fetchC(campaignPda(id));
    assert.equal(c.depositorCount, 0);
    assert.deepEqual(c.tierCounts, [0, 0, 0]);
    assert.ok(c.dissolveAmount.isZero());
    assert.ok(c.payoutVoteAmount.isZero());
    assert.equal(c.proposalId, 0);
    assert.equal(c.proposedPayout.toBase58(), PublicKey.default.toBase58());
    assert.isFalse(c.dissolved);
    assert.isFalse(c.released);
    assert.ok(c.deadline.gt(new BN(Math.floor(Date.now() / 1000))));
  });

  it("deadline is capped (~6 months): a far-future deadline is rejected", async () => {
    try {
      await init("t-cap", 200 * 24 * 60 * 60); // > MAX_CAMPAIGN_SECONDS (190d)
      assert.fail("a deadline past the cap should be rejected");
    } catch (e: any) {
      assert.include(e.toString(), "DeadlineTooFar");
    }
    // a deadline inside the cap is fine
    await init("t-cap-ok", 180 * 24 * 60 * 60);
    const c = await fetchC(campaignPda("t-cap-ok"));
    assert.isFalse(c.released);
  });

  it("only the organizer key can initialize (front-run guard)", async () => {
    try {
      await init("t-squat", 3600, stranger.publicKey, [stranger]);
      assert.fail("stranger init should fail");
    } catch (e: any) {
      assert.include(e.toString(), "UnauthorizedInitializer");
    }
  });

  it("tier menu enforced ($50 rejected); deposits tick tiers + total", async () => {
    const id = "t-tiers";
    const camp = campaignPda(id);
    await init(id, 3600);
    try {
      await deposit(alice, 50, camp);
      assert.fail("non-tier deposit should fail");
    } catch (e: any) {
      assert.include(e.toString(), "InvalidTierAmount");
    }
    await deposit(alice, 20, camp);
    await deposit(bob, 100, camp);
    await deposit(carol, 1000, camp);
    const c = await fetchC(camp);
    assert.equal(c.depositorCount, 3);
    assert.deepEqual(c.tierCounts, [1, 1, 1]);
    assert.ok(c.totalEscrowed.eq(USDC(1120)));
  });

  it("DEPOSITS ARE LOCKED: no withdraw instruction; refund rejects an active campaign", async () => {
    const id = "t-locked";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(bob, 100, camp);
    assert.isUndefined((program.methods as any).withdraw);
    try {
      await refund(bob.publicKey, usdc[bob.publicKey.toBase58()], camp);
      assert.fail("refund on an active campaign should fail");
    } catch (e: any) {
      assert.include(e.toString(), "DeadlineNotPassed");
    }
  });

  it("release impossible with NO proposal", async () => {
    const id = "t-noprop";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    try {
      await release(usdc[payoutA.publicKey.toBase58()], camp);
      assert.fail("release without proposal should fail");
    } catch (e: any) {
      // proposed_payout is default; the token::authority constraint rejects any
      // real destination BEFORE the handler's NoProposal require — either proves the gate.
      assert.match(e.toString(), /NoProposal|Constraint/);
    }
  });

  it("only the organizer can propose a payout", async () => {
    const id = "t-prop";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    try {
      await program.methods
        .proposePayout(payoutA.publicKey)
        .accounts({ admin: stranger.publicKey, campaign: camp })
        .signers([stranger])
        .rpc();
      assert.fail("stranger propose should fail");
    } catch (_e) { /* has_one = admin */ }
  });

  it("a DOLLAR-minority cannot release; a dollar-majority can", async () => {
    const id = "t-major";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(alice, 20, camp);   // $20
    await deposit(carol, 1000, camp); // $1000 — pool $1020, half > $510
    await propose(payoutA.publicKey, camp);

    await castVote("votePayout", alice, camp); // $20 backing — a minority
    let c = await fetchC(camp);
    assert.ok(c.payoutVoteAmount.eq(USDC(20)));
    try {
      await release(usdc[payoutA.publicKey.toBase58()], camp);
      assert.fail("dollar-minority release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }

    await castVote("votePayout", carol, camp); // +$1000 -> $1020 backs it, majority
    c = await fetchC(camp);
    assert.ok(c.payoutVoteAmount.eq(USDC(1020)));
    const before = await getAccount(conn, usdc[payoutA.publicKey.toBase58()]);
    await release(usdc[payoutA.publicKey.toBase58()], camp);
    const after = await getAccount(conn, usdc[payoutA.publicKey.toBase58()]);
    assert.equal(Number(after.amount - before.amount), 1_020_000_000);
    assert.isTrue((await fetchC(camp)).released);
  });

  it("DOLLAR-WEIGHT: a flood of $20 wallets cannot outvote one $1000 depositor", async () => {
    // The whole reason for dollar-weighting. Three $20 wallets ($60) sit against
    // one $1000 depositor in a $1060 pool (half > $530). Their combined weight
    // is nowhere near a majority; the $1000 depositor alone carries it. To
    // actually match one $1000 vote you would need >50 of these wallets, each
    // holding real, locked capital — head-count sybil capture is dead.
    const id = "t-weight";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    await deposit(alice, 20, camp);
    await deposit(dave, 20, camp);
    await deposit(stranger, 20, camp);
    await propose(payoutA.publicKey, camp);

    await castVote("votePayout", alice, camp);
    await castVote("votePayout", dave, camp);
    await castVote("votePayout", stranger, camp); // 3 wallets, $60 total
    let c = await fetchC(camp);
    assert.ok(c.payoutVoteAmount.eq(USDC(60)));
    assert.equal(c.depositorCount, 4); // a head-count majority (3 of 4)...
    try {
      await release(usdc[payoutA.publicKey.toBase58()], camp);
      assert.fail("a $60 minority-of-dollars must not release a $1060 pool");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved"); // ...but a dollar-minority
    }

    await castVote("votePayout", carol, camp); // the $1000 holder decides
    c = await fetchC(camp);
    assert.ok(c.payoutVoteAmount.eq(USDC(1060)));
    await release(usdc[payoutA.publicKey.toBase58()], camp); // now it clears
    assert.isTrue((await fetchC(camp)).released);
  });

  it("payout vote is revocable; double-vote per epoch rejected", async () => {
    const id = "t-revoke";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", carol, camp);
    assert.ok((await fetchC(camp)).payoutVoteAmount.eq(USDC(1000)));
    await castVote("unvotePayout", carol, camp);
    assert.ok((await fetchC(camp)).payoutVoteAmount.isZero());
    await castVote("votePayout", carol, camp);
    try {
      await castVote("votePayout", carol, camp);
      assert.fail("double payout vote should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyVotedPayout");
    }
  });

  it("RE-PROPOSE resets all payout votes (epoch bump)", async () => {
    const id = "t-reprop";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", carol, camp); // majority stands on epoch 1
    assert.ok((await fetchC(camp)).payoutVoteAmount.eq(USDC(1000)));

    await propose(payoutB.publicKey, camp); // epoch 2 — all votes reset
    const c = await fetchC(camp);
    assert.equal(c.proposalId, 2);
    assert.ok(c.payoutVoteAmount.isZero());
    assert.equal(c.proposedPayout.toBase58(), payoutB.publicKey.toBase58());
    try {
      await release(usdc[payoutB.publicKey.toBase58()], camp); // stale votes must not count
      assert.fail("release on reset votes should fail");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }
  });

  it("a new deposit dilutes a standing dollar-majority until it re-crosses", async () => {
    const id = "t-dilute";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    await deposit(alice, 20, camp); // pool $1020
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", carol, camp); // $1000 of $1020 — majority stands
    // a big new deposit enlarges the pool and dilutes the standing majority
    await deposit(dave, 1000, camp); // pool $2020; $1000 is NOT > $1010
    try {
      await release(usdc[payoutA.publicKey.toBase58()], camp);
      assert.fail("diluted release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }
    await castVote("votePayout", dave, camp); // $2000 of $2020 — restored
    await release(usdc[payoutA.publicKey.toBase58()], camp);
    assert.isTrue((await fetchC(camp)).released);
  });

  it("DISSOLVE is dollar-weighted and beats a payout majority", async () => {
    const id = "t-dvp";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(alice, 20, camp);
    await deposit(bob, 100, camp);
    await deposit(carol, 1000, camp); // pool $1120, half > $560
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", alice, camp);
    await castVote("votePayout", bob, camp);
    await castVote("votePayout", carol, camp); // full payout majority present
    assert.ok((await fetchC(camp)).payoutVoteAmount.eq(USDC(1120)));

    await castVote("voteDissolve", carol, camp); // $1000 of $1120 alone -> DISSOLVED
    const c = await fetchC(camp);
    assert.isTrue(c.dissolved);
    try {
      await release(usdc[payoutA.publicKey.toBase58()], camp);
      assert.fail("dissolved release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "Dissolved");
    }
    try {
      await propose(payoutB.publicKey, camp);
      assert.fail("propose on dissolved should fail");
    } catch (e: any) {
      assert.include(e.toString(), "Dissolved");
    }
    // refunds open immediately, exact
    const before = await getAccount(conn, usdc[carol.publicKey.toBase58()]);
    await refund(carol.publicKey, usdc[carol.publicKey.toBase58()], camp);
    const after = await getAccount(conn, usdc[carol.publicKey.toBase58()]);
    assert.equal(Number(after.amount - before.amount), 1_000_000_000);
  });

  it("a dissolve dollar-minority does NOT dissolve the campaign", async () => {
    const id = "t-dmin";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(alice, 20, camp);
    await deposit(carol, 1000, camp); // pool $1020
    await castVote("voteDissolve", alice, camp); // $20 of $1020 — nowhere near half
    const c = await fetchC(camp);
    assert.isFalse(c.dissolved);
    assert.ok(c.dissolveAmount.eq(USDC(20)));
  });

  it("badge non-transferability: a stranger cannot vote or redirect a refund with someone else's badge", async () => {
    const id = "t-badge";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(bob, 100, camp);
    try {
      await program.methods
        .votePayout()
        .accounts({ depositor: stranger.publicKey, campaign: camp, receipt: receiptPda(camp, bob.publicKey) })
        .signers([stranger])
        .rpc();
      assert.fail("vote with foreign badge should fail");
    } catch (_e) { /* seeds + has_one reject */ }
    // force dissolve so refunds are open, then try to steal bob's refund
    await castVote("voteDissolve", bob, camp); // bob is the whole pool -> dissolved
    try {
      await program.methods
        .refund()
        .accounts({
          cranker: stranger.publicKey,
          depositor: bob.publicKey,
          campaign: camp,
          vault: vaultPda(camp),
          depositorToken: usdc[stranger.publicKey.toBase58()], // not bob's
          receipt: receiptPda(camp, bob.publicKey),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      assert.fail("refund to a foreign token account should fail");
    } catch (_e) { /* token::authority = receipt.depositor rejects */ }
  });

  it("refund and vote are blocked after release", async () => {
    const id = "t-postrel";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", carol, camp);
    await release(usdc[payoutA.publicKey.toBase58()], camp);
    try {
      await refund(carol.publicKey, usdc[carol.publicKey.toBase58()], camp);
      assert.fail("refund after release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyReleased");
    }
    try {
      await castVote("votePayout", carol, camp);
      assert.fail("vote after release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyReleased");
    }
  });

  it("exactly half the dollars is NOT a majority (strict > enforced)", async () => {
    const id = "t-half";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(carol, 1000, camp);
    await deposit(dave, 1000, camp); // pool $2000 — half is exactly $1000
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", carol, camp); // exactly $1000 of $2000
    assert.ok((await fetchC(camp)).payoutVoteAmount.eq(USDC(1000)));
    try {
      await release(usdc[payoutA.publicKey.toBase58()], camp);
      assert.fail("exactly-half must not release");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }
    await castVote("votePayout", dave, camp); // $2000 > $1000 — one unit over clears
    await release(usdc[payoutA.publicKey.toBase58()], camp);
    assert.isTrue((await fetchC(camp)).released);
  });

  it("refund clears BOTH tallies exactly for a depositor who voted payout AND dissolve", async () => {
    const id = "t-drain";
    const camp = campaignPda(id);
    await init(id, 3600);
    await deposit(alice, 20, camp);
    await deposit(carol, 1000, camp); // pool $1020
    await propose(payoutA.publicKey, camp);
    await castVote("votePayout", carol, camp);   // payout_vote_amount = $1000
    await castVote("voteDissolve", carol, camp); // dissolve_amount = $1000 -> DISSOLVED
    let c = await fetchC(camp);
    assert.isTrue(c.dissolved);
    assert.ok(c.payoutVoteAmount.eq(USDC(1000)));
    assert.ok(c.dissolveAmount.eq(USDC(1000)));
    // refunding carol must subtract her weight from BOTH running sums (the
    // double-subtract path) — assert no desync and no leftover weight.
    await refund(carol.publicKey, usdc[carol.publicKey.toBase58()], camp);
    c = await fetchC(camp);
    assert.ok(c.payoutVoteAmount.isZero());
    assert.ok(c.dissolveAmount.isZero());
    assert.ok(c.totalEscrowed.eq(USDC(20))); // only alice's $20 remains
    assert.equal(c.depositorCount, 1);
  });

  describe("deadline path", () => {
    it("post-deadline is REFUNDS-ONLY — votes/propose/release closed, refunds exact", async () => {
      const id = "t-deadline";
      const camp = campaignPda(id);
      await init(id, 8);
      await deposit(bob, 100, camp);
      await deposit(alice, 20, camp);
      await propose(payoutA.publicKey, camp);
      await castVote("votePayout", bob, camp); // a standing vote at expiry

      await new Promise((r) => setTimeout(r, 10000));

      try {
        await castVote("votePayout", alice, camp);
        assert.fail("post-deadline vote_payout should fail");
      } catch (e: any) {
        assert.include(e.toString(), "CampaignEnded");
      }
      try {
        await release(usdc[payoutA.publicKey.toBase58()], camp);
        assert.fail("post-deadline release should fail");
      } catch (e: any) {
        assert.include(e.toString(), "CampaignEnded");
      }
      try {
        await propose(payoutB.publicKey, camp);
        assert.fail("late propose should fail");
      } catch (e: any) {
        assert.include(e.toString(), "CampaignEnded");
      }

      const before = await getAccount(conn, usdc[bob.publicKey.toBase58()]);
      await refund(bob.publicKey, usdc[bob.publicKey.toBase58()], camp);
      const after = await getAccount(conn, usdc[bob.publicKey.toBase58()]);
      assert.equal(Number(after.amount - before.amount), 100_000_000);
      await refund(alice.publicKey, usdc[alice.publicKey.toBase58()], camp);
      const c = await fetchC(camp);
      assert.equal(c.depositorCount, 0);
      assert.ok(c.totalEscrowed.isZero());
    });
  });
});
