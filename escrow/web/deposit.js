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
  // Keep a recent blockhash warm so the click->sign path has NO RPC round-trip
  // in the middle — that mid-flow await both added delay and broke the browser's
  // user-gesture context, which is why Phantom was slow to auto-open. Refresh
  // every 20s; a blockhash stays valid ~60-90s.
  var BH = null;
  function pumpBlockhash() { conn.getLatestBlockhash().then(function (r) { BH = r.blockhash; }).catch(function () {}); }
  pumpBlockhash();
  setInterval(pumpBlockhash, 20000);
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
  // Private name form (Google Forms formResponse endpoint + entry IDs) —
  // config values; until set, the name field is hidden entirely. Names NEVER
  // touch the chain: the deposit transaction is exactly the audited shape.
  var NAME_FORM = (window.ESCROW_CONFIG && window.ESCROW_CONFIG.nameForm) || { endpoint: "", nameEntry: "", walletEntry: "" };
  // Discord thread URL — drop the real link in when Lorin sends it; empty = plain wayfinding text
  var DISCORD_THREAD_URL = (window.ESCROW_CONFIG && window.ESCROW_CONFIG.discordThread) || "";
  var DISCORD_TEXT = "Join the send-climbing thread — NS Discord → #discussion → send-climbing — that's where votes get called.";
  function renderDiscord(el, small) {
    if (!el) return;
    el.innerHTML = DISCORD_THREAD_URL
      ? '<a href="' + DISCORD_THREAD_URL + '" style="color:inherit;text-decoration:underline">' + DISCORD_TEXT + "</a>"
      : DISCORD_TEXT;
    el.classList.remove("hidden");
  }

  var wallet = null;
  var $ = function (id) { return document.getElementById(id); };
  function status(msg) { $("status").textContent = msg; }
  // busy state with an inline spinner (injected once)
  (function () {
    if (document.getElementById("ns-spin-style")) return;
    var s = document.createElement("style"); s.id = "ns-spin-style";
    s.textContent = ".ns-spin{display:inline-block;width:14px;height:14px;margin-right:8px;vertical-align:-2px;border:2px solid rgba(255,255,255,.25);border-top-color:#ffb24a;border-radius:50%;animation:nsspin .7s linear infinite}@keyframes nsspin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  })();
  function busy(msg) { $("status").innerHTML = '<span class="ns-spin"></span>' + msg; }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }

  // A gentle pulse when the supporter badge first appears (injected once).
  (function () {
    if (document.getElementById("ns-badge-style")) return;
    var s = document.createElement("style"); s.id = "ns-badge-style";
    s.textContent = "#inBadge{animation:nsPulse 1.5s ease-in-out 2}@keyframes nsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}";
    document.head.appendChild(s);
  })();

  // Self-contained confetti burst (no external lib — CSP/offline safe). Fires
  // on a successful deposit so locking in feels like a moment.
  function fireConfetti() {
    var c = document.createElement("canvas");
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999";
    document.body.appendChild(c);
    var ctx = c.getContext("2d");
    var W2 = c.width = window.innerWidth, H2 = c.height = window.innerHeight;
    var cols = ["#22c55e", "#16a34a", "#ffb24a", "#f59e0b", "#3b82f6", "#ec4899", "#ffffff"];
    var parts = [];
    for (var i = 0; i < 170; i++) {
      parts.push({
        x: W2 / 2 + (Math.random() - 0.5) * 120, y: H2 * 0.32,
        vx: (Math.random() - 0.5) * 15, vy: Math.random() * -17 - 3,
        g: 0.34 + Math.random() * 0.22, s: 5 + Math.random() * 7,
        col: cols[(Math.random() * cols.length) | 0],
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.45
      });
    }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var el = t - start, alive = false;
      ctx.clearRect(0, 0, W2, H2);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        var a = Math.max(0, 1 - el / 2600);
        if (a > 0 && p.y < H2 + 40) alive = true;
        ctx.globalAlpha = a; ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
      }
      if (alive && el < 3200) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }

  function provider() {
    // ?w=solflare / ?w=phantom pins one wallet when several extensions are
    // installed (default order prefers Phantom). Wallet CHOICE is presentation,
    // not config — it never changes the program/campaign/mint being signed — so
    // it stays within the audit's no-URL-param-config rule.
    var pin = (new URLSearchParams(location.search).get("w") || "").toLowerCase();
    if (pin === "solflare") return window.solflare || null;
    if (pin === "phantom") return (window.phantom && window.phantom.solana) || null;
    // Solflare first (its simulator previews new programs fast; Phantom's
    // Blowfish hangs), generic wallet next, Phantom last.
    return window.solflare ? window.solflare
      : window.solana ? window.solana
      : window.phantom && window.phantom.solana ? window.phantom.solana : null;
  }

  // Tier pre-select — callable (inline tier cards) and via fragment
  // (#v1/#v5/#v10 on the standalone page; a fragment is presentation, not
  // config, so it stays inside the audit's no-URL-param rule).
  var PICKED = null;                       // the tier chosen from the cards, if any
  var TIER_LABEL = { "20": "V1", "100": "V5", "1000": "V10" };
  function preselect(usd) {
    PICKED = String(usd);
    Array.prototype.forEach.call(document.querySelectorAll(".tier"), function (b) {
      var mine = b.getAttribute("data-usd") === PICKED;
      b.style.boxShadow = mine ? "0 0 0 3px rgba(255,178,74,.6)" : "";
    });
    renderPick();
  }
  // One pick, one confirm: when a tier came from the cards we never re-ask for it.
  function renderPick() {
    var ph = document.getElementById("pickHint");
    if (ph) ph.style.display = PICKED ? "none" : "";
    var pw = document.getElementById("pickWrap");
    var pl = document.getElementById("pickLabel");
    var cd = document.getElementById("confirmDeposit");
    if (!pw || !PICKED) return;
    pw.classList.remove("hidden");
    if (pl) pl.textContent = TIER_LABEL[PICKED] + " · $" + Number(PICKED).toLocaleString();
    if (cd) cd.textContent = "Lock in $" + Number(PICKED).toLocaleString();
  }
  window.EscrowFlow = { preselect: preselect };
  var pre = { "#v1": "20", "#v5": "100", "#v10": "1000" }[location.hash];
  if (pre) preselect(pre);
  // Returning from a wallet browser: open the flow and put it in front of the user.
  if (pre || location.hash === "#ask") {
    var fb = document.getElementById("flowBox");
    if (fb) {
      fb.classList.remove("hidden");
      setTimeout(function () { fb.scrollIntoView({ behavior: "smooth", block: "center" }); }, 250);
    }
  }

  // No injected wallet (plain mobile browser) -> deep-link into wallet browsers.
  // The link carries the chosen tier as a fragment so the wallet browser lands
  // back INSIDE the flow (not at the top of the page with everything collapsed).
  function buildDeepLinks() {
    if (provider()) return;
    var frag = location.hash && /^#(v1|v5|v10|ask)$/.test(location.hash) ? location.hash : "#ask";
    var here = location.origin + location.pathname + location.search + frag;
    var pl = $("phantomLink"), sl = $("solflareLink");
    if (pl) pl.href = "https://phantom.app/ul/browse/" + encodeURIComponent(here) + "?ref=" + encodeURIComponent(location.origin);
    if (sl) sl.href = "https://solflare.com/ul/v1/browse/" + encodeURIComponent(here) + "?ref=" + encodeURIComponent(location.origin);
  }
  window.EscrowFlow.refreshDeepLinks = buildDeepLinks;
  // Some extensions (Solflare) inject their provider a beat after our script
  // runs, so a single check at load falsely concludes "no wallet" and shows the
  // mobile deep-link buttons. Poll for a few seconds and flip to the connect UI
  // the moment a provider appears.
  function reflectWallet() {
    var has = !!provider();
    show("nowallet", !has);
    show("hasWallet", has);
    if (!has) buildDeepLinks();
    return has;
  }
  if (!reflectWallet()) {
    var tries = 0;
    var poll = setInterval(function () {
      if (reflectWallet() || ++tries >= 24) clearInterval(poll);
    }, 250);
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
      if (deposited) renderDiscord(document.getElementById("discordCta"));
      var _nameWrap = document.getElementById("whoWrap");
      if (_nameWrap) _nameWrap.classList.toggle("hidden", !(deposited && NAME_FORM.endpoint));
      var pickMode = !!PICKED && !deposited;
      tierBtns.forEach(function (b) { b.classList.toggle("hidden", deposited || pickMode); b.disabled = false; });
      var pw = document.getElementById("pickWrap");
      if (pw) pw.classList.toggle("hidden", !pickMode);
      show("tierFine", !deposited);
      // votes: campaign v4 parse — DOLLAR-WEIGHTED (dissolve_amount /
      // payout_vote_amount are USDC base-unit sums, not head-counts).
      conn.getAccountInfo(campaign).then(function (cAcct) {
        if (!cAcct) return;
        var raw = cAcct.data;
        var dv = new DataView(raw.buffer, raw.byteOffset);
        var usd = function (bi) { return "$" + (Number(bi / 10000n) / 100).toLocaleString(); };
        var o = 8 + 64;
        o += 4 + dv.getUint32(o, true); // campaign_id
        o += 8; // deadline
        var total = dv.getBigUint64(o, true); o += 8; // total_escrowed
        o += 4; // depositor_count
        o += 12; // tier_counts
        var dAmount = dv.getBigUint64(o, true); o += 8; // dissolve_amount (dollars)
        o += 32; // proposed_payout
        var propId = dv.getUint32(o, true); o += 4;
        var pAmount = dv.getBigUint64(o, true); o += 8; // payout_vote_amount (dollars)
        var dissolved = raw[o] === 1;
        var half = usd(total / 2n); // needs MORE than half the pooled dollars
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
              ? "Remove my dissolve vote (" + usd(dAmount) + " backing · needs > " + half + ")"
              : "Vote to dissolve the campaign (" + usd(dAmount) + " backing · needs > " + half + ")";
            el.dataset.voted = voted ? "1" : "0";
            show("voteLink", true);
          }
          renderDiscord(document.getElementById("discordCtaVote"), true);
        }
        // payout vote button (inside the proposal panel, badge-holders only)
        var pb = $("payoutVote");
        if (pb) {
          var live = propId > 0 && !dissolved;
          if (!deposited || !live) { pb.classList.add("hidden"); }
          else {
            var mine = payoutSeq === propId;
            pb.textContent = mine
              ? "Remove my yes-vote (" + usd(pAmount) + " backing · needs > " + half + ")"
              : "Vote yes on this payout (" + usd(pAmount) + " backing · needs > " + half + ")";
            pb.dataset.voted = mine ? "1" : "0";
            pb.classList.remove("hidden");
            pb.disabled = false;
          }
        }
      }).catch(function () {});
    }).catch(function () {});
  }

  var _saveName = document.getElementById("whoSave");
  if (_saveName) _saveName.onclick = function () {
    var nameEl = document.getElementById("whoName");
    // strip control chars, cap 100 — this string goes to a PRIVATE sheet, never on-chain
    var who = (nameEl.value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 100);
    if (!who || !wallet || !NAME_FORM.endpoint) return;
    var body = new URLSearchParams();
    body.set(NAME_FORM.nameEntry, who);
    body.set(NAME_FORM.walletEntry, wallet.pk.toBase58());
    // background fire-and-forget; no-cors means we can't read the response —
    // optimistic confirmation, the user never leaves the page
    fetch(NAME_FORM.endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }).catch(function () {});
    document.getElementById("whoStatus").textContent = "noted ✓";
    nameEl.disabled = true; _saveName.disabled = true;
  };

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

  var _cd = document.getElementById("confirmDeposit");
  if (_cd) _cd.onclick = function () {
    var b = document.querySelector('.tier[data-usd="' + PICKED + '"]');
    if (b) b.click();
  };
  var _ch = document.getElementById("changeTier");
  if (_ch) _ch.onclick = function (e) {
    e.preventDefault();
    PICKED = null;
    var pw = document.getElementById("pickWrap");
    if (pw) pw.classList.add("hidden");
    Array.prototype.forEach.call(document.querySelectorAll(".tier"), function (b) { b.classList.remove("hidden"); b.style.boxShadow = ""; });
  };
  $("connect").onclick = async function () {
    var p = provider();
    if (!p) { status("No wallet found — use the buttons above to open this page inside your wallet."); return; }
    try {
      var res = await p.connect();
      wallet = { p: p, pk: new W.PublicKey((res.publicKey || p.publicKey).toString()) };
      $("connect").textContent = "Connected " + wallet.pk.toBase58().slice(0, 4) + "…" + wallet.pk.toBase58().slice(-4);
      $("connect").classList.add("connected");
      status("");
      refreshState();
    } catch (e) { status("Connect cancelled."); }
  };

  async function send(ixs) {
    var tx = new W.Transaction();
    ixs.forEach(function (ix) { tx.add(ix); });
    tx.feePayer = wallet.pk;
    // use the pre-warmed blockhash when we have one (no mid-click RPC await)
    tx.recentBlockhash = BH || (await conn.getLatestBlockhash()).blockhash;
    busy("Check your wallet — approve the transaction there to lock it in.");
    // signTransaction renders a proceed-able approval screen even for a brand-new
    // program Phantom can't yet simulate (it shows an "unverified" warning with a
    // Proceed option). signAndSendTransaction, by contrast, needs a successful
    // pre-flight simulation to enable Confirm — which hangs blank for an
    // unrecognized program. We sign, then broadcast ourselves via the RPC.
    var signed = await wallet.p.signTransaction(tx);
    var sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: true });
    status("confirming " + String(sig).slice(0, 12) + "…");
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
      busy("Preparing your $" + usd + " deposit — your wallet will pop up to approve it…");
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
        $("status").innerHTML = '🎉 <strong>You’re in!</strong> $' + usd +
          ' locked in the pool for the wall. ' +
          '<a href="https://explorer.solana.com/tx/' + sig + '" target="_blank" rel="noopener" ' +
          'style="text-decoration:underline">view your transaction ↗</a>';
        fireConfetti();
        renderDiscord(document.getElementById("discordCta"));
      } catch (e) {
        console.error("[NS deposit] failed:", e);
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
    "who can trigger each — and would you tell me to lock in $20 of my own money\n" +
    "to vote with my wallet for a climbing wall at Network School?";
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
