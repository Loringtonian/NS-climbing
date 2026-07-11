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
  // ---- config -------------------------------------------------------------
  var RPC = "https://api.devnet.solana.com"; // mainnet: https://api.mainnet-beta.solana.com (or a private RPC)
  var PROGRAM_ID = "7jRa1vZtLqDyzcc676S7wHmoGA4zCpJRUBkeiC3YVWDw";
  var CAMPAIGN_ID = "ns-climbing-wall"; // must match the id used at initialize_campaign
  var CAMPAIGN_ADDRESS = ""; // OPTIONAL: paste the campaign PDA printed by scripts/init_campaign.ts to skip auto-derivation
  var REFRESH_MS = 15000;
  var EL_ID = "escrow-counter";
  // -------------------------------------------------------------------------

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
  // admin[32] mint[32] buildout[32] campaign_id[4+len] goal[u64] deposit_amount[u64]
  // deadline[i64] total_escrowed[u64] depositor_count[u32] approved[u8] released[u8] bump[u8]
  function parseCampaign(b64) {
    var raw = atob(b64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var dv = new DataView(bytes.buffer);
    var o = 8 + 96;
    var idLen = dv.getUint32(o, true);
    o += 4 + idLen;
    var goal = dv.getBigUint64(o, true); o += 8;
    o += 8; // deposit_amount
    o += 8; // deadline
    var total = dv.getBigUint64(o, true); o += 8;
    var count = dv.getUint32(o, true); o += 4;
    var approved = bytes[o] === 1; o += 1;
    var released = bytes[o] === 1;
    return { goal: goal, total: total, count: count, approved: approved, released: released };
  }

  var campaignAddr = null;

  function render(c) {
    var el = document.getElementById(EL_ID);
    if (!el) return;
    var usd = Number(c.total / 10000n) / 100; // 6-decimals -> dollars
    var goalUsd = Number(c.goal / 10000n) / 100;
    var pct = goalUsd > 0 ? Math.min(100, Math.round((usd / goalUsd) * 100)) : 0;
    el.textContent =
      c.count + (c.count === 1 ? " person" : " people") +
      " · $" + usd.toLocaleString() + " escrowed · " + pct + "% of goal" +
      (c.released ? " · FUNDED — wall greenlit" : "");
  }

  function refresh() {
    if (!campaignAddr) return;
    rpc("getAccountInfo", [campaignAddr, { encoding: "base64" }], function (err, res) {
      if (err || !res || !res.value) return; // keep last rendered state on transient errors
      try { render(parseCampaign(res.value.data[0])); } catch (_e) {}
    });
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
