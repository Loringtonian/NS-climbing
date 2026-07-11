/* NS climbing wall — live escrow counter.
 *
 * Dependency-free: reads the on-chain Campaign account over plain JSON-RPC
 * and renders "N people · $X escrowed · Y% of goal" into #escrow-counter.
 *
 * Drop into the petition page:
 *   <div id="escrow-counter" class="fine"></div>
 *   <script src="escrow/counter.js"></script>
 *
 * Config: edit the three constants below when the campaign goes live.
 */
(function () {
  // ---- config ---------------------------------------------------------------
  // SECURITY (audit 2026-07-11): config comes from baked defaults or an explicit
  // window.ESCROW_CONFIG set by the INCLUDING PAGE — never from URL params, so a
  // crafted link on the trusted domain cannot repoint the page at a fake
  // program/mint. devnet.html is the only params-driven page, and it is labeled.
  var CFG = window.ESCROW_CONFIG || {};
  var RPC = CFG.rpc || "https://api.devnet.solana.com"; // mainnet: https://api.mainnet-beta.solana.com (or a private RPC)
  var PROGRAM_ID = CFG.program || "7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw";
  var CAMPAIGN_ID = CFG.campaign || "ns-climbing-wall-v2"; // must match the id used at initialize_campaign
  var CAMPAIGN_ADDRESS = CFG.pda || ""; // OPTIONAL: campaign PDA — skips auto-derivation
  var REFRESH_MS = 15000;
  var EL_ID = "escrow-counter";
  // ---------------------------------------------------------------------------

  // base58 (Bitcoin alphabet) — encode/decode, enough for one PDA derivation
  var ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function b58decode(s) {
    var bytes = [0];
    for (var i = 0; i < s.length; i++) {
      var c = ALPHA.indexOf(s[i]);
      if (c < 0) throw new Error("bad base58");
      var carry = c;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (var k = 0; k < s.length && s[k] === "1"; k++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }
  function b58encode(bytes) {
    var digits = [0];
    for (var i = 0; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    var out = "";
    for (var k = 0; k < bytes.length && bytes[k] === 0; k++) out += "1";
    for (var m = digits.length - 1; m >= 0; m--) out += ALPHA[digits[m]];
    return out;
  }

  // PDA derivation = sha256(seeds .. bump, program_id, "ProgramDerivedAddress"),
  // taking the first bump (255 downward) that is NOT on the ed25519 curve.
  // Off-curve check needs ed25519 math — too heavy here. Instead: derive once
  // server-side and paste, OR fetch by trying bumps via RPC. We do the simple
  // robust thing: compute sha256 candidates and ask the RPC which account
  // exists (campaign is created once, so existence = correct address).
  function pdaCandidates(seedArrays, programId, cb) {
    var enc = new TextEncoder();
    var pid = b58decode(programId);
    var marker = enc.encode("ProgramDerivedAddress");
    var tries = [];
    var done = 0;
    for (var bump = 255; bump >= 251; bump--) tries.push(bump); // 5 tries is plenty in practice
    var results = new Array(tries.length);
    tries.forEach(function (bump, idx) {
      var parts = seedArrays.concat([new Uint8Array([bump]), pid, marker]);
      var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
      var buf = new Uint8Array(total);
      var off = 0;
      parts.forEach(function (p) { buf.set(p, off); off += p.length; });
      crypto.subtle.digest("SHA-256", buf).then(function (h) {
        results[idx] = b58encode(new Uint8Array(h));
        if (++done === tries.length) cb(results);
      });
    });
  }

  function rpc(method, params, cb) {
    fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { cb(null, j.result); })
      .catch(function (e) { cb(e); });
  }

  // Campaign account layout (borsh, after the 8-byte Anchor discriminator):
  // admin[32] mint[32] buildout[32] campaign_id[4+len] goal[u64] deadline[i64]
  // total_escrowed[u64] depositor_count[u32] tier_counts[3xu32]
  // dissolve_votes[u32] approved[u8] dissolved[u8] released[u8] bump[u8]
  function parseCampaign(b64) {
    var raw = atob(b64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var dv = new DataView(bytes.buffer);
    var o = 8 + 96;
    var idLen = dv.getUint32(o, true);
    o += 4 + idLen;
    var goal = dv.getBigUint64(o, true); o += 8;
    o += 8; // deadline
    var total = dv.getBigUint64(o, true); o += 8;
    var count = dv.getUint32(o, true); o += 4;
    var tiers = [dv.getUint32(o, true), dv.getUint32(o + 4, true), dv.getUint32(o + 8, true)]; o += 12;
    var votes = dv.getUint32(o, true); o += 4;
    var approved = bytes[o] === 1; o += 1;
    var dissolved = bytes[o] === 1; o += 1;
    var released = bytes[o] === 1;
    return { goal: goal, total: total, count: count, tiers: tiers, votes: votes,
             approved: approved, dissolved: dissolved, released: released };
  }

  var campaignAddr = null;

  // ---- rich live panel (index.html money section) ---------------------------
  // All optional: each element is filled only if present on the page.
  var TIER_NAMES = ["V1", "V5", "V10"];
  function fmtUsd(bi) { return "$" + (Number(bi / 10000n) / 100).toLocaleString(); }
  function renderLive(c) {
    var el;
    if ((el = document.getElementById("goal-now"))) el.textContent = fmtUsd(c.total);
    if ((el = document.getElementById("goal-target"))) el.textContent = fmtUsd(c.goal);
    var goalUsd = Number(c.goal / 10000n) / 100;
    var usd = Number(c.total / 10000n) / 100;
    var pct = goalUsd > 0 ? Math.min(100, (usd / goalUsd) * 100) : 0;
    if ((el = document.getElementById("goal-pct"))) el.textContent = (Math.round(pct * 10) / 10) + "%";
    if ((el = document.getElementById("goal-fill"))) el.style.width = pct + "%";
    if ((el = document.getElementById("goal-people"))) {
      el.textContent = c.count + (c.count === 1 ? " person has" : " people have") + " skin in it";
    }
    if ((el = document.getElementById("goal-tiers"))) {
      var bits = [];
      for (var t = 0; t < 3; t++) if (c.tiers[t]) bits.push('<span class="chip t' + t + '">' + c.tiers[t] + " × " + TIER_NAMES[t] + "</span>");
      el.innerHTML = bits.join("");
    }
    if ((el = document.getElementById("goal-state"))) {
      el.textContent = c.released ? "FUNDED — wall greenlit" : c.dissolved ? "DISSOLVED — refunds open" : "";
    }
  }

  // Latest-supporters strip: receipts are 82-byte accounts keyed to the
  // campaign. No timestamp lives on-chain, so rows show wallet + tier only;
  // a receipt that APPEARS between polls is genuinely new and gets a live
  // "just now" pulse — no fabricated times.
  var knownReceipts = null;
  function pollReceipts() {
    var strip = document.getElementById("live-strip");
    if (!strip || !campaignAddr) return;
    rpc("getProgramAccounts", [PROGRAM_ID, {
      encoding: "base64",
      filters: [{ dataSize: 82 }, { memcmp: { offset: 8, bytes: campaignAddr } }],
    }], function (err, res) {
      if (err || !res) return;
      try {
        var rows = res.map(function (it) {
          var raw = atob(it.account.data[0]);
          var bytes = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          var wallet = b58encode(bytes.slice(40, 72));
          var amt = new DataView(bytes.buffer).getBigUint64(72, true);
          var tier = amt === 1000000000n ? 2 : amt === 100000000n ? 1 : 0;
          return { key: it.pubkey, wallet: wallet, tier: tier };
        });
        var first = knownReceipts === null;
        if (first) knownReceipts = {};
        var frag = "";
        var shown = 0;
        // newest-detected first: fresh receipts prepend
        rows.forEach(function (r) {
          if (!first && !knownReceipts[r.key]) r.isNew = true;
          knownReceipts[r.key] = true;
        });
        rows.sort(function (a, b) { return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0); });
        rows.slice(0, 5).forEach(function (r) {
          frag += '<div class="sup' + (r.isNew ? " new" : "") + '">' +
            '<span class="mono">' + r.wallet.slice(0, 4) + "…" + r.wallet.slice(-4) + "</span>" +
            '<span class="chip t' + r.tier + '">' + TIER_NAMES[r.tier] + "</span>" +
            (r.isNew ? '<span class="just">just now</span>' : "") +
            "</div>";
          shown++;
        });
        strip.innerHTML = shown ? frag : '<div class="sup empty">be the first on the board</div>';
      } catch (_e) {}
    });
  }
  // ---------------------------------------------------------------------------

  function render(c) {
    var el = document.getElementById(EL_ID);
    if (!el) return; // rich panel may be the only consumer; renderLive still runs
    var usd = Number(c.total / 10000n) / 100; // 6-decimals -> dollars
    var goalUsd = Number(c.goal / 10000n) / 100;
    var pct = goalUsd > 0 ? Math.min(100, Math.round((usd / goalUsd) * 100)) : 0;
    // tier names: bouldering grades (sales_kit/TIERS.md, final).
    // Format per spec: "N × V1 · N × V5 · N × V10 · $TOTAL"
    var names = ["V1", "V5", "V10"];
    var parts = [];
    for (var t = 0; t < 3; t++) {
      if (c.tiers[t]) parts.push(c.tiers[t] + " × " + names[t]);
    }
    var who = parts.length ? parts.join(" · ")
      : c.count + (c.count === 1 ? " person" : " people");
    el.textContent =
      who + " · $" + usd.toLocaleString() + " escrowed · " + pct + "% of goal" +
      (c.released ? " · FUNDED — wall greenlit"
        : c.dissolved ? " · DISSOLVED — refunds open" : "");
  }

  function refresh() {
    if (!campaignAddr) return;
    rpc("getAccountInfo", [campaignAddr, { encoding: "base64" }], function (err, res) {
      if (err || !res || !res.value) return; // keep last rendered state on transient errors
      try {
        var parsed = parseCampaign(res.value.data[0]);
        render(parsed);
        renderLive(parsed);
      } catch (_e) {}
    });
    pollReceipts();
  }

  function start() {
    if (CAMPAIGN_ADDRESS) {
      campaignAddr = CAMPAIGN_ADDRESS;
      refresh();
      setInterval(refresh, REFRESH_MS);
      return;
    }
    var enc = new TextEncoder();
    pdaCandidates([enc.encode("campaign"), enc.encode(CAMPAIGN_ID)], PROGRAM_ID, function (cands) {
      // ask which candidate exists (created once at initialize)
      rpc("getMultipleAccounts", [cands, { encoding: "base64" }], function (err, res) {
        if (err || !res) return;
        for (var i = 0; i < cands.length; i++) {
          if (res.value[i]) { campaignAddr = cands[i]; break; }
        }
        refresh();
        setInterval(refresh, REFRESH_MS);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
