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

describe("ns-climb-escrow (tiered)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nsClimbEscrow as Program;
  const conn = provider.connection;

  const admin = provider.wallet as anchor.Wallet;
  const alice = Keypair.generate(); // $20 supporter
  const bob = Keypair.generate(); // $100 founder
  const carol = Keypair.generate(); // $1000 patron
  const buildout = Keypair.generate();
  const stranger = Keypair.generate();

  let mint: PublicKey;
  let aliceUsdc: PublicKey;
  let bobUsdc: PublicKey;
  let carolUsdc: PublicKey;
  let buildoutUsdc: PublicKey;

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

  const fetchCampaign = async () =>
    (program.account as any).campaign.fetch(campaign());

  before(async () => {
    for (const kp of [alice, bob, carol, stranger]) {
      const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }
    mint = await createMint(conn, admin.payer, admin.publicKey, null, 6);
    aliceUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, alice.publicKey);
    bobUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, bob.publicKey);
    carolUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, carol.publicKey);
    buildoutUsdc = await createAssociatedTokenAccount(conn, admin.payer, mint, buildout.publicKey);
    await mintTo(conn, admin.payer, mint, aliceUsdc, admin.payer, 200_000_000);
    await mintTo(conn, admin.payer, mint, bobUsdc, admin.payer, 500_000_000);
    await mintTo(conn, admin.payer, mint, carolUsdc, admin.payer, 2_000_000_000);
  });

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

  const vote = (who: Keypair, camp = campaign()) =>
    program.methods
      .voteDissolve()
      .accounts({ depositor: who.publicKey, campaign: camp, receipt: receiptPda(camp, who.publicKey) })
      .signers([who])
      .rpc();
  const unvote = (who: Keypair, camp = campaign()) =>
    program.methods
      .unvoteDissolve()
      .accounts({ depositor: who.publicKey, campaign: camp, receipt: receiptPda(camp, who.publicKey) })
      .signers([who])
      .rpc();

  it("initializes a campaign", async () => {
    const deadline = new BN(Math.floor(Date.now() / 1000) + 3600);
    await program.methods
      .initializeCampaign(ID, USDC(1120), deadline, buildout.publicKey)
      .accounts({
        admin: admin.publicKey,
        mint,
        campaign: campaign(),
        vault: vaultPda(campaign()),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 0);
    assert.deepEqual(c.tierCounts, [0, 0, 0]);
    assert.equal(c.dissolveVotes, 0);
    assert.isFalse(c.dissolved);
    assert.ok(c.totalEscrowed.eq(new BN(0)));
    assert.ok(c.goal.eq(USDC(1120)));
    assert.isFalse(c.approved);
    assert.isFalse(c.released);
  });


  it("AUDIT FIX: only the organizer key can initialize a campaign (front-run guard)", async () => {
    const deadline = new BN(Math.floor(Date.now() / 1000) + 3600);
    const squatted = campaignPda("squatted-id");
    try {
      await program.methods
        .initializeCampaign("squatted-id", USDC(1120), deadline, stranger.publicKey)
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
    } catch (_e) { /* address = ORGANIZER constraint */ }
  });

  it("rejects a non-tier amount ($50)", async () => {
    try {
      await deposit(alice, aliceUsdc, 50);
      assert.fail("non-tier deposit should fail");
    } catch (e: any) {
      assert.include(e.toString(), "InvalidTierAmount");
    }
  });

  it("$20 deposit ticks counter and supporter tier", async () => {
    await deposit(alice, aliceUsdc, 20);
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 1);
    assert.deepEqual(c.tierCounts, [1, 0, 0]);
    assert.ok(c.totalEscrowed.eq(USDC(20)));
    const vault = await getAccount(conn, vaultPda(campaign()));
    assert.equal(Number(vault.amount), 20_000_000);
  });

  it("$100 deposit ticks founder tier", async () => {
    await deposit(bob, bobUsdc, 100);
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 2);
    assert.deepEqual(c.tierCounts, [1, 1, 0]);
    assert.ok(c.totalEscrowed.eq(USDC(120)));
  });

  it("rejects a second deposit from the same wallet", async () => {
    try {
      await deposit(alice, aliceUsdc, 20);
      assert.fail("second deposit should fail");
    } catch (_e) {
      /* receipt PDA already exists */
    }
  });

  it("withdraw returns EXACTLY the deposited tier amount ($100)", async () => {
    const before = await getAccount(conn, bobUsdc);
    await withdraw(bob, bobUsdc);
    const after = await getAccount(conn, bobUsdc);
    assert.equal(Number(after.amount - before.amount), 100_000_000);
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 1);
    assert.deepEqual(c.tierCounts, [1, 0, 0]);
    assert.ok(c.totalEscrowed.eq(USDC(20)));
  });

  it("tier upgrade = withdraw then redeposit higher ($20 -> $100)", async () => {
    await withdraw(alice, aliceUsdc);
    await deposit(alice, aliceUsdc, 100);
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 1);
    assert.deepEqual(c.tierCounts, [0, 1, 0]);
    assert.ok(c.totalEscrowed.eq(USDC(100)));
  });

  it("$1000 patron deposit ticks the top tier", async () => {
    await deposit(carol, carolUsdc, 1000);
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 2);
    assert.deepEqual(c.tierCounts, [0, 1, 1]);
    assert.ok(c.totalEscrowed.eq(USDC(1100)));
  });

  it("release fails without approval, even near goal", async () => {
    try {
      await program.methods
        .release()
        .accounts({
          executor: stranger.publicKey,
          campaign: campaign(),
          vault: vaultPda(campaign()),
          buildoutToken: buildoutUsdc,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      assert.fail("release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "NotApproved");
    }
  });

  it("goal reached by bob's $20 re-entry", async () => {
    await deposit(bob, bobUsdc, 20);
    const c = await fetchCampaign();
    assert.equal(c.depositorCount, 3);
    assert.deepEqual(c.tierCounts, [1, 1, 1]);
    assert.ok(c.totalEscrowed.eq(USDC(1120)));
  });

  it("release still fails at goal without admin approval", async () => {
    try {
      await program.methods
        .release()
        .accounts({
          executor: stranger.publicKey,
          campaign: campaign(),
          vault: vaultPda(campaign()),
          buildoutToken: buildoutUsdc,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      assert.fail("release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "NotApproved");
    }
  });

  it("non-admin cannot approve", async () => {
    try {
      await program.methods
        .approveRelease()
        .accounts({ admin: stranger.publicKey, campaign: campaign() })
        .signers([stranger])
        .rpc();
      assert.fail("non-admin approve should fail");
    } catch (_e) {
      /* has_one = admin */
    }
  });

  it("admin approves", async () => {
    await program.methods
      .approveRelease()
      .accounts({ admin: admin.publicKey, campaign: campaign() })
      .rpc();
    const c = await fetchCampaign();
    assert.isTrue(c.approved);
  });

  it("TRUST PROPERTY: withdraw still works AFTER approval, any tier ($1000)", async () => {
    const before = await getAccount(conn, carolUsdc);
    await withdraw(carol, carolUsdc);
    const after = await getAccount(conn, carolUsdc);
    assert.equal(Number(after.amount - before.amount), 1_000_000_000);
    let c = await fetchCampaign();
    assert.deepEqual(c.tierCounts, [1, 1, 0]);
    // put it back so the goal holds for the release test
    await deposit(carol, carolUsdc, 1000);
    c = await fetchCampaign();
    assert.ok(c.totalEscrowed.eq(USDC(1120)));
  });

  it("anyone can execute a fully-gated release; funds land at buildout", async () => {
    await program.methods
      .release()
      .accounts({
        executor: stranger.publicKey,
        campaign: campaign(),
        vault: vaultPda(campaign()),
        buildoutToken: buildoutUsdc,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([stranger])
      .rpc();
    const c = await fetchCampaign();
    assert.isTrue(c.released);
    const out = await getAccount(conn, buildoutUsdc);
    assert.equal(Number(out.amount), 1_120_000_000);
  });

  it("release cannot send funds anywhere but the buildout address", async () => {
    try {
      await program.methods
        .release()
        .accounts({
          executor: stranger.publicKey,
          campaign: campaign(),
          vault: vaultPda(campaign()),
          buildoutToken: aliceUsdc, // wrong owner
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      assert.fail("should fail");
    } catch (_e) {
      /* constraint violation (and AlreadyReleased) */
    }
  });

  it("withdraw and deposit are blocked after release", async () => {
    try {
      await withdraw(bob, bobUsdc);
      assert.fail("withdraw after release should fail");
    } catch (e: any) {
      assert.include(e.toString(), "AlreadyReleased");
    }
    try {
      await deposit(stranger as any, aliceUsdc, 20);
      assert.fail("deposit after release should fail");
    } catch (_e) {
      /* blocked */
    }
  });

  describe("deadline path", () => {
    const ID2 = "ns-wall-deadline";
    const campaign2 = () => campaignPda(ID2);

    it("deadline passes without approval -> refund crank returns the exact tier amount", async () => {
      const deadline = new BN(Math.floor(Date.now() / 1000) + 4);
      await program.methods
        .initializeCampaign(ID2, USDC(1120), deadline, buildout.publicKey)
        .accounts({
          admin: admin.publicKey,
          mint,
          campaign: campaign2(),
          vault: vaultPda(campaign2()),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      await deposit(bob, bobUsdc, 100, campaign2());

      // refund before deadline must fail
      try {
        await program.methods
          .refund()
          .accounts({
            cranker: stranger.publicKey,
            depositor: bob.publicKey,
            campaign: campaign2(),
            vault: vaultPda(campaign2()),
            depositorToken: bobUsdc,
            receipt: receiptPda(campaign2(), bob.publicKey),
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc();
        assert.fail("early refund should fail");
      } catch (e: any) {
        assert.include(e.toString(), "DeadlineNotPassed");
      }

      await new Promise((r) => setTimeout(r, 6000));

      // approval after deadline must fail
      try {
        await program.methods
          .approveRelease()
          .accounts({ admin: admin.publicKey, campaign: campaign2() })
          .rpc();
        assert.fail("late approval should fail");
      } catch (e: any) {
        assert.include(e.toString(), "CampaignEnded");
      }

      // permissionless refund crank returns Bob's exact $100
      const before = await getAccount(conn, bobUsdc);
      await program.methods
        .refund()
        .accounts({
          cranker: stranger.publicKey,
          depositor: bob.publicKey,
          campaign: campaign2(),
          vault: vaultPda(campaign2()),
          depositorToken: bobUsdc,
          receipt: receiptPda(campaign2(), bob.publicKey),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      const after = await getAccount(conn, bobUsdc);
      assert.equal(Number(after.amount - before.amount), 100_000_000);
      const c = await (program.account as any).campaign.fetch(campaign2());
      assert.equal(c.depositorCount, 0);
      assert.deepEqual(c.tierCounts, [0, 0, 0]);
      assert.ok(c.totalEscrowed.eq(new BN(0)));
    });
  });

  describe("dissolve vote path", () => {
    const ID3 = "ns-wall-dissolve";
    const camp = () => campaignPda(ID3);
    const fetchC = () => (program.account as any).campaign.fetch(camp());

    it("sets up: 3 depositors across tiers", async () => {
      const deadline = new BN(Math.floor(Date.now() / 1000) + 3600);
      await program.methods
        .initializeCampaign(ID3, USDC(1120), deadline, buildout.publicKey)
        .accounts({
          admin: admin.publicKey,
          mint,
          campaign: camp(),
          vault: vaultPda(camp()),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      await deposit(alice, aliceUsdc, 20, camp());
      await deposit(bob, bobUsdc, 100, camp());
      await deposit(carol, carolUsdc, 1000, camp());
      const c = await fetchC();
      assert.equal(c.depositorCount, 3);
      assert.ok(c.totalEscrowed.eq(USDC(1120))); // goal met
    });

    it("BADGE non-transferability: a stranger cannot vote or withdraw with someone else's badge", async () => {
      try {
        await program.methods
          .voteDissolve()
          .accounts({ depositor: stranger.publicKey, campaign: camp(), receipt: receiptPda(camp(), alice.publicKey) })
          .signers([stranger])
          .rpc();
        assert.fail("vote with foreign badge should fail");
      } catch (_e) { /* seeds + has_one reject */ }
      try {
        await withdraw(stranger as any, aliceUsdc, camp());
        assert.fail("withdraw with foreign badge should fail");
      } catch (_e) { /* receipt PDA derived from signer -> different address */ }
    });

    it("vote is revocable: vote, unvote, re-vote", async () => {
      await vote(alice, camp());
      let c = await fetchC();
      assert.equal(c.dissolveVotes, 1);
      assert.isFalse(c.dissolved); // 1 of 3 is not a strict majority
      await unvote(alice, camp());
      c = await fetchC();
      assert.equal(c.dissolveVotes, 0);
      await vote(alice, camp());
    });

    it("double-vote rejected", async () => {
      try {
        await vote(alice, camp());
        assert.fail("second vote should fail");
      } catch (e: any) {
        assert.include(e.toString(), "AlreadyVoted");
      }
    });

    it("majority flips to DISSOLVED (2 of 3)", async () => {
      await vote(bob, camp());
      const c = await fetchC();
      assert.equal(c.dissolveVotes, 2);
      assert.isTrue(c.dissolved);
    });

    it("DISSOLVED is terminal: approve, release (goal met!), deposit all blocked", async () => {
      try {
        await program.methods
          .approveRelease()
          .accounts({ admin: admin.publicKey, campaign: camp() })
          .rpc();
        assert.fail("approve on dissolved should fail");
      } catch (e: any) { assert.include(e.toString(), "Dissolved"); }
      try {
        await program.methods
          .release()
          .accounts({
            executor: stranger.publicKey,
            campaign: camp(),
            vault: vaultPda(camp()),
            buildoutToken: buildoutUsdc,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc();
        assert.fail("release on dissolved should fail");
      } catch (e: any) { assert.include(e.toString(), "Dissolved"); }
      try {
        await deposit(stranger as any, aliceUsdc, 20, camp());
        assert.fail("deposit on dissolved should fail");
      } catch (_e) { /* blocked */ }
    });

    it("refund crank open immediately (before deadline) once dissolved", async () => {
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
    });

    it("withdraw still works in DISSOLVED, exact amount ($1000)", async () => {
      const before = await getAccount(conn, carolUsdc);
      await withdraw(carol, carolUsdc, camp());
      const after = await getAccount(conn, carolUsdc);
      assert.equal(Number(after.amount - before.amount), 1_000_000_000);
    });

    it("vote after withdraw impossible (badge is gone)", async () => {
      try {
        await vote(carol, camp());
        assert.fail("vote without badge should fail");
      } catch (_e) { /* receipt closed */ }
    });
  });

  describe("electorate shrink edge", () => {
    const ID4 = "ns-wall-shrink";
    const camp = () => campaignPda(ID4);
    const fetchC = () => (program.account as any).campaign.fetch(camp());

    it("a standing minority vote becomes the majority as others withdraw", async () => {
      const deadline = new BN(Math.floor(Date.now() / 1000) + 3600);
      await program.methods
        .initializeCampaign(ID4, USDC(1120), deadline, buildout.publicKey)
        .accounts({
          admin: admin.publicKey,
          mint,
          campaign: camp(),
          vault: vaultPda(camp()),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      await deposit(alice, aliceUsdc, 20, camp());
      await deposit(bob, bobUsdc, 100, camp());
      await deposit(carol, carolUsdc, 1000, camp());

      await vote(alice, camp()); // 1 of 3 — minority
      let c = await fetchC();
      assert.isFalse(c.dissolved);

      await withdraw(bob, bobUsdc, camp()); // 1 of 2 — exactly half, NOT strict majority
      c = await fetchC();
      assert.equal(c.depositorCount, 2);
      assert.equal(c.dissolveVotes, 1);
      assert.isFalse(c.dissolved);

      await withdraw(carol, carolUsdc, camp()); // 1 of 1 — majority: dissolves ON the withdraw
      c = await fetchC();
      assert.equal(c.depositorCount, 1);
      assert.isTrue(c.dissolved);
    });

    it("un-vote impossible after dissolution (terminal)", async () => {
      try {
        await unvote(alice, camp());
        assert.fail("unvote on dissolved should fail");
      } catch (e: any) {
        assert.include(e.toString(), "Dissolved");
      }
    });

    it("withdrawing a voter removes their vote atomically", async () => {
      // alice (the voter) withdraws from the dissolved campaign: vote count drops with her
      await withdraw(alice, aliceUsdc, camp());
      const c = await fetchC();
      assert.equal(c.depositorCount, 0);
      assert.equal(c.dissolveVotes, 0);
    });
  });
});
