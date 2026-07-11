// Shared cheer-board logic: who cheered, how often, and which face they are.
//
// READ-ONLY against the chain. Reads the board account for the authoritative
// tally, and the board's transaction history to attribute each cheer to the key
// that signed it. Signs nothing, sends nothing, writes no localStorage.
//
// Used by cheer.html (button + leaderboard) and tally.html (projector).

(function (global) {
  var DISC_CHEER = [23, 127, 15, 40, 49, 42, 21, 88]; // anchor discriminator for `cheer`
  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  function b58decode(s) {
    var bytes = [0], i, j, carry;
    for (i = 0; i < s.length; i++) {
      carry = B58.indexOf(s[i]);
      if (carry < 0) return null;
      for (j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (i = 0; i < s.length && s[i] === "1"; i++) bytes.push(0);
    return bytes.reverse();
  }

  // ---- faces ---------------------------------------------------------------
  // A key's face is a pure function of the key, so anyone can recompute it from
  // public data — no lookup table, no server, nothing to trust. Two faces per
  // key: one face out of ~150 collides for most pairs of people in a room this
  // size (birthday problem), and a duplicate row reads as a bug. Two is plenty.
  var FACES = (
    "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😋😛😜🤪😝🤑🤗🤭🤫🤔🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴" +
    "😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬" +
    "😈👿💀👽👾🤖🤡👹👺👻🎃" +
    "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦗🐢🐍🦎🦖🦕" +
    "🐙🦑🦐🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🐄🐎🐖🐑🦙🐐🦌🐕🐩🐈🐓🦃🦚🦜🦢🦩🐇🦝🦨🦡🦫🦦🦥🐁🐿🦔"
  ).match(/./gu);

  // FNV-1a, twice with different offsets — cheap, deterministic, no crypto needed
  function fnv(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function faceFor(pubkey) {
    var n = FACES.length;
    var a = fnv(pubkey, 2166136261) % n;
    // second index skips the first, so nobody gets the same face twice
    var b = fnv(pubkey, 1099511597) % (n - 1);
    if (b >= a) b++;
    return FACES[a] + FACES[b];
  }

  // ---- board ---------------------------------------------------------------
  function CheerBoard(opts) {
    this.rpcUrl = opts.rpc;
    this.board = opts.board;
    this.program = opts.program;
    this.onUpdate = opts.onUpdate || function () {};
    this.counts = {};      // pubkey -> cheers, attributed from signatures
    this.seen = {};        // signature -> 1, so a tx is never counted twice
    this.sinceSig = null;  // newest signature already attributed
    this.total = 0;        // authoritative, straight off the account
    this.syncing = false;
  }

  CheerBoard.prototype.rpc = function (body) {
    return fetch(this.rpcUrl, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  };
  CheerBoard.prototype.call = function (method, params) {
    return this.rpc({ jsonrpc: "2.0", id: 1, method: method, params: params })
      .then(function (j) { return j.result; });
  };

  CheerBoard.prototype.snapshot = function () {
    return this.counts;
  };

  // ranked, richest first
  CheerBoard.prototype.list = function () {
    var c = this.counts;
    return Object.keys(c).map(function (k) {
      return { pubkey: k, cheers: c[k], face: faceFor(k) };
    }).sort(function (a, b) { return b.cheers - a.cheers || a.pubkey.localeCompare(b.pubkey); });
  };

  CheerBoard.prototype.emit = function () {
    var list = this.list();
    this.onUpdate({
      total: this.total || list.reduce(function (s, r) { return s + r.cheers; }, 0),
      people: list.length,
      list: list,
    });
  };

  // one cheap account read — the tally the program itself keeps
  CheerBoard.prototype.pollTotal = function () {
    var self = this;
    return this.call("getAccountInfo", [this.board, { encoding: "base64", commitment: "processed" }])
      .then(function (res) {
        if (!res || !res.value) return;
        var raw = atob(res.value.data[0]);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        // 8 disc | 32 authority | 8 board_id | 8 cheers (u64 LE)
        self.total = Number(new DataView(bytes.buffer).getBigUint64(48, true));
        self.emit();
      }).catch(function () {});
  };

  CheerBoard.prototype.isCheer = function (msg) {
    var program = this.program;
    return (msg.instructions || []).some(function (ix) {
      if (ix.programId !== program || !ix.data) return false;
      var d = b58decode(ix.data);
      return d && DISC_CHEER.every(function (b, n) { return d[n] === b; });
    });
  };

  // resolve only what landed after the snapshot — the history bulk is precomputed
  CheerBoard.prototype.pullNew = function () {
    var self = this;
    if (this.syncing) return Promise.resolve();
    this.syncing = true;
    var fresh = [];

    function page(before, depth) {
      var p = { limit: 1000 };
      if (before) p.before = before;
      if (self.sinceSig) p.until = self.sinceSig;
      return self.call("getSignaturesForAddress", [self.board, p]).then(function (sigs) {
        if (!sigs || !sigs.length) return;
        fresh = fresh.concat(sigs);
        // with no floor signature there is nothing to page back to — take one page
        if (sigs.length === 1000 && self.sinceSig && depth < 2) {
          return page(sigs[sigs.length - 1].signature, depth + 1);
        }
      });
    }

    return page(null, 0).then(function () {
      var live = fresh.filter(function (s) { return !s.err; });
      var todo = live.filter(function (s) { return !self.seen[s.signature]; });
      var newest = fresh.length ? fresh[0].signature : null;
      if (!todo.length) { if (newest) self.sinceSig = newest; return; }

      var capped = todo.slice(0, 400); // bound what a phone does in one pass
      var chunks = [];
      for (var i = 0; i < capped.length; i += 100) chunks.push(capped.slice(i, i + 100));

      return chunks.reduce(function (chain, chunk) {
        return chain.then(function () {
          return self.rpc(chunk.map(function (s, k) {
            return {
              jsonrpc: "2.0", id: k, method: "getTransaction",
              params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
            };
          })).then(function (res) {
            (Array.isArray(res) ? res : []).forEach(function (item, k) {
              var tx = item && item.result;
              self.seen[chunk[k].signature] = 1;
              if (!tx || !tx.transaction) return;
              var msg = tx.transaction.message;
              if (!self.isCheer(msg)) return;
              var signer = (msg.accountKeys || []).filter(function (a) { return a.signer; })[0];
              if (!signer) return;
              self.counts[signer.pubkey] = (self.counts[signer.pubkey] || 0) + 1;
            });
          });
        });
      }, Promise.resolve()).then(function () {
        // only move the floor once everything above it is attributed
        if (capped.length === todo.length && newest) self.sinceSig = newest;
        self.emit();
      });
    }).catch(function () {}).then(function () { self.syncing = false; });
  };

  // precomputed history, so a phone never walks thousands of transactions
  CheerBoard.prototype.loadSnapshot = function (url) {
    var self = this;
    return fetch(url + "?v=" + Date.now()).then(function (r) {
      if (!r.ok) throw new Error("no snapshot");
      return r.json();
    }).then(function (snap) {
      (snap.cheerers || []).forEach(function (c) { self.counts[c.pubkey] = c.cheers; });
      self.sinceSig = snap.latestSig || null;
      self.total = snap.boardTotal || 0;
      self.emit();
      return snap;
    }).catch(function () { return null; });
  };

  CheerBoard.prototype.start = function (opts) {
    var self = this;
    opts = opts || {};
    var totalMs = opts.totalMs || 3000;
    var tailMs = opts.tailMs || 10000;
    return this.loadSnapshot(opts.snapshot || "leaderboard.json").then(function (snap) {
      self.pollTotal();
      self.pullNew();
      setInterval(function () { self.pollTotal(); }, totalMs);
      setInterval(function () { self.pullNew(); }, tailMs);
      return snap;
    });
  };

  global.CheerBoard = CheerBoard;
  global.CheerBoard.faceFor = faceFor;
  global.CheerBoard.FACES = FACES;
})(window);
