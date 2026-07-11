/* NS climbing wall — the deposit/vote flow (deposits are LOCKED; exits are collective). ONE audited code path,
 * loaded by BOTH the standalone deposit page (demo.html, the QR target) and
 * the inline embed on index.html. Config comes from window.ESCROW_CONFIG set
 * by the including page — hardcoded there, never from URL params (audit fix).
 * Elements are bound only if present, so pages can include a subset.
 * Exposes window.EscrowFlow.preselect(usd) for the inline tier cards.
 */
(function () {
  // ---- config: HARDCODED (audit fix — URL-param config was a phishing
  //      primitive on the trusted domain; devnet.html is the params page).
  //      FLIP THESE AT MAINNET DEPLOY (values printed by mainnet_go.sh). ----
  var RPC = window.ESCROW_CONFIG.rpc;
  var PROGRAM_ID = window.ESCROW_CONFIG.program;
  var CAMPAIGN_ID = window.ESCROW_CONFIG.campaign;
  var USDC_MINT = window.ESCROW_CONFIG.mint; // devnet demo mint; mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  // ------------------------------------------------------------------

  var W = solanaWeb3;
  var conn = new W.Connection(RPC, "confirmed");
  var pid = new W.PublicKey(PROGRAM_ID);
  var TOKEN_PID = new W.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  var ATA_PID = new W.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  var enc = new TextEncoder();

  var campaign = W.PublicKey.findProgramAddressSync(
    [enc.encode("campaign"), enc.encode(CAMPAIGN_ID)], pid)[0];
  var vault = W.PublicKey.findProgramAddressSync(
    [enc.encode("vault"), campaign.toBytes()], pid)[0];

  var DISC_DEPOSIT = new Uint8Array([242,35,198,137,82,225,242,182]);
  var DISC_VOTE = new Uint8Array([180,224,232,226,59,166,81,63]);
  var DISC_UNVOTE = new Uint8Array([244,70,201,208,63,92,167,83]);
  var DISC_VOTE_PAYOUT = new Uint8Array([253,223,29,124,122,195,50,5]);
  var DISC_UNVOTE_PAYOUT = new Uint8Array([93,70,124,191,216,185,62,248]);

  var wallet = null;
  var $ = function (id) { return document.getElementById(id); };
  function status(msg) { $("status").textContent = msg; }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }

  function provider() {
    return window.phantom && window.phantom.solana ? window.phantom.solana
      : window.solflare ? window.solflare
      : window.solana ? window.solana : null;
  }

  // Tier pre-select — callable (inline tier cards) and via fragment
  // (#v1/#v5/#v10 on the standalone page; a fragment is presentation, not
  // config, so it stays inside the audit's no-URL-param rule).
  function preselect(usd) {
    Array.prototype.forEach.call(document.querySelectorAll(".tier"), function (b) {
      var mine = b.getAttribute("data-usd") === String(usd);
      b.style.boxShadow = mine ? "0 0 0 3px rgba(255,178,74,.6)" : "";
      var tag = b.querySelector(".pick-tag");
      if (tag) tag.remove();
      if (mine) b.insertAdjacentHTML("beforeend", '<small class="pick-tag" style="opacity:.9">Your pick — confirm below</small>');
    });
  }
  window.EscrowFlow = { preselect: preselect };
  var pre = { "#v1": "20", "#v5": "100", "#v10": "1000" }[location.hash];
  if (pre) preselect(pre);

  // No injected wallet (plain mobile browser) -> deep-link into wallet browsers
  if (!provider()) {
    var here = location.href;
    $("phantomLink").href = "https://phantom.app/ul/browse/" + encodeURIComponent(here) + "?ref=" + encodeURIComponent(location.origin);
    $("solflareLink").href = "https://solflare.com/ul/v1/browse/" + encodeURIComponent(here) + "?ref=" + encodeURIComponent(location.origin);
    show("nowallet", true);
    show("hasWallet", false);
  }

  function ata(owner, mint) {
    return W.PublicKey.findProgramAddressSync(
      [owner.toBytes(), TOKEN_PID.toBytes(), mint.toBytes()], ATA_PID)[0];
  }
  function receiptPda(depositor) {
    return W.PublicKey.findProgramAddressSync(
      [enc.encode("receipt"), campaign.toBytes(), depositor.toBytes()], pid)[0];
  }

  // Receipt existence drives the UI: deposited -> locked badge + vote controls;
  // not deposited -> the three tier buttons.
  var tierBtns = Array.prototype.slice.call(document.querySelectorAll(".tier"));
  function refreshState() {
    if (!wallet) return;
    conn.getAccountInfo(receiptPda(wallet.pk)).then(function (acct) {
      var deposited = !!acct;
      var voted = false;
      var payoutSeq = 0;
      if (deposited && acct.data.length >= 86) {
        // Receipt v3: 8 disc | 32 campaign | 32 depositor | 8 amount | 1 voted | 4 payout_voted_seq | 1 bump
        var dvR = new DataView(acct.data.buffer, acct.data.byteOffset);
        var amt = dvR.getBigUint64(72, true);
        voted = acct.data[80] === 1;
        payoutSeq = dvR.getUint32(81, true);
        $("inBadge").textContent = "Supporter Badge — $" + (Number(amt / 10000n) / 100).toLocaleString() + " locked in the pool ✓";
      }
      show("inBadge", deposited);
      show("lockedNote", deposited);
      tierBtns.forEach(function (b) { b.classList.toggle("hidden", deposited); b.disabled = false; });
      show("tierFine", !deposited);
      // votes: campaign v3 parse (dissolve + payout proposal state)
      conn.getAccountInfo(campaign).then(function (cAcct) {
        if (!cAcct) return;
        var raw = cAcct.data;
        var dv = new DataView(raw.buffer, raw.byteOffset);
        var o = 8 + 64;
        o += 4 + dv.getUint32(o, true); // campaign_id
        o += 8 + 8; // deadline, total
        var count = dv.getUint32(o, true); o += 4;
        o += 12; // tier_counts
        var dVotes = dv.getUint32(o, true); o += 4;
        o += 32; // proposed_payout
        var propId = dv.getUint32(o, true); o += 4;
        var pVotes = dv.getUint32(o, true); o += 4;
        var dissolved = raw[o] === 1;
        var threshold = Math.floor(count / 2) + 1;
        // dissolve link (badge-holders only)
        var el = $("voteLink");
        if (el) {
          if (!deposited) { show("voteLink", false); }
          else if (dissolved) {
            el.textContent = "Campaign dissolved by depositor vote — refunds open; anyone can crank them and your deposit returns to your wallet.";
            el.style.pointerEvents = "none";
            show("voteLink", true);
          } else {
            el.textContent = voted
              ? "Remove my dissolve vote (" + dVotes + "/" + threshold + " to dissolve)"
              : "Vote to dissolve the campaign (" + dVotes + "/" + threshold + ")";
            el.dataset.voted = voted ? "1" : "0";
            show("voteLink", true);
          }
        }
        // payout vote button (inside the proposal panel, badge-holders only)
        var pb = $("payoutVote");
        if (pb) {
          var live = propId > 0 && !dissolved;
          if (!deposited || !live) { pb.classList.add("hidden"); }
          else {
            var mine = payoutSeq === propId;
            pb.textContent = mine
              ? "Remove my yes-vote (" + pVotes + "/" + threshold + ")"
              : "Vote yes on this payout (" + pVotes + "/" + threshold + ")";
            pb.dataset.voted = mine ? "1" : "0";
            pb.classList.remove("hidden");
            pb.disabled = false;
          }
        }
      }).catch(function () {});
    }).catch(function () {});
  }

  var _pv = document.getElementById("payoutVote");
  if (_pv) _pv.onclick = async function () {
    if (!wallet) { status("Connect your wallet first."); return; }
    var casting = _pv.dataset.voted !== "1";
    _pv.disabled = true;
    try {
      var ix = new W.TransactionInstruction({
        programId: pid,
        keys: [
          { pubkey: wallet.pk, isSigner: true, isWritable: false },
          { pubkey: campaign, isSigner: false, isWritable: true },
          { pubkey: receiptPda(wallet.pk), isSigner: false, isWritable: true },
        ],
        data: casting ? DISC_VOTE_PAYOUT : DISC_UNVOTE_PAYOUT,
      });
      await send([ix]);
      status(casting ? "Payout vote cast." : "Payout vote removed.");
    } catch (e) { status("Payout vote failed: " + shortErr(e)); }
    refreshState();
  };

    $("voteLink").onclick = async function (ev) {
    ev.preventDefault();
    if (!wallet) return;
    var casting = $("voteLink").dataset.voted !== "1";
    try {
      var ix = new W.TransactionInstruction({
        programId: pid,
        keys: [
          { pubkey: wallet.pk, isSigner: true, isWritable: false },
          { pubkey: campaign, isSigner: false, isWritable: true },
          { pubkey: receiptPda(wallet.pk), isSigner: false, isWritable: true },
        ],
        data: casting ? DISC_VOTE : DISC_UNVOTE,
      });
      await send([ix]);
      status(casting ? "Dissolve vote cast." : "Dissolve vote removed.");
    } catch (e) { status("Vote failed: " + shortErr(e)); }
    refreshState();
  };

  $("connect").onclick = async function () {
    var p = provider();
    if (!p) { status("No wallet found — use the buttons above to open this page inside your wallet."); return; }
    try {
      var res = await p.connect();
      wallet = { p: p, pk: new W.PublicKey((res.publicKey || p.publicKey).toString()) };
      $("connect").textContent = wallet.pk.toBase58().slice(0, 4) + "…" + wallet.pk.toBase58().slice(-4);
      status("");
      refreshState();
    } catch (e) { status("Connect cancelled."); }
  };

  async function send(ixs) {
    var tx = new W.Transaction();
    ixs.forEach(function (ix) { tx.add(ix); });
    tx.feePayer = wallet.pk;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    var signed = await wallet.p.signTransaction(tx);
    var sig = await conn.sendRawTransaction(signed.serialize());
    status("confirming " + sig.slice(0, 12) + "…");
    await conn.confirmTransaction(sig, "confirmed");
    return sig;
  }

  function depositData(usd) {
    // deposit(amount: u64) -> 8-byte discriminator + u64 LE amount (6 decimals)
    var data = new Uint8Array(16);
    data.set(DISC_DEPOSIT, 0);
    new DataView(data.buffer).setBigUint64(8, BigInt(usd) * 1000000n, true);
    return data;
  }

  tierBtns.forEach(function (btn) {
    btn.onclick = async function () {
      if (USDC_MINT.indexOf("REPLACE") === 0) { status("Not configured yet: campaign USDC mint missing."); return; }
      var usd = parseInt(btn.getAttribute("data-usd"), 10);
      tierBtns.forEach(function (b) { b.disabled = true; });
      try {
        var mint = new W.PublicKey(USDC_MINT);
        var myAta = ata(wallet.pk, mint);
        var ixs = [];
        ixs.push(new W.TransactionInstruction({
          programId: ATA_PID,
          keys: [
            { pubkey: wallet.pk, isSigner: true, isWritable: true },
            { pubkey: myAta, isSigner: false, isWritable: true },
            { pubkey: wallet.pk, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: W.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PID, isSigner: false, isWritable: false },
          ],
          data: new Uint8Array([1]), // CreateIdempotent
        }));
        ixs.push(new W.TransactionInstruction({
          programId: pid,
          keys: [
            { pubkey: wallet.pk, isSigner: true, isWritable: true },
            { pubkey: campaign, isSigner: false, isWritable: true },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: myAta, isSigner: false, isWritable: true },
            { pubkey: receiptPda(wallet.pk), isSigner: false, isWritable: true },
            { pubkey: TOKEN_PID, isSigner: false, isWritable: false },
            { pubkey: W.SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: depositData(usd),
        }));
        var sig = await send(ixs);
        status("Escrowed $" + usd + " — you're on the board. " + sig.slice(0, 12) + "…");
      } catch (e) {
        status("Deposit failed: " + shortErr(e));
      }
      refreshState();
    };
  });

  function shortErr(e) {
    var m = (e && e.message) || String(e);
    if (m.indexOf("insufficient funds") >= 0) return "not enough USDC in this wallet for that tier.";
    return m.slice(0, 140);
  }

  var VERIFY_PROMPT = "Read https://github.com/Loringtonian/NS-climbing/blob/main/agents.md, SPEC.md,\n" +
    "and escrow/programs/ns-climb-escrow/src/lib.rs in that repo. Verify the six\n" +
    "claims in VERIFY_IT.md against the code, with line numbers — especially claim 1:\n" +
    "confirm no instruction pays an individual depositor while a campaign is active.\n" +
    "Confirm the deployed program matches the source (procedure in agents.md), check\n" +
    "who holds the upgrade authority, and replay the three published rehearsals in\n" +
    "REHEARSALS.md against the chain. Then tell me plainly: every way money can move,\n" +
    "who can trigger each — and would you lock in $20?";
  var _cp = document.getElementById("copyPrompt");
  if (_cp) _cp.onclick = function () {
    (navigator.clipboard ? navigator.clipboard.writeText(VERIFY_PROMPT) : Promise.reject())
      .then(function () { document.getElementById("copyStatus").textContent = "Copied — paste it to Claude, ChatGPT, or any agent."; })
      .catch(function () { document.getElementById("copyStatus").textContent = "Copy blocked — open VERIFY_IT.md and copy from there."; });
  };

  // progress bar rides the counter's numbers
  setInterval(function () {
    var tEl = $("escrow-counter"), bEl = $("bar");
    if (!tEl || !bEl) return;
    var m = tEl.textContent.match(/(\d+)% of goal/);
    if (m) bEl.style.width = m[1] + "%";
  }, 3000);
})();
