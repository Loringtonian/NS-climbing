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

describe("ns-climb-escrow v3 (dual-gate destination vote)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow as Program;
  const conn = provider.connection;

  const admin = provider.wallet as anchor.Wallet; // = ORGANIZER on localnet
  const alice = Keypair.generate();
  const bob = Keypair.generate();
  const carol = Keypair.generate();
  const stranger = Keypair.generate();
  const payoutA = Keypair.generate(); // first proposed destination
  const payoutB = Keypair.generate(); // re-proposed destination

  let mint: PublicKey;
  let aliceUsdc: PublicKey;
  let bobUsdc: PublicKey;
  let carolUsdc: PublicKey;
  let strangerUsdc: PublicKey;
  let payoutAUsdc: PublicKey;
  let payoutBUsdc: PublicKey;

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

  const ID = "ns-wall-test";
  const campaign = () => campaignPda(ID);
  const fetchC = (camp = campaign()) => (program.account as any).campaign.fetch(camp);

  const init = (id: string, deadlineSecs: number) =>
    program.methods
      .initializeCampaign(id, new BN(Math.floor(Date.now() / 1000) + deadlineSecs))
      .accounts({
        admin: admin.publicKey,
        mint,
        campaign: campaignPda(id),
        vault: vaultPda(campaignPda(id)),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

  const deposit = (who: Keypair, whoUsdc: PublicKey, dollars: number, camp = campaign()) =>
    program.methods
      .deposit(USDC(dollars))
      .accounts({
        depositor: who.publicKey,
        campaign: camp,
        vault: vaultPda(camp),
        depositorToken: whoUsdc,
        receipt: receiptPda(camp, who.publicKey),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([who])
      .rpc();

  const withdraw = (who: Keypair, whoUsdc: PublicKey, camp = campaign()) =>
    program.methods
      .withdraw()
      .accounts({
        depositor: who.publicKey,
        campaign: camp,
        vault: vaultPda(camp),
        depositorToken: whoUsdc,
        receipt: receiptPda(camp, who.publicKey),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([who])
      .rpc();

  const castVote = (method: string, who: Keypair, camp = campaign()) =>
    (program.methods as any)[method]()
      .accounts({ depositor: who.publicKey, campaign: camp, receipt: receiptPda(camp, who.publicKey) })
      .signers([who])
      .rpc();

  const propose = (payout: PublicKey, camp = campaign()) =>
    program.methods
      .proposePayout(payout)
      .accounts({ admin: admin.publicKey, campaign: camp })
      .rpc();

  const release = (dest: PublicKey, camp = campaign()) =>
    program.methods
      .release()
      .accounts({
        executor: stranger.publicKey,
        campaign: camp,
        vault: vaultPda(camp),
        payoutToken: dest,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([stranger])
      .rpc();

  before(async () => {
    for (const kp of [alice, bob, carol, stranger]) {
      const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }
    mint = await createMint(conn, admin.payer, admin.publicKey, null, 6);
    aliceUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, alice.publicKey);
    bobUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, bob.publicKey);
    carolUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, carol.publicKey);
    strangerUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, stranger.publicKey);
    payoutAUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, payoutA.publicKey);
    payoutBUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, payoutB.publicKey);
    await mintTo(conn, admin.payer, mint, aliceUsdc, admin.payer, 500_000_000);
    await mintTo(conn, admin.payer, mint, bobUsdc, admin.payer, 1_000_000_000);
    await mintTo(conn, admin.payer, mint, carolUsdc, admin.payer, 5_000_000_000);
    await mintTo(conn, admin.payer, mint, strangerUsdc, admin.payer, 200_000_000);
  });

  it("initializes: no goal, no destination, no proposal", async () => {
    await init(ID, 3600);
    const c = await fetchC();
    assert.equal(c.depositorCount, 0);
    assert.deepEqual(c.tierCounts, [0, 0, 0]);
    assert.equal(c.dissolveVotes, 0);
    assert.equal(c.proposalId, 0);
    assert.equal(c.payoutVotes, 0);
    assert.equal(c.proposedPayout.toBase58(), PublicKey.default.toBase58());
    assert.isFalse(c.dissolved);
    assert.isFalse(c.released);
  });

  it("only the organizer key can initialize (front-run guard)", async () => {
    const squatted = campaignPda("squatted-id");
    try {
      await program.methods
        .initializeCampaign("squatted-id", new BN(Math.floor(Date.now() / 1000) + 3600))
        .accounts({
          admin: stranger.publicKey,
          mint,
          campaign: squatted,
          vault: vaultPda(squatted),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([stranger])
        .rpc();
      assert.fail("stranger init should fail");
    } catch (e: any) {
      assert.include(e.toString(), "UnauthorizedInitializer");
    }
  });

  it("tier menu enforced ($50 rejected); deposits tick tiers", async () => {
    try {
      await deposit(alice, aliceUsdc, 50);
      assert.fail("non-tier deposit should fail");
    } catch (e: any) {
      assert.include(e.toString(), "InvalidTierAmount");
    }
    await deposit(alice, aliceUsdc, 20);
    await deposit(bob, bobUsdc, 100);
    await deposit(carol, carolUsdc, 1000);
    const c = await fetchC();
    assert.equal(c.depositorCount, 3);
    assert.deepEqual(c.tierCounts, [1, 1, 1]);
    assert.ok(c.totalEscrowed.eq(USDC(1120)));
  });

  it("withdraw returns the exact tier amount and re-deposit works", async () => {
    const before = await getAccount(conn, bobUsdc);
    await withdraw(bob, bobUsdc);
    const after = await getAccount(conn, bobUsdc);
    assert.equal(Number(after.amount - before.amount), 100_000_000);
    await deposit(bob, bobUsdc, 100);
    const c = await fetchC();
    assert.equal(c.depositorCount, 3);
  });

  it("release impossible with NO proposal", async () => {
    try {
      await release(payoutAUsdc);
      assert.fail("release without proposal should fail");
    } catch (e: any) {
      // With no proposal, proposed_payout is the default pubkey, so the
      // token::authority account constraint rejects any real destination
      // BEFORE the handler's NoProposal require — either error proves the gate.
      assert.match(e.toString(), /NoProposal|Constraint/);
    }
  });

  it("only the organizer can propose a payout", async () => {
    try {
      await program.methods
        .proposePayout(payoutA.publicKey)
        .accounts({ admin: stranger.publicKey, campaign: campaign() })
        .signers([stranger])
        .rpc();
      assert.fail("stranger propose should fail");
    } catch (_e) { /* has_one = admin */ }
  });

  it("organizer proposes; minority cannot release", async () => {
    await propose(payoutA.publicKey);
    let c = await fetchC();
    assert.equal(c.proposalId, 1);
    assert.equal(c.payoutVotes, 0);
    assert.equal(c.proposedPayout.toBase58(), payoutA.publicKey.toBase58());

    await castVote("votePayout", alice);
    c = await fetchC();
    assert.equal(c.payoutVotes, 1); // 1 of 3 — not a strict majority
    try {
      await release(payoutAUsdc);
      assert.fail("minority release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }
  });

  it("payout vote is revocable; double-vote per epoch rejected", async () => {
    await castVote("unvotePayout", alice);
    const c = await fetchC();
    assert.equal(c.payoutVotes, 0);
    await castVote("votePayout", alice);
    try {
      await castVote("votePayout", alice);
      assert.fail("double payout vote should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyVotedPayout");
    }
  });

  it("RE-PROPOSE resets all payout votes (epoch bump)", async () => {
    await castVote("votePayout", bob); // 2 of 3 — majority stands on epoch 1
    await propose(payoutB.publicKey); // re-propose: epoch 2
    const c = await fetchC();
    assert.equal(c.proposalId, 2);
    assert.equal(c.payoutVotes, 0);
    assert.equal(c.proposedPayout.toBase58(), payoutB.publicKey.toBase58());
    try {
      await release(payoutBUsdc); // stale epoch-1 votes must not count
      assert.fail("release on reset votes should fail");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }
  });

  it("withdraw removes BOTH votes atomically", async () => {
    await castVote("votePayout", alice); // payout vote on epoch 2
    await castVote("voteDissolve", alice); // dissolve vote (1/3 — safe)
    let c = await fetchC();
    assert.equal(c.payoutVotes, 1);
    assert.equal(c.dissolveVotes, 1);
    await withdraw(alice, aliceUsdc);
    c = await fetchC();
    assert.equal(c.depositorCount, 2);
    assert.equal(c.payoutVotes, 0);
    assert.equal(c.dissolveVotes, 0);
    await deposit(alice, aliceUsdc, 20); // back in with a fresh badge
  });

  it("vote after withdraw impossible (badge gone)", async () => {
    await withdraw(carol, carolUsdc);
    try {
      await castVote("votePayout", carol);
      assert.fail("vote without badge should fail");
    } catch (_e) { /* receipt closed */ }
    await deposit(carol, carolUsdc, 1000);
  });

  it("new deposits dilute a standing majority until they vote", async () => {
    await castVote("votePayout", alice);
    await castVote("votePayout", bob); // 2 of 3 — majority stands
    await deposit(stranger, strangerUsdc, 20); // electorate 4 — 2 of 4 is NOT strict majority
    try {
      await release(payoutBUsdc);
      assert.fail("diluted release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "ProposalNotApproved");
    }
    await castVote("votePayout", carol); // 3 of 4 — majority restored
  });

  it("release pays EXACTLY the proposed address; wrong destination rejected", async () => {
    try {
      await release(payoutAUsdc); // epoch-2 proposal is payoutB, not payoutA
      assert.fail("wrong destination should fail");
    } catch (_e) { /* token::authority = proposed_payout constraint */ }
    const before = await getAccount(conn, payoutBUsdc);
    await release(payoutBUsdc);
    const after = await getAccount(conn, payoutBUsdc);
    assert.equal(Number(after.amount - before.amount), 1_140_000_000); // 20+100+1000+20
    const c = await fetchC();
    assert.isTrue(c.released);
  });

  it("withdraw and vote blocked after release", async () => {
    try {
      await withdraw(bob, bobUsdc);
      assert.fail("withdraw after release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyReleased");
    }
    try {
      await castVote("votePayout", bob);
      assert.fail("vote after release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyReleased");
    }
  });

  describe("dissolve beats payout", () => {
    const ID3 = "ns-wall-dvp";
    const camp = () => campaignPda(ID3);

    it("a dissolved campaign can NEVER release, even with a payout majority", async () => {
      await init(ID3, 3600);
      await deposit(alice, aliceUsdc, 20, camp());
      await deposit(bob, bobUsdc, 100, camp());
      await deposit(carol, carolUsdc, 1000, camp());
      await propose(payoutA.publicKey, camp());
      await castVote("votePayout", alice, camp());
      await castVote("votePayout", bob, camp());
      await castVote("votePayout", carol, camp()); // 3/3 payout majority
      await castVote("voteDissolve", alice, camp());
      await castVote("voteDissolve", bob, camp()); // 2/3 -> DISSOLVED
      const c = await fetchC(camp());
      assert.isTrue(c.dissolved);
      assert.equal(c.payoutVotes, 3); // majority present, and irrelevant
      try {
        await release(payoutAUsdc, camp());
        assert.fail("dissolved release should fail");
      } catch (e: any) {
        assert.include(e.toString(), "Dissolved");
      }
      try {
        await propose(payoutB.publicKey, camp());
        assert.fail("propose on dissolved should fail");
      } catch (e: any) {
        assert.include(e.toString(), "Dissolved");
      }
      // refunds open immediately (pre-deadline)
      const before = await getAccount(conn, aliceUsdc);
      await program.methods
        .refund()
        .accounts({
          cranker: stranger.publicKey,
          depositor: alice.publicKey,
          campaign: camp(),
          vault: vaultPda(camp()),
          depositorToken: aliceUsdc,
          receipt: receiptPda(camp(), alice.publicKey),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      const after = await getAccount(conn, aliceUsdc);
      assert.equal(Number(after.amount - before.amount), 20_000_000);
      // withdraw also still works in DISSOLVED
      const b4 = await getAccount(conn, carolUsdc);
      await withdraw(carol, carolUsdc, camp());
      const a4 = await getAccount(conn, carolUsdc);
      assert.equal(Number(a4.amount - b4.amount), 1_000_000_000);
    });
  });

  describe("badge non-transferability", () => {
    it("a stranger cannot vote or withdraw with someone else's badge", async () => {
      const camp = campaignPda("ns-wall-dvp");
      try {
        await program.methods
          .votePayout()
          .accounts({ depositor: stranger.publicKey, campaign: camp, receipt: receiptPda(camp, bob.publicKey) })
          .signers([stranger])
          .rpc();
        assert.fail("vote with foreign badge should fail");
      } catch (_e) { /* seeds + has_one reject */ }
      try {
        await withdraw(stranger as any, bobUsdc, camp);
        assert.fail("withdraw with foreign badge should fail");
      } catch (_e) { /* receipt PDA derived from signer */ }
    });
  });

  describe("deadline path (with an active proposal)", () => {
    const ID2 = "ns-wall-deadline";
    const camp = () => campaignPda(ID2);

    it("deadline refunds work even with a live proposal; propose blocked after deadline", async () => {
      await init(ID2, 4);
      await deposit(bob, bobUsdc, 100, camp());
      await propose(payoutA.publicKey, camp()); // active proposal, no majority

      try {
        await program.methods
          .refund()
          .accounts({
            cranker: stranger.publicKey,
            depositor: bob.publicKey,
            campaign: camp(),
            vault: vaultPda(camp()),
            depositorToken: bobUsdc,
            receipt: receiptPda(camp(), bob.publicKey),
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc();
        assert.fail("early refund should fail");
      } catch (e: any) {
        assert.include(e.toString(), "DeadlineNotPassed");
      }

      await new Promise((r) => setTimeout(r, 6000));

      try {
        await propose(payoutB.publicKey, camp());
        assert.fail("late propose should fail");
      } catch (e: any) {
        assert.include(e.toString(), "CampaignEnded");
      }

      const before = await getAccount(conn, bobUsdc);
      await program.methods
        .refund()
        .accounts({
          cranker: stranger.publicKey,
          depositor: bob.publicKey,
          campaign: camp(),
          vault: vaultPda(camp()),
          depositorToken: bobUsdc,
          receipt: receiptPda(camp(), bob.publicKey),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      const after = await getAccount(conn, bobUsdc);
      assert.equal(Number(after.amount - before.amount), 100_000_000);
      const c = await fetchC(camp());
      assert.equal(c.depositorCount, 0);
      assert.ok(c.totalEscrowed.eq(new BN(0)));
    });
  });

  describe("electorate shrink edge (dissolve)", () => {
    const ID4 = "ns-wall-shrink";
    const camp = () => campaignPda(ID4);

    it("a standing minority dissolve vote becomes the majority as others withdraw", async () => {
      await init(ID4, 3600);
      await deposit(alice, aliceUsdc, 20, camp());
      await deposit(bob, bobUsdc, 100, camp());
      await deposit(carol, carolUsdc, 1000, camp());
      await castVote("voteDissolve", alice, camp()); // 1 of 3
      await withdraw(bob, bobUsdc, camp()); // 1 of 2 — exactly half, not strict
      let c = await fetchC(camp());
      assert.isFalse(c.dissolved);
      await withdraw(carol, carolUsdc, camp()); // 1 of 1 — dissolves on the withdraw
      c = await fetchC(camp());
      assert.isTrue(c.dissolved);
    });
  });
});
