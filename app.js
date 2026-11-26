// China Bite validation build — no real payment, no real ads, no server.
// All state is local (localStorage). Referral invites are a PLACEHOLDER here:
// sharing does NOT count as an invite. Real invite counting needs a server (D1).
(function () {
  "use strict";
  // ================================================================
  // DEV MODE / PAYWALL — 开发模式集中配置（全站只有这一处开关）
  // DEV_MODE = true（默认开启）：开发版，全部功能解锁，不自我限制。
  //   - 解码无限次（不扣 3 次/天，不看广告，不扣次数）
  //   - 12 张饮食卡全开（代码里本来就全量渲染，无锁；DEV_MODE 下保持全开）
  //   - Kit $6.99 内容全开预览（锁文案隐藏，见下面的 DEV MODE 初始化）
  //   - 奖励广告不挡路（广告区隐藏，看广告才 +3 的流程不执行）
  //   - 订阅框不挡功能（订阅逻辑本身不动）
  // 付费逻辑没有删，只是被 DEV_MODE 绕过（下面所有绕过处都标 // PAYWALL）。
  // 最终交付时把 DEV_MODE 设 false，免费/收费权限按蓝图恢复：
  //   免费 3 次/天（好友链接 6 次）、广告 +3（上限 5 次/天）、
  //   Kit 预览每区恰好 1 个样本、其余锁定。
  // 价格 $6.99 不改，订阅代码结构不改。
  // ================================================================
  var DEV_MODE = true;
  // PAYWALL：正式版免费/收费规则（DEV_MODE=false 时生效；
  // DEV_MODE=true 时仅作记录，不执行）。
  var PAYWALL = {
    freeDecodesPerDay: 3,
    referredDecodesPerDay: 6,
    adBonusPerWatch: 3,
    maxAdsPerDay: 5,
    kitPriceUSD: 6.99,
    kitDays: 90,
    kitPreviewPerSection: 1 // Kit 预览每区恰好 1 个样本
  };
  var D = window.CHINABITE_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "chinabite_state_v1";
  var LEGACY_KEY = "eatchina_state_v1"; // 迁移用：旧名 key 只读一次，下版可删
  var today = new Date().toISOString().slice(0, 10);

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || "{}"); } catch (e) { s = {}; }
    if (s.date !== today) { s = { date: today, used: 0, bonus: 0, adsToday: 0 }; }
    s.used = s.used || 0; s.bonus = s.bonus || 0; s.adsToday = s.adsToday || 0;
    s.unknown = s.unknown || [];
    s.order = s.order || [];
    s.checks = s.checks || {};
    if (!s.myRef) s.myRef = "CB" + Math.random().toString(36).slice(2, 8).toUpperCase();
    return s;
  }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.removeItem(LEGACY_KEY); } catch (e) {} }

  // Referral: ?ref=CODE from someone else -> base 6 instead of 3.
  var params = new URLSearchParams(location.search);
  var incomingRef = params.get("ref");
  var referred = !!(incomingRef && incomingRef !== state.myRef);
  var baseFree = referred ? PAYWALL.referredDecodesPerDay : PAYWALL.freeDecodesPerDay;
  // PAYWALL：DEV_MODE 下默认等同已购 Kit 预览（无限解码、无广告），
  // 付费预览开关本身保留，DEV_MODE=false 时恢复手动切换。
  var paidPreview = DEV_MODE;
  // v4.3: diet profile is MULTI-SELECT — an array of diet ids.
  // [] = no restriction. "none" is not stored; it is the empty array.
  var profile = [];
  var lastDish = null;

  // PAYWALL：DEV_MODE 下解码无限次，不扣次数。
  function remaining() { if (DEV_MODE) return Infinity; return Math.max(0, baseFree + state.bonus - state.used); }
  function usd(cny) { return (cny / D.rate).toFixed(2); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // ---- Profiles (v4.3: MULTI-SELECT) ----
  // Any diet/allergy options can be true at the same time, so chips toggle:
  // tap to select, tap again to unselect. "No restriction" is exclusive —
  // tapping it clears the rest, tapping anything else clears it (it is just
  // the empty selection, never stored alongside other ids).
  var profEl = $("profiles");
  function profileById(id) {
    for (var i = 0; i < D.profiles.length; i++) if (D.profiles[i].id === id) return D.profiles[i];
    return null;
  }
  function refreshProfileUI() {
    Array.prototype.forEach.call(profEl.children, function (c) {
      var id = c.getAttribute("data-profile");
      var on = id === "none" ? profile.length === 0 : profile.indexOf(id) >= 0;
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var labels = profile.map(function (id) { var p = profileById(id); return p ? p.en : id; });
    $("profileDesc").textContent = labels.length ? labels.join(" · ") : "No restriction.";
  }
  D.profiles.forEach(function (p) {
    var b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.textContent = p.en;
    b.setAttribute("data-profile", p.id);
    b.onclick = function () {
      if (p.id === "none") profile = [];
      else {
        var i = profile.indexOf(p.id);
        if (i >= 0) profile.splice(i, 1); else profile.push(p.id);
      }
      refreshProfileUI();
      if (lastDish) renderResult(lastDish);
    };
    profEl.appendChild(b);
  });
  refreshProfileUI();

  // ---- Verdict logic ----
  // English-first (v3.2): the "why" is derived from the dish flags in plain
  // English ("Contains pork, peanuts."). The Chinese note/hidden fields stay
  // in data.js only (metadata) and are never shown — Chinese on screen is
  // only dish names (subtitle) and the big waiter sentences.
  var FLAG_EN = { pork: "pork", lard: "lard", stock: "meat stock", peanut: "peanuts", shrimp: "shrimp", gluten: "wheat (gluten)", soy: "soy", egg: "egg", dairy: "dairy", beef: "beef", chicken: "chicken", fish: "fish", lamb: "lamb", duck: "duck", goose: "goose", frog: "frog", alcohol: "alcohol" };
  function containsEn(dish) {
    var f = (dish.flags || []).filter(function (x) { return FLAG_EN[x]; }).map(function (x) { return FLAG_EN[x]; });
    if (!f.length) return "Nothing sneaky in here.";
    return "Has " + f.join(", ") + " in it.";
  }
  // One diet rule, judged on its own. verdictFor() below runs EVERY
  // selected rule and takes the worst result — so vegetarian + peanut
  // allergy means a dish is skipped if EITHER rule says skip.
  function singleVerdict(id, dish) {
    var f = dish.flags || [];
    function has() { for (var i = 0; i < arguments.length; i++) if (f.indexOf(arguments[i]) >= 0) return true; return false; }
    var meat = has("pork", "beef", "chicken", "duck", "fish", "shrimp", "frog", "goose", "lamb");
    var animal = meat || has("egg", "dairy");
    if (id === "none") return { k: "ok", t: "You're good", why: containsEn(dish) };
    if (id === "vegetarian") {
      if (meat) return { k: "no", t: "Skip this one", why: "It's got meat in it. " + containsEn(dish) };
      if (has("lard", "stock")) return { k: "ask", t: "Ask them first", why: "Could be lard or meat stock in there — worth one quick question." };
      if (has("egg")) return { k: "ok", t: "You're good", why: "Egg's fine for you. " + containsEn(dish) };
      return { k: "ok", t: "You're good", why: containsEn(dish) };
    }
    if (id === "vegan") {
      if (animal || has("lard", "stock")) return { k: "no", t: "Skip this one", why: "Animal product in there. " + containsEn(dish) };
      return { k: "ok", t: "You're good", why: containsEn(dish) };
    }
    if (id === "halal") {
      if (has("pork", "lard", "alcohol")) return { k: "no", t: "Skip this one", why: "Pork or lard — not halal. " + containsEn(dish) };
      if (meat) return { k: "ask", t: "Ask them first", why: "It's meat — ask if it's halal, or look for the green 清真 sign." };
      return { k: "ok", t: "You're good", why: containsEn(dish) };
    }
    if (id === "peanut") {
      if (has("peanut")) return { k: "no", t: "Skip this one", why: "Peanuts are the whole point of this one. Don't risk it." };
      if (has("stock")) return { k: "ask", t: "Ask them first", why: "No peanuts in the dish itself — but ask about the sauce, just in case." };
      return { k: "ok", t: "You're good", why: containsEn(dish) };
    }
    if (id === "shellfish") {
      if (has("shrimp")) return { k: "no", t: "Skip this one", why: "Shellfish in there. Don't risk it." };
      if (has("stock")) return { k: "ask", t: "Ask them first", why: "No shellfish in the dish — but the stock might have some. One quick question." };
      return { k: "ok", t: "You're good", why: containsEn(dish) };
    }
    if (id === "gluten") {
      if (has("gluten")) return { k: "no", t: "Skip this one", why: "Wheat in there. " + containsEn(dish) };
      return { k: "ok", t: "You're good", why: containsEn(dish) };
    }
    if (id === "nospicy") {
      if (dish.spicy >= 2) return { k: "no", t: "Too hot for you", why: "Spice " + dish.spicy + "/3 — this one bites back." };
      if (dish.spicy === 1) return { k: "ask", t: "Ask them first", why: "Just a little heat — ask them to hold the chili." };
      return { k: "ok", t: "You're good", why: "No heat at all. " + containsEn(dish) };
    }
    return { k: "ok", t: "You're good", why: containsEn(dish) };
  }

  // v4.3: combine ALL selected diet rules. Worst result wins
  // (no > ask > ok); the "why" joins every rule that objected, so a
  // vegetarian with a peanut allergy hears about the meat AND the peanuts.
  // A single selected diet gives exactly the old single-diet answer.
  function verdictFor(dish) {
    if (!profile.length) return { k: "ok", t: "You're good", why: containsEn(dish) };
    var worst = 0, whys = [], seenWhy = {};
    profile.forEach(function (id) {
      var r = singleVerdict(id, dish);
      var rank = r.k === "no" ? 2 : r.k === "ask" ? 1 : 0;
      if (rank > worst) worst = rank;
      if (rank > 0 && !seenWhy[r.why]) { seenWhy[r.why] = true; whys.push(r.why); }
    });
    if (worst === 0) return { k: "ok", t: "You're good", why: containsEn(dish) };
    return {
      k: worst === 2 ? "no" : "ask",
      t: worst === 2 ? "Skip this one" : "Ask them first",
      why: whys.join(" ")
    };
  }

  function spiceLabel(n) { return ["Not spicy", "Mild", "Medium", "Very spicy"][n] + " (" + n + "/3)"; }

  // ---- Meituan / Dianping deep links (single source of truth) ----
  // Schemes come from public URL-scheme lists (e.g. xydida.com APP-URL-Scheme):
  // Meituan Waimai = meituanwaimai:// , Dianping = dianping:// , Meituan = imeituan://
  // NEITHER Meituan nor Dianping publishes official deep-link docs, so the
  // search paths below are BEST-EFFORT: if the app ignores the path it still
  // opens; the H5 fallback always lands on a working search page.
  // H5 URLs verified 2026-11-26 by curl (mobile UA):
  //   i.meituan.com/search?keyword=X -> 200, keyword preserved in final URL
  //   h5.waimai.meituan.com/waimai/mindex/home -> 200
  //   www.dianping.com/ -> 200 (bot-check page for curl; real phones pass)
  //   apps.apple.com/cn/search?term=... -> 404, so NO App Store link is used;
  //   the H5 page itself prompts to install the app when it isn't installed.
  // TODO: verify scheme wake-up on a real phone — jsdom can only check the
  // link format, never whether the app actually opens.
  var MEITUAN_LINKS = {
    waimaiScheme: function (kw) { return "meituanwaimai://waimai/search?keyword=" + encodeURIComponent(kw); },
    waimaiSchemeHome: "meituanwaimai://",
    waimaiH5: function (kw) { return "https://i.meituan.com/search?keyword=" + encodeURIComponent(kw); },
    waimaiH5Home: "https://h5.waimai.meituan.com/waimai/mindex/home",
    dianpingScheme: function (kw) { return "dianping://search?keyword=" + encodeURIComponent(kw); },
    dianpingSchemeHome: "dianping://",
    dianpingH5: "https://www.dianping.com/"
  };
  // Try to wake the app; if the page is still visible after 1.5s the app
  // isn't installed (or ignored the scheme) -> go to the H5 fallback.
  // Fallback uses location.href (not window.open) because a delayed
  // window.open is blocked as a popup; this navigates away from China Bite.
  function openDeepLink(schemeUrl, fallbackUrl) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; window.location.href = fallbackUrl; } }, 1500);
    var onHide = function () { done = true; clearTimeout(t); };
    document.addEventListener("visibilitychange", onHide, { once: true });
    window.addEventListener("pagehide", onHide, { once: true });
    var f = document.createElement("iframe");
    f.style.display = "none";
    f.src = schemeUrl;
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 2000);
  }

  // ---- v5.3: price basis (one honest line, everywhere a price shows) ----
  // Prices were set as a flat reference with no stated basis. The basis is:
  // a mid-range local restaurant in a Tier-1 city (Shanghai / Beijing).
  // Street stalls are cheaper; hotels and tourist areas cost more; Tier-2
  // cities (Chengdu / Hangzhou / Chongqing / Xi'an) and Tier-3 cities
  // (Kunming / Guilin) usually run cheaper than this. Numbers are NOT
  // re-priced here — only the basis is stated; see Blueprint §12.40 for
  // the dishes furthest from this basis (the re-price list).
  var PRICE_BASIS_SHORT = "Reference only — mid-range local restaurant, Tier-1 city";
  var PRICE_BASIS = "Reference only — mid-range local restaurant in a Tier-1 city (Shanghai / Beijing). Street stalls are cheaper; hotels & tourist spots cost more. ¥→$ at 7.1 (2026-11-26).";
  var CITY_TIER = { shanghai: 1, beijing: 1, guangzhou: 1, shenzhen: 1, chengdu: 2, hangzhou: 2, chongqing: 2, xian: 2, kunming: 3, guilin: 3 };

  function renderResult(dish) {
    lastDish = dish;
    var v = verdictFor(dish);
    var cls = v.k === "ok" ? "ok" : v.k === "ask" ? "ask" : "no";
    updateDishMeta(dish, v);
    try { history.replaceState(null, "", "?ref=" + state.myRef + "#/dish/" + dish.id); } catch (e) {}
    $("result").className = "subcard";
    $("result").innerHTML =
      '<img class="mascot-mini" src="assets/china-bite-mascot-dumpling-288.webp" alt="China Bite mascot — a cheerful dumpling holding chopsticks" width="32" height="32" loading="lazy">' +
      '<div class="verdict ' + cls + '">' + esc(v.t) + " — " + esc(dish.en) + " (" + esc(dish.zh) + ")</div>" +
      "<p><b>Here's why:</b> " + esc(v.why) + "</p>" +
      "<p><b>What's in it:</b> " + esc(dish.main) + "</p>" +
      "<p><b>Heads up:</b> " + esc(containsEn(dish)) + "</p>" +
      "<p><b>How hot:</b> " + esc(spiceLabel(dish.spicy)) + "</p>" +
      ((dish.flags && dish.flags.length) ? "<p><b>Watch:</b> " + esc(dish.flags.join(", ")) + "</p>" : "") +
      "<p><b>About:</b> ¥" + dish.price + " · ≈$" + usd(dish.price) + "</p>" +
      "<p class=\"small price-note\">" + esc(PRICE_BASIS) + "</p>" +
      "<p><b>Show them this:</b></p><p class=\"bigzh\">" + esc(dish.waiter) + "</p>" +
      "<p class=\"small\">" + esc(dish.py) + "</p>" +
      '<button type="button" id="addOrderBtn">Add to order</button> ' +
      '<button type="button" class="ghost" id="shareDishBtn">Share</button>' +
      '<details class="subcard"><summary>Next · pick one</summary>' +
      '<div class="next-steps">' +
      '<button type="button" id="nextMeituanBtn">Search on Meituan</button>' +
      '<button type="button" class="ghost" id="nextDianpingBtn">Search on Dianping</button>' +
      '<button type="button" class="ghost" id="nextQrBtn">How to order by QR</button>' +
      '<button type="button" class="ghost" id="nextCardBtn">Show diet card to waiter</button></div></details>' +
      "<p><b>Meituan:</b> Tap \"Search on Meituan\" — it opens Meituan Waimai search for this dish. You order and pay in Meituan, not here.</p>" +
      "<p><b>Dianping:</b> Tap \"Search on Dianping\" — reviews and group deals for this dish, in the Dianping app or on the web.</p>" +
      "<p><b>Getting it delivered?</b> Your hotel card is waiting in the Meituan section — the rider needs your address in Chinese.</p>";
    $("addOrderBtn").onclick = function () { addToOrder(dish); };
    $("shareDishBtn").onclick = function () { shareDish(dish, v); };
    $("nextMeituanBtn").onclick = function () { openDeepLink(MEITUAN_LINKS.waimaiScheme(dish.zh), MEITUAN_LINKS.waimaiH5(dish.zh)); };
    $("nextDianpingBtn").onclick = function () { openDeepLink(MEITUAN_LINKS.dianpingScheme(dish.zh), MEITUAN_LINKS.dianpingH5); };
    $("nextQrBtn").onclick = function () { gotoSection("qrSection"); };
    $("nextCardBtn").onclick = function () { gotoSection("dietSection"); };
    updateCounts();
  }

  // ---- v5.3: decoder matching — exact -> alias -> pinyin -> contains -> fuzzy ----
  // One normalizer for everything: lowercase, tone marks stripped,
  // full-width folded to half-width, all spaces and punctuation dropped.
  // So "麻婆豆付", "Mapo Tofu", "mapo doufu" and "  麻婆豆腐，" all reduce
  // to comparable keys. Alias keys live ONLY in aliases.js
  // (window.CHINABITE_ALIASES) — never scattered through the code.
  // Pinyin keys are derived from data.js `py` at runtime, so the 110
  // dishes never need a hand-kept pinyin table.
  function normStr(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\p{P}\u3000-\u303F]/gu, "");
  }
  function stripParen(s) { return String(s || "").replace(/[(（][^)）]*[)）]/g, ""); }
  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }
  // Lookup tables, built once from data.js + aliases.js.
  var ALIAS_MAP = {}, ALIAS_BY_DISH = {}, PY_MAP = {};
  (function buildMatchIndexes() {
    var raw = window.CHINABITE_ALIASES || {};
    Object.keys(raw).forEach(function (k) {
      var nk = normStr(k), id = raw[k];
      if (!nk || !id) return;
      ALIAS_MAP[nk] = id;
      (ALIAS_BY_DISH[id] = ALIAS_BY_DISH[id] || []).push(nk);
    });
    D.dishes.forEach(function (d) {
      var py = normStr(stripParen(d.py || ""));
      if (py && !PY_MAP[py]) PY_MAP[py] = d.id;
    });
  })();
  function dishByIdLocal(id) {
    for (var i = 0; i < D.dishes.length; i++) if (D.dishes[i].id === id) return D.dishes[i];
    return null;
  }
  function dishKeys(d) {
    var keys = [normStr(d.zh), normStr(d.en), normStr(stripParen(d.py || ""))];
    (ALIAS_BY_DISH[d.id] || []).forEach(function (k) { keys.push(k); });
    return keys.filter(Boolean);
  }
  // Score one dish against a normalized query (0-100). Used for the
  // "Did you mean" list — token overlap + substring + edit similarity,
  // so regional words and near-misses surface real dishes, never random ones.
  function matchScore(d, n) {
    if (!n) return 0;
    var best = 0;
    dishKeys(d).forEach(function (k) {
      var s = 0;
      if (k === n) s = Math.max(s, 100);
      else if (k.indexOf(n) >= 0 || n.indexOf(k) >= 0) s = Math.max(s, 70);
      else {
        var dist = levenshtein(n, k);
        if (dist <= 3) s = Math.max(s, Math.round((1 - dist / Math.max(n.length, k.length)) * 50));
      }
      best = Math.max(best, s);
    });
    // Token overlap: every query character found in the Chinese name, or
    // every query word found in the English name, counts. This is what
    // catches 包子 -> the bao dishes.
    var zh = d.zh || "", en = (d.en || "").toLowerCase();
    var chars = n.replace(/[a-z0-9]/g, "").split("");
    var hit = 0;
    chars.forEach(function (c) { if (zh.indexOf(c) >= 0) hit++; });
    if (chars.length >= 2) best = Math.max(best, Math.round(hit / chars.length * 60));
    var words = n.replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
    if (words.length) {
      var whit = words.filter(function (w) { return en.indexOf(w) >= 0; }).length;
      best = Math.max(best, Math.round(whit / words.length * 45));
    }
    // Cross-language ingredient match: a Chinese food word in the query
    // against the dish's English ingredients. This is what catches
    // 土豆丝 / 洋芋丝 -> 地三鲜 (the only potato-shreds-ish dish) even
    // though no dish is literally called 土豆丝. Suggestions only — it
    // never auto-decodes a verdict.
    if (n.length >= 2) {
      var hay = ((d.main || "") + " " + (d.en || "")).toLowerCase();
      var ing = 0;
      Object.keys(ING_WORDS).forEach(function (k) {
        if (n.indexOf(k) >= 0 && hay.indexOf(ING_WORDS[k]) >= 0) ing += 25;
      });
      best = Math.max(best, Math.min(ing, 45));
    }
    return best;
  }
  // Chinese food word -> English ingredient word (for matchScore only).
  var ING_WORDS = {
    土豆: "potato", 洋芋: "potato", 马铃薯: "potato", 茄子: "eggplant",
    辣椒: "chili", 辣: "chili", 鸡蛋: "egg", 蛋: "egg", 猪肉: "pork",
    牛肉: "beef", 羊肉: "lamb", 鸡: "chicken", 鸭: "duck", 鱼: "fish",
    虾: "shrimp", 花生: "peanut", 豆腐: "tofu", 面: "noodle", 饭: "rice",
    汤: "soup", 饺子: "dumpling", 包子: "bun", 馒头: "bun", 青菜: "green",
    蘑菇: "mushroom", 木耳: "wood ear", 黄瓜: "cucumber",
    西红柿: "tomato", 番茄: "tomato", 米粉: "rice noodle", 米线: "rice noodle"
  };
  // Ranked candidates, best first. Only dishes scoring >= 25 count as a
  // real suggestion — below that we say so honestly instead of guessing.
  function suggestDishes(q, count) {
    var n = normStr(q);
    if (!n) return [];
    var scored = D.dishes.map(function (d) { return { dish: d, score: matchScore(d, n) }; })
      .filter(function (x) { return x.score >= 25; })
      .sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, count || 3).map(function (x) { return x.dish; });
  }
  // Full match, with HOW it matched. findDish() (strict, no fuzzy) is what
  // OCR and chat use — auto-decoding a fuzzy guess could hand a person with
  // an allergy the wrong verdict. The decoder UI uses findDishBest() and
  // shows a "Did you mean" confirmation for fuzzy hits instead.
  function findDishBest(q) {
    var n = normStr(q);
    if (!n) return { dish: null, how: "none" };
    var d, i;
    for (i = 0; i < D.dishes.length; i++) {
      d = D.dishes[i];
      if (normStr(d.zh) === n || normStr(d.en) === n) return { dish: d, how: "exact" };
    }
    if (ALIAS_MAP[n]) { d = dishByIdLocal(ALIAS_MAP[n]); if (d) return { dish: d, how: "alias" }; }
    if (PY_MAP[n]) { d = dishByIdLocal(PY_MAP[n]); if (d) return { dish: d, how: "pinyin" }; }
    if (n.length >= 2) {
      var best = null, bestLen = -1;
      D.dishes.forEach(function (x) {
        if (normStr(x.zh).indexOf(n) >= 0 || normStr(x.en).indexOf(n) >= 0 || normStr(stripParen(x.py || "")).indexOf(n) >= 0) {
          var len = normStr(x.zh).length + normStr(x.en).length;
          if (len > bestLen) { bestLen = len; best = x; }
        }
      });
      if (best) return { dish: best, how: "contains" };
      // The dish name is inside a longer query ("Can I eat mapo tofu?").
      best = null; bestLen = -1;
      D.dishes.forEach(function (x) {
        var kz = normStr(x.zh), ke = normStr(x.en);
        if ((kz.length >= 2 && n.indexOf(kz) >= 0) || (ke.length >= 3 && n.indexOf(ke) >= 0)) {
          var len2 = kz.length + ke.length;
          if (len2 > bestLen) { bestLen = len2; best = x; }
        }
      });
      if (best) return { dish: best, how: "contains" };
      // Fuzzy: 1-2 edits away, and less than half the query changed.
      // A 3-char query like 土豆丝 is distance 2 from 豆花 (delete 土,
      // swap 丝->花) but means something entirely different, so it must
      // NOT be offered as a match.
      var fbest = null, fdist = 99;
      D.dishes.forEach(function (x) {
        dishKeys(x).forEach(function (k) {
          var dist = levenshtein(n, k);
          if (dist <= 2 && dist * 2 < n.length && dist < fdist) { fdist = dist; fbest = x; }
        });
      });
      if (fbest) return { dish: fbest, how: "fuzzy", dist: fdist };
    }
    return { dish: null, how: "none" };
  }
  function findDish(q) {
    var r = findDishBest(q);
    return (r.how === "fuzzy" || r.how === "none") ? null : r.dish;
  }
  // One dish for the home search / quick-pick filter: name, pinyin or any
  // alias contains the query (so 西红柿炒鸡蛋 finds 番茄炒蛋 there too).
  function dishMatchesQuery(d, q) {
    var n = normStr(q);
    if (!n) return true;
    if (normStr(d.zh).indexOf(n) >= 0 || normStr(d.en).indexOf(n) >= 0 || normStr(stripParen(d.py || "")).indexOf(n) >= 0) return true;
    return (ALIAS_BY_DISH[d.id] || []).some(function (k) { return k.indexOf(n) >= 0 || n.indexOf(k) >= 0; });
  }

  function decode() {
    var q = $("dishInput").value;
    var res = $("result"), status = $("decodeStatus");
    function showStatus(t) { if (status) { status.classList.remove("hidden"); status.textContent = t; } }
    function hideStatus() { if (status) status.classList.add("hidden"); }
    hideSuggestions();
    if (!q.trim()) {
      hideStatus();
      res.className = "subcard";
      res.innerHTML = "<div class=\"verdict ask\">What are we checking?</div>" +
        "<p>Type a dish name — try Mapo Tofu, or 番茄炒蛋. Or tap a dish below, and I'll tell you in 3 seconds.</p>";
      return;
    }
    // Instant feedback: the user sees work happening, never a dead tap.
    showStatus("Looking it up…");
    var best = findDishBest(q);
    if (!best.dish) {
      if (q.trim()) {
        state.unknown.push({ q: q.trim(), at: new Date().toISOString() });
        save();
      }
      hideStatus();
      renderNoMatch(q);
      return;
    }
    if (best.how === "fuzzy") {
      hideStatus();
      renderDidYouMean(q, best.dish);
      return;
    }
    hideStatus();
    deliverDish(best.dish);
  }
  // Paywall gate + counting, shared by decode(), Did-you-mean and
  // suggestion taps — one place, so a tap never skips the free-count rule.
  function deliverDish(dish) {
    // PAYWALL：DEV_MODE 下 remaining() 为 Infinity，此分支永不触发；
    // DEV_MODE=false 时恢复：免费次数用完 → 挡住，去看广告或买 Kit。
    if (remaining() <= 0 && !paidPreview) {
      $("result").className = "subcard";
      $("result").innerHTML = "<div class=\"verdict ask\">That's your free checks for today</div>" +
        "<p>Watch a 5-second ad and I'll give you 3 more.</p>" +
        "<p>Or grab the Kit — $6.99, 90 days, unlimited.</p>" +
        '<button type="button" onclick="document.getElementById(\'adSection\').scrollIntoView()">Watch ad · +3</button>';
      return;
    }
    // PAYWALL：DEV_MODE 下 paidPreview=true，不扣次数；
    // DEV_MODE=false 且免费时才扣 1 次。
    if (!paidPreview) { state.used++; save(); }
    renderResult(dish);
  }
  // Fuzzy hit (1-2 edits): never auto-decode — show the guess and let the
  // user confirm with one tap. A wrong auto-verdict could hurt someone
  // with an allergy; a confirmation tap costs nothing.
  function renderDidYouMean(q, dish) {
    var res = $("result");
    res.className = "subcard";
    res.innerHTML = "<div class=\"verdict ask\">Did you mean " + esc(dish.en) + " (" + esc(dish.zh) + ")?</div>" +
      "<p>You typed “" + esc(q.trim()) + "” — the closest match on my list is this one.</p>" +
      '<p><button type="button" class="big" id="dymYesBtn">Yes — check this dish</button></p>' +
      '<p><button type="button" class="ghost" id="dymNoBtn">No — show me similar dishes</button></p>';
    $("dymYesBtn").onclick = function () { deliverDish(dish); };
    $("dymNoBtn").onclick = function () { renderNoMatch(q); };
  }
  // No match at all: never a dead end. Closest dishes to tap, Bun (LLM)
  // as the fallback, the full 110 list, and one honest tip.
  function renderNoMatch(q) {
    var res = $("result");
    var cands = suggestDishes(q, 3);
    var html = "<div class=\"verdict ask\">Hmm, not on my list yet</div>" +
      "<p>I know " + D.dishes.length + " dishes — and “" + esc(q.trim()) + "” isn't one of them. Yet.</p>" +
      "<p>I saved it on your phone, and we'll add it.</p>";
    if (cands.length) {
      html += "<p><b>Did you mean…</b></p><p>";
      cands.forEach(function (d) {
        html += '<button type="button" class="chip" data-cand="' + esc(d.id) + '">' + esc(d.en) + " (" + esc(d.zh) + ")</button> ";
      });
      html += "</p>";
    } else {
      html += "<p>Try another name for it — 番茄 is also 西红柿, 馄饨 is also 抄手. Or snap the menu photo and I'll read it.</p>";
    }
    html += '<p><button type="button" class="big" id="askBunBtn2">Ask Bun — he\'ll check with AI</button></p>' +
      '<p><button type="button" class="ghost" id="browseAllBtn">Browse all 110 dishes</button></p>';
    res.className = "subcard";
    res.innerHTML = html;
    Array.prototype.forEach.call(res.querySelectorAll("[data-cand]"), function (b) {
      b.onclick = function () {
        var d = dishByIdLocal(b.getAttribute("data-cand"));
        if (d) { $("dishInput").value = d.zh; deliverDish(d); }
      };
    });
    $("askBunBtn2").onclick = function () { askBunAbout(q); };
    $("browseAllBtn").onclick = function () {
      var p = $("dishPicker");
      if (p) { p.open = true; p.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
  }
  // "Ask Bun" from the decoder: open the chat, pre-fill the question and
  // send it — the chat tries the LLM first (sendToAssistant in chat.js)
  // and falls back to the local bot. No second LLM client is written here.
  function askBunAbout(q) {
    showView("chat");
    var inp = $("chatInput"), btn = $("chatSendBtn");
    if (inp && btn) {
      inp.value = "Can I eat " + q.trim() + "?";
      btn.click();
    }
  }
  $("decodeBtn").onclick = decode;
  $("dishInput").addEventListener("keydown", function (e) { if (e.key === "Enter") decode(); });
  // Live suggestions while typing: up to 3 dishes, tap one to check it.
  // Debounced so typing stays smooth; hidden on empty input and on decode.
  var suggestTimer = null;
  function hideSuggestions() {
    var s = $("decodeSuggest");
    if (s) { s.innerHTML = ""; s.classList.add("hidden"); }
  }
  function showSuggestions() {
    var q = $("dishInput").value;
    var box = $("decodeSuggest");
    if (!box) return;
    if (!q.trim()) { hideSuggestions(); return; }
    var list = suggestDishes(q, 3);
    if (!list.length) { hideSuggestions(); return; }
    box.classList.remove("hidden");
    box.innerHTML = "";
    list.forEach(function (d) {
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button";
      b.textContent = d.en + " (" + d.zh + ")";
      b.onclick = function () { $("dishInput").value = d.zh; hideSuggestions(); decode(); };
      box.appendChild(b);
    });
  }
  $("dishInput").addEventListener("input", function () {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(showSuggestions, 150);
  });
  $("dishInput").addEventListener("blur", function () {
    // Let the tap on a suggestion land before the list disappears.
    setTimeout(hideSuggestions, 200);
  });
  // "Type" is one of the three ways in — it just focuses the input.
  var typeBtn = $("typeBtn");
  if (typeBtn) typeBtn.onclick = function () { $("dishInput").focus(); };

  // Quick-pick dish list (110) — Uber Eats-style rows, English first.
  // Re-rendered by the top search bar and the category chips (v3.2).
  // ---- v5.1: Signature = every city's 3 must-eats (10 cities x 3 = 30
  // slots, 27 unique dishes; changfen, liangfen and douhua appear in two
  // cities each). Derived from D.cities so the list can never drift from
  // the city data. "signature" category = the 27 unique ids.
  var SIGNATURE_IDS = [];
  (D.cities || []).forEach(function (c) {
    (c.mustEat || []).forEach(function (m) {
      if (SIGNATURE_IDS.indexOf(m.id) < 0) SIGNATURE_IDS.push(m.id);
    });
  });
  // Dish photos that actually exist (9 files). chat.js keeps the same map
  // for its dish cards — keep both in sync. Filenames are pinyin-based,
  // NOT id-based: mapo-tofu -> dish-mapodoufu.webp, huiguo-pork ->
  // dish-huiguorou.webp (the old id-derived filename built 404s for both).
  // Anything not in this map gets a no-photo tile (first Chinese
  // character) — never another dish's photo.
  var DISH_IMG = {
    "dandan-mian": "assets/dish-dandanmian.webp", "mapo-tofu": "assets/dish-mapodoufu.webp",
    "huiguo-pork": "assets/dish-huiguorou.webp", "shao-e": "assets/dish-shaoe.webp",
    "xiajiao": "assets/dish-xiajiao.webp", "changfen": "assets/dish-changfen.webp",
    "shengjian-bao": "assets/dish-shengjianbao.webp", "xiefen-xiaolong": "assets/dish-xiefenxiaolong.webp",
    "hongshao-rou": "assets/dish-hongshaorou.webp"
  };
  var HALAL_IDS = ["lanzhou", "yangrou-chuan", "kao-baozi", "shouzhuafan", "halal-beef-noodles", "yangrou-tang", "ziran-yangrou", "nang", "dapanji", "yangrou-paomo"];
  var MEAT_FLAGS = ["pork", "beef", "chicken", "duck", "fish", "shrimp", "frog", "goose", "lamb"];
  function dishInCat(d, cat) {
    if (cat === "all") return true;
    if (cat === "signature") return SIGNATURE_IDS.indexOf(d.id) >= 0;
    if (cat === "noodles") return /noodle/i.test(d.en) || /[面线粉]/.test(d.zh);
    if (cat === "dumplings") return /dumpling|bun/i.test(d.en) || ["jiaozi", "xiaolongbao", "xiajiao", "chashao-bao", "shengjian-bao", "liusha-bao", "zhongshuijiao", "guotie", "kao-baozi"].indexOf(d.id) >= 0;
    if (cat === "spicy") return d.spicy >= 2;
    if (cat === "veg") return !(d.flags || []).some(function (f) { return MEAT_FLAGS.indexOf(f) >= 0; });
    if (cat === "halal") return HALAL_IDS.indexOf(d.id) >= 0 || /清真/.test(d.note || "") || /清真/.test(d.hidden || "");
    if (cat === "soup") return /soup/i.test(d.en);
    if (cat === "rice") return /rice/i.test(d.en);
    return true;
  }
  var currentCat = "all";
  var listEl = $("dishList");
  function renderDishList(cat, q, targetEl) {
    currentCat = cat || "all";
    q = (q || "").trim().toLowerCase();
    var el = targetEl || listEl;
    el.innerHTML = "";
    var shown = 0;
    D.dishes.forEach(function (d) {
      if (!dishInCat(d, currentCat)) return;
      if (q && !dishMatchesQuery(d, q)) return;
      shown++;
      var b = document.createElement("button");
      b.className = "dish"; b.type = "button";
      b.innerHTML = '<span class="en">' + esc(d.en) + '</span><br><span class="zh">' + esc(d.zh) + " · ¥" + d.price + " · ≈$" + usd(d.price) + " · Spice " + d.spicy + "/3</span>";
      // Same verdict path as the chat: checkDish -> decode -> renderResult.
      b.onclick = function () { window.checkDish(d.zh); };
      el.appendChild(b);
    });
    if (!shown) el.innerHTML = "<p class=\"muted\">Nothing matches that — try All, or just say it out loud.</p>";
    return shown;
  }
  renderDishList("all", "");

  // ---- v5.0: Home — Signature big-image cards + 10-city entry ----
  // v5.1: all 10 cities x 3 must-eats = 30 cards, grouped by city, with
  // city filter chips (All + 10 cities) on top. Photo if one exists in
  // DISH_IMG, otherwise a no-photo tile — never a wrong dish's photo.
  function renderHomeSignature() {
    var wrap = $("homeSignatureList");
    if (!wrap) return;
    var chipsWrap = $("sigCityChips");
    var groups = [];
    (D.cities || []).forEach(function (c) {
      var ds = (c.mustEat || []).map(function (m) {
        return D.dishes.find(function (x) { return x.id === m.id; });
      }).filter(Boolean);
      if (ds.length) groups.push({ city: c, dishes: ds });
    });
    function sigCard(d) {
      var b = document.createElement("button");
      b.className = "story"; b.type = "button";
      var img = DISH_IMG[d.id];
      var thumb = img
        ? '<span class="thumb"><img src="' + img + '" alt="' + esc(d.en) + '" width="120" height="120" loading="lazy"></span>'
        : '<span class="thumb thumb-ph" aria-hidden="true"><span class="ph-zh">' + esc((d.zh || "?").charAt(0)) + '</span></span>';
      b.innerHTML = thumb + '<span><span class="en">' + esc(d.en) + '</span><span class="zh">' + esc(d.zh) + '</span><span class="price">¥' + d.price + ' · ≈$' + usd(d.price) + '</span><span class="spice">Spicy ' + d.spicy + '/3</span></span>';
      // Same verdict path as everywhere else: checkDish -> decode -> renderResult.
      b.onclick = function () { window.checkDish(d.zh); };
      return b;
    }
    function renderGroups(filterId) {
      wrap.innerHTML = "";
      groups.forEach(function (g) {
        if (filterId && filterId !== "all" && g.city.id !== filterId) return;
        var h = document.createElement("p");
        h.className = "story-city sig-city";
        h.textContent = g.city.en + " · " + g.city.zh;
        wrap.appendChild(h);
        var grid = document.createElement("div");
        grid.className = "story-grid";
        g.dishes.forEach(function (d) { grid.appendChild(sigCard(d)); });
        wrap.appendChild(grid);
      });
    }
    if (chipsWrap) {
      var opts = [{ id: "all", en: "All cities" }].concat((D.cities || []).map(function (c) { return { id: c.id, en: c.en }; }));
      opts.forEach(function (c) {
        var b = document.createElement("button");
        b.className = "chip"; b.type = "button"; b.textContent = c.en;
        b.setAttribute("aria-pressed", c.id === "all" ? "true" : "false");
        b.onclick = function () {
          Array.prototype.forEach.call(chipsWrap.children, function (x) { x.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
          renderGroups(c.id);
        };
        chipsWrap.appendChild(b);
      });
    }
    renderGroups("all");
  }
  renderHomeSignature();
  function renderHomeCities() {
    var wrap = $("homeCityRow");
    if (!wrap) return;
    D.cities.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button";
      b.textContent = c.en + " · " + (c.mustEat || []).length + " must-eats";
      b.setAttribute("aria-pressed", "false");
      b.onclick = function () { gotoSection("citiesSection"); };
      wrap.appendChild(b);
    });
  }
  renderHomeCities();

  // ---- Top search bar + category chips (v3.2, Uber Eats-style; v5.0: they
  // filter the Home results list in place — the browse blocks hide while
  // a filter is active, and come back when it is cleared.) ----
  var CATS = [["all", "All"], ["signature", "Signature"], ["noodles", "Noodles"], ["dumplings", "Dumplings"], ["spicy", "Spicy"], ["veg", "Veg"], ["halal", "Halal"], ["soup", "Soup"], ["rice", "Rice"]];
  var chipsEl = $("catChips");
  var homeResults = $("homeResults");
  var homeDishList = $("homeDishList");
  function updateHomeFilter() {
    var q = ($("topSearch") || { value: "" }).value.trim();
    var active = q !== "" || currentCat !== "all";
    var hv = $("homeView");
    if (hv) hv.classList.toggle("filtering", active);
    if (homeResults) homeResults.classList.toggle("hidden", !active);
    if (active && homeDishList) {
      var n = renderDishList(currentCat, q, homeDishList);
      var t = $("homeResultsTitle");
      if (t) t.textContent = n + (n === 1 ? " match" : " matches");
    }
    return active;
  }
  if (chipsEl) {
    CATS.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = c[1];
      b.setAttribute("aria-pressed", c[0] === "all" ? "true" : "false");
      b.onclick = function () {
        Array.prototype.forEach.call(chipsEl.children, function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        if (c[0] === "signature") {
          // Signature lives as big cards on Home — clear the filter and
          // scroll to them instead of filtering the quick list.
          currentCat = "all";
          if ($("topSearch")) $("topSearch").value = "";
          updateHomeFilter();
          var hs = $("homeSignature");
          // v5.2: Signature is a <details> now — open it before scrolling,
          // or the user lands on a closed header.
          if (hs) { if (hs.tagName === "DETAILS") hs.open = true; hs.scrollIntoView({ behavior: "smooth", block: "start" }); }
          return;
        }
        currentCat = c[0];
        updateHomeFilter();
        if (homeResults) homeResults.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      chipsEl.appendChild(b);
    });
  }
  var topSearch = $("topSearch");
  if (topSearch) {
    topSearch.addEventListener("input", function () { updateHomeFilter(); });
    topSearch.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var d = findDish(topSearch.value);
      if (d) window.checkDish(d.zh);
    });
  }

  // ---- Order list + slip (B route) ----
  function addToOrder(dish) {
    var item = state.order.find(function (x) { return x.id === dish.id; });
    if (item) item.qty++; else state.order.push({ id: dish.id, qty: 1 });
    save(); renderOrder();
    alert("Got it — " + dish.en + " is on your list.");
  }
  function renderOrder() {
    var el = $("orderList");
    if (!state.order.length) {
      el.innerHTML = "<p class=\"muted\">Nothing here yet — check a dish first, then add it.</p><p><button type=\"button\" id=\"orderEmptyGo\">Decode a dish</button></p>";
      var go = $("orderEmptyGo");
      if (go) go.onclick = function () { showView("search"); };
    } else {
      var total = 0;
      el.innerHTML = state.order.map(function (x) {
        var d = D.dishes.find(function (dd) { return dd.id === x.id; });
        total += d.price * x.qty;
        return "<p>• " + esc(d.en) + " (" + esc(d.zh) + ") × " + x.qty + " — ¥" + (d.price * x.qty) + "</p>";
      }).join("") + "<p><b>Total: ¥" + total + " · ≈$" + usd(total) + "</b> · " + state.order.length + (state.order.length === 1 ? " dish" : " dishes") + "</p>" +
        "<p class=\"small price-note\">" + esc(PRICE_BASIS_SHORT) + " — the total is a guide, not the bill.</p>";
    }
    renderSlip();
  }
  function renderSlip() {
    var tableNo = ($("tableNo") && $("tableNo").value) || "____";
    var people = ($("peopleNo") && $("peopleNo").value) || "____";
    var pay = document.querySelector('input[name="payMethod"]:checked');
    var payText = pay ? pay.value : "支付宝 / 现金在柜台付款";
    var lines = state.order.map(function (x, i) {
      var d = D.dishes.find(function (dd) { return dd.id === x.id; });
      return (i + 1) + ". " + d.zh + " ×" + x.qty;
    });
    var slipTotal = state.order.reduce(function (s, x) {
      var d = D.dishes.find(function (dd) { return dd.id === x.id; });
      return s + (d ? d.price * x.qty : 0);
    }, 0);
    $("slipPreview").innerHTML =
      "<p class=\"bigzh\">您好，请帮我用你们的手机下单，谢谢！</p>" +
      "<p class=\"bigzh\">桌号：" + esc(tableNo) + " &nbsp; 人数：" + esc(people) + "</p>" +
      (lines.length ? "<p class=\"bigzh\">" + esc(lines.join("<br>")) + "</p><p class=\"bigzh\">总计：" + slipTotal + "元。</p>" : "<p class=\"muted\">(Add dishes to your list in the decoder first.)</p>") +
      "<p class=\"bigzh\">我用" + esc(payText) + "。</p>";
  }
  ["tableNo", "peopleNo"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("input", renderSlip); });
  document.querySelectorAll('input[name="payMethod"]').forEach(function (r) { r.addEventListener("change", renderSlip); });
  $("showSlipBtn").onclick = function () { renderSlip(); $("slipOverlay").classList.remove("hidden"); };
  $("closeSlipBtn").onclick = function () { $("slipOverlay").classList.add("hidden"); };
  $("clearOrderBtn").onclick = function () { state.order = []; save(); renderOrder(); };
  $("shareOrderBtn").onclick = function () {
    var text = "My China order list:\n" + state.order.map(function (x) {
      var d = D.dishes.find(function (dd) { return dd.id === x.id; });
      return "- " + d.en + " (" + d.zh + ") ×" + x.qty;
    }).join("\n") + "\nMade with China Bite: " + location.origin + location.pathname + "?ref=" + state.myRef;
    shareText("My China Bite order list", text);
  };
  renderOrder();

  // ---- QR route A table ----
  $("qrTable").innerHTML = "<table><tr><th>Chinese</th><th>English</th><th>What it means</th></tr>" +
    D.qrButtons.map(function (b) { return "<tr><td><b>" + esc(b.zh) + "</b></td><td>" + esc(b.en) + "</td><td>" + esc(b.note) + "</td></tr>"; }).join("") + "</table>";

  // ---- Orders tabs: Dine-in / Delivery (v5.2) ----
  // Delivery is a guide only — ordering happens in Meituan / Ele.me,
  // not here. All copy comes from the FAQ + hotel card (no invented
  // restaurants, addresses, phone numbers, prices, or wait times).
  function setOrderTab(which) {
    var dine = $("tabDineIn"), del = $("tabDelivery"), dp = $("dineInPanel"), vp = $("deliveryPanel");
    if (!dine || !del || !dp || !vp) return;
    var isDel = which === "delivery";
    dine.setAttribute("aria-selected", isDel ? "false" : "true");
    del.setAttribute("aria-selected", isDel ? "true" : "false");
    dp.classList.toggle("hidden", isDel);
    vp.classList.toggle("hidden", !isDel);
  }
  if ($("tabDineIn")) $("tabDineIn").onclick = function () { setOrderTab("dinein"); };
  if ($("tabDelivery")) $("tabDelivery").onclick = function () { setOrderTab("delivery"); };
  if ($("deliveryMeituanBtn")) $("deliveryMeituanBtn").onclick = function () {
    var note = $("deliveryDishNote");
    if (lastDish) {
      if (note) note.textContent = "Opening Meituan Waimai search for “" + lastDish.zh + "” — if the app isn't installed you'll land on the web search instead.";
      openDeepLink(MEITUAN_LINKS.waimaiScheme(lastDish.zh), MEITUAN_LINKS.waimaiH5(lastDish.zh));
    } else {
      if (note) note.textContent = "Check a dish first — then this button searches it directly. Opening Meituan Waimai home for now.";
      openDeepLink(MEITUAN_LINKS.waimaiSchemeHome, MEITUAN_LINKS.waimaiH5Home);
    }
  };
  if ($("deliveryDianpingBtn")) $("deliveryDianpingBtn").onclick = function () {
    var note = $("deliveryDishNote");
    if (lastDish) {
      if (note) note.textContent = "Opening Dianping search for “" + lastDish.zh + "” — reviews and group deals, in the app or on the web.";
      openDeepLink(MEITUAN_LINKS.dianpingScheme(lastDish.zh), MEITUAN_LINKS.dianpingH5);
    } else {
      if (note) note.textContent = "Check a dish first — then this button searches it directly. Opening Dianping home for now.";
      openDeepLink(MEITUAN_LINKS.dianpingSchemeHome, MEITUAN_LINKS.dianpingH5);
    }
  };
  if ($("deliveryElemeBtn")) $("deliveryElemeBtn").onclick = function () { window.open("https://www.ele.me/", "_blank"); };
  if ($("deliveryHotelBtn")) $("deliveryHotelBtn").onclick = function () { gotoSection("meituanSection"); };

  // ---- Payment checklist ----
  var checks = [
    ["c1", "WeChat / Alipay linked"],
    ["c2", "Tour Pass set up"],
    ["c3", "Cash as backup"],
    ["c4", "List saved offline"]
  ];
  var ckEl = $("payChecks");
  checks.forEach(function (c) {
    var lab = document.createElement("label");
    lab.innerHTML = '<input type="checkbox" ' + (state.checks[c[0]] ? "checked" : "") + "> " + esc(c[1]);
    lab.querySelector("input").onchange = function (e) { state.checks[c[0]] = e.target.checked; save(); };
    ckEl.appendChild(lab);
  });

  // ---- Diet cards (12) ----
  var cardsEl = $("dietCards");
  D.cards.forEach(function (c) {
    var div = document.createElement("div");
    div.className = "subcard";
    div.innerHTML = "<h3>" + esc(c.en) + " · " + esc(c.zh) + "</h3>" +
      c.lines.map(function (l) { return "<p class=\"bigzh\">" + esc(l) + "</p>"; }).join("") +
      '<button type="button" class="ghost">Show big</button> ' +
      '<button type="button" class="ghost">Share</button>';
    div.querySelectorAll("button")[0].onclick = function () {
      $("cardOverlayText").innerHTML = "<h2>" + esc(c.en) + " · " + esc(c.zh) + "</h2>" +
        c.lines.map(function (l) { return "<p class=\"bigzh\">" + esc(l) + "</p>"; }).join("");
      $("cardOverlay").classList.remove("hidden");
    };
    div.querySelectorAll("button")[1].onclick = function () {
      shareText(c.en + " card — China Bite", c.lines.join("\n") + "\nMade with China Bite: " + location.origin + location.pathname + "?ref=" + state.myRef);
    };
    cardsEl.appendChild(div);
  });
  $("closeCardBtn").onclick = function () { $("cardOverlay").classList.add("hidden"); };

  // ---- Cities (10 cities; sample only, address not verified) ----
  var cityEl = $("cityList");
  if (cityEl && D.cities) {
    var dishById = {};
    (D.dishes || []).forEach(function (d) { dishById[d.id] = d; });
    D.cities.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "subcard";
      var cityImg = { xian: "assets/city-xian.webp", chongqing: "assets/city-chongqing.webp", guilin: "assets/city-guilin.webp" }[c.id];
      var html = "<h3>" + esc(c.en) + " · " + esc(c.zh) + "</h3>" +
        (cityImg ? "<img class=\"city-img\" src=\"" + cityImg + "\" alt=\"" + esc(c.en) + " street scene\" width=\"491\" height=\"327\" loading=\"lazy\">" : "") +
        "<p>" + esc(c.scene) + "</p>" +
        "<p><b>3 must-eat dishes</b></p>" +
        (c.mustEat || []).map(function (m) {
          var d = dishById[m.id];
          if (!d) return "";
          return "<p><button type=\"button\" onclick=\"checkDish('" + esc(d.zh) + "')\">" + esc(d.en) + " (" + esc(d.zh) + ")</button><br><span class=\"small\">" + esc(m.note) + "</span></p>";
        }).join("") +
        "<p><b>Watch out:</b> " + esc(c.tip) + "</p>" +
        "<p><b>Getting there:</b> " + esc(c.transport) + "</p>" +
        c.places.map(function (p) { return "<p>• " + esc(p.name) + " — " + esc(p.type) + " · " + esc(p.area) + " · " + esc(p.note) + "<br><span class=\"small\">Dianping: search the shop name to see its score. No score copied here.</span></p>"; }).join("");
      div.innerHTML = html;
      cityEl.appendChild(div);
    });
  }

  // ---- Share helpers ----
  function dishUrl(dish) {
    return location.origin + location.pathname + "?ref=" + state.myRef + "#/dish/" + dish.id;
  }
  function setMeta(name, content) {
    var el = document.querySelector('meta[name="' + name + '"]') ||
             document.querySelector('meta[property="' + name + '"]');
    if (el) el.setAttribute("content", content);
  }
  // Per-dish SEO: title + meta follow the verdict (share / search preview).
  function updateDishMeta(dish, v) {
    var t = dish.en + " — " + v.t + " | China Bite";
    document.title = t;
    var d = dish.en + " (" + dish.zh + "): " + v.t + ". " + v.why +
      " Price ¥" + dish.price + " (≈$" + usd(dish.price) + ").";
    setMeta("description", d);
    setMeta("og:title", t);
    setMeta("og:description", d);
    setMeta("twitter:title", t);
    setMeta("twitter:description", d);
  }
  function shareText(title, text) {
    if (navigator.share) { navigator.share({ title: title, text: text }).catch(function () {}); }
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert("Copied. Paste into WeChat."); });
    } else { alert(text); }
  }
  window.shareText = shareText;
  function shareDish(dish, v) {
    var text = "I checked “" + dish.zh + " " + dish.en + "” in China: " + v.t + ". " + v.why +
      " Price ¥" + dish.price + " (≈$" + usd(dish.price) + "). Check any Chinese dish in 10 seconds: " +
      dishUrl(dish) + " #ChinaBite";
    shareText("China Bite — " + dish.en, text);
  }

  // ---- Deep links: #/dish/<id> and #/diet/<id> ----
  // Shared dish link opens the verdict directly, no charge (read-only view).
  (function deepLink() {
    var m = (location.hash || "").match(/^#\/dish\/([a-z0-9-]+)/);
    if (m) {
      var dish = D.dishes.find(function (d) { return d.id === m[1]; });
      if (dish) {
        $("dishInput").value = dish.zh;
        renderResult(dish);
        var sec = $("decoder");
        if (sec) sec.scrollIntoView();
        return;
      }
    }
    var dm = (location.hash || "").match(/^#\/diet\/([a-z0-9-]+)/);
    if (dm) {
      var card = D.cards.find(function (c) { return c.id === dm[1]; });
      if (card) {
        var sec2 = $("dietSection");
        if (sec2) { sec2.open = true; sec2.scrollIntoView(); }
        $("cardOverlayText").innerHTML = "<h2>" + esc(card.en) + " · " + esc(card.zh) + "</h2>" +
          card.lines.map(function (l) { return "<p class=\"bigzh\">" + esc(l) + "</p>"; }).join("");
        $("cardOverlay").classList.remove("hidden");
      }
    }

})();

  // ---- Hotel address card (delivery) — saved on this device only ----
  (function hotelCard() {
    var nameEl = $("hotelName"), roomEl = $("hotelRoom"), btn = $("copyHotelBtn");
    if (!nameEl || !roomEl || !btn) return;
    try {
      // 迁移：先读新 key，没有则读一次旧名 key，读到就用新 key 存回去
      var h = JSON.parse(localStorage.getItem("chinabite_hotel_v1") || localStorage.getItem("eatchina_hotel_v1") || "{}");
      if (h.name) nameEl.value = h.name;
      if (h.room) roomEl.value = h.room;
    } catch (e) {}
    function saveHotel() {
      try { localStorage.setItem("chinabite_hotel_v1", JSON.stringify({ name: nameEl.value, room: roomEl.value })); localStorage.removeItem("eatchina_hotel_v1"); } catch (e) {}
    }
    nameEl.addEventListener("input", saveHotel);
    roomEl.addEventListener("input", saveHotel);
    btn.onclick = function () {
      var text = "酒店：" + (nameEl.value || "____") + " 房号：" + (roomEl.value || "____") +
        "\n您好，我是外国人，请放在前台，不要打电话，发信息即可。谢谢！";
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { alert("Hotel card copied."); });
      else alert(text);
    };
  })();

  // ---- Referral ----
  $("myRef").textContent = state.myRef;
  $("refLink").textContent = location.origin + location.pathname + "?ref=" + state.myRef;
  $("refNote").textContent = referred
    ? "Friend's link: 6 free today."
    : "Share yours. Friend gets 6 free.";
  $("copyRefBtn").onclick = function () {
    var link = location.origin + location.pathname + "?ref=" + state.myRef;
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { alert("Link copied."); });
  };
  // PLACEHOLDER — no server, invites not verified.
  $("inviteCount").textContent = "0 (placeholder)";


  // ---- Voice input (v3.4, DEV_MODE: on) ----
  // Web Speech API. en-US first, tap "Voice: English" to switch to zh-CN.
  // iOS Safari has no SpeechRecognition: we say so honestly instead of
  // failing silently. Native voice is an App-stage feature.
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var voiceLang = "en-US";
  function speakInto(inputEl, statusEl, after) {
    if (!SR) {
      if (statusEl) statusEl.textContent = "Voice typing doesn't work in this browser yet — iOS Safari doesn't offer it. Type the name instead, or wait for the App, where voice is built in.";
      return;
    }
    var rec = new SR();
    rec.lang = voiceLang; rec.interimResults = false; rec.maxAlternatives = 3;
    if (statusEl) statusEl.textContent = "Listening… say the dish name.";
    rec.onresult = function (e) {
      var said = e.results[0][0].transcript || "";
      if (inputEl) inputEl.value = said;
      if (statusEl) statusEl.textContent = 'Heard: "' + said + '"';
      if (after) after(said);
    };
    rec.onerror = function (e) {
      if (statusEl) statusEl.textContent = "Hmm, I didn't catch that (" + (e.error || "error") + "). Say it once more — or just type it.";
    };
    try { rec.start(); } catch (err) {
      if (statusEl) statusEl.textContent = "Voice couldn't start here. Type the name instead — it takes 3 seconds.";
    }
  }
  var voiceBtn = $("voiceBtn"), voiceLangBtn = $("voiceLangBtn");
  if (voiceLangBtn) {
    voiceLangBtn.onclick = function () {
      voiceLang = voiceLang === "en-US" ? "zh-CN" : "en-US";
      voiceLangBtn.textContent = voiceLang === "en-US" ? "Voice: English" : "Voice: Chinese";
    };
  }
  if (voiceBtn) {
    voiceBtn.onclick = function () {
      speakInto($("dishInput"), $("voiceStatus"), function () { decode(); });
    };
  }
  // Hotel card voice: hotel name in Chinese, room number in Chinese.
  function hotelVoice(targetId) {
    var saved = voiceLang; voiceLang = "zh-CN";
    speakInto($(targetId), $("hotelVoiceStatus"), null);
    voiceLang = saved;
  }
  var hnBtn = $("hotelNameVoiceBtn");
  if (hnBtn) hnBtn.onclick = function () { hotelVoice("hotelName"); };
  var hrBtn = $("hotelRoomVoiceBtn");
  if (hrBtn) hrBtn.onclick = function () { hotelVoice("hotelRoom"); };

  // ---- Camera: photo + OCR (v3.4, DEV_MODE: on) ----
  // Photo stays on this device, never uploaded. OCR runs in the browser
  // via Tesseract.js (CDN, lazy-loaded on first photo). If the library
  // can't load here (offline / CDN blocked), we say so honestly and fall
  // back to the 110-dish quick pick — we never pretend OCR worked.
  // Low confidence (< 60) or no dish matched: "didn't recognise, tap one
  // below" — never guess. Native OCR is still the App-stage feature.
  var OCR_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  var ocrLoading = null;
  function loadOCR() {
    if (window.Tesseract) return Promise.resolve(true);
    if (ocrLoading) return ocrLoading;
    ocrLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = OCR_URL; s.async = true;
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      s.onload = function () { finish(!!window.Tesseract); };
      s.onerror = function () { finish(false); };
      setTimeout(function () { finish(!!window.Tesseract); }, 15000);
      document.head.appendChild(s);
    });
    return ocrLoading;
  }
  function matchOcrText(text) {
    if (!text) return null;
    var lines = text.split(/[\n\r,，。、；;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var best = null;
    lines.forEach(function (line) {
      var d = findDish(line);
      if (d && !best) best = d;
      if (!d) {
        var words = line.split(/\s+/);
        words.forEach(function (w) {
          if (w.length >= 2 && !best) { var dd = findDish(w); if (dd) best = dd; }
        });
      }
    });
    return best;
  }
  var cameraBtn = $("cameraBtn"), photoInput = $("photoInput");
  if (cameraBtn && photoInput) {
    cameraBtn.onclick = function () { photoInput.click(); };
    photoInput.addEventListener("change", function () {
      var f = photoInput.files && photoInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var prev = $("photoPreview"), st = $("photoStatus");
        if (prev) {
          prev.classList.remove("hidden");
          prev.innerHTML = '<img src="' + reader.result + '" alt="Menu photo" style="width:100%;border-radius:20px;display:block">';
        }
        var picker = $("dishPicker");
        if (picker) picker.open = true;
        if (!st) return;
        st.classList.remove("hidden");
        st.textContent = "Photo saved on this device — not uploaded. Reading the menu…";
        loadOCR().then(function (ok) {
          if (!ok || !window.Tesseract) {
            st.textContent = "Photo's saved on your phone — I didn't upload it. I couldn't load the menu reader here (it needs network). Tap any dish below and I'll tell you in 3 seconds — or type the name.";
            return;
          }
          return window.Tesseract.recognize(reader.result, "eng+chi_sim", {
            logger: function () {}
          }).then(function (res) {
            var conf = res && res.data ? res.data.confidence : 0;
            var dish = matchOcrText(res && res.data ? res.data.text : "");
            if (dish && conf >= 60) {
              st.textContent = 'I think this is "' + dish.en + '" — checking it for you now.';
              $("dishInput").value = dish.zh;
              decode();
            } else {
              st.textContent = "Hmm, I couldn't quite read that photo (confidence " + Math.round(conf) + "). Tap a dish below and I'll tell you in 3 seconds — no guessing.";
            }
          }).catch(function () {
            st.textContent = "That photo didn't read well. Tap any dish below and I'll tell you in 3 seconds.";
          });
        });
      };
      reader.readAsDataURL(f);
    });
  }

  // ---- Counts ----
  function updateCounts() {
    // PAYWALL：DEV_MODE 下显示无限，不显示剩余次数/广告进度。
    if (DEV_MODE) {
      $("countText").textContent = "Dev mode · unlimited checks ∞ · everything unlocked";
      $("countBar").style.width = "100%";
      return;
    }
    $("countText").textContent = "Left today: " + remaining() + " of " + (baseFree + state.bonus) +
      (paidPreview ? " — Paid: unlimited, no ads" : "") +
      " · Ads: " + state.adsToday + "/" + PAYWALL.maxAdsPerDay;
    var pct = Math.min(100, Math.round(remaining() / Math.max(1, baseFree + state.bonus) * 100));
    $("countBar").style.width = pct + "%";
  }
  updateCounts();

  // ---- Rewarded ad (DEMO ONLY — no real AdMob / AdSense) ----
  // PAYWALL：DEV_MODE 下广告不挡路（广告区已隐藏）；此函数直接返回，不计时、不加次数。
  var adTimer = null;
  $("watchAdBtn").onclick = function () {
    if (DEV_MODE) return;
    if (state.adsToday >= PAYWALL.maxAdsPerDay) { alert("Ad limit: 5/day. Back tomorrow."); return; }
    var n = 5;
    $("adOverlay").classList.remove("hidden");
    $("adCount").textContent = n;
    $("adSkip").classList.add("hidden");
    adTimer = setInterval(function () {
      n--;
      if (n <= 0) {
        clearInterval(adTimer);
        $("adCount").textContent = "Done";
        $("adSkip").classList.remove("hidden");
        $("adSkip").textContent = "Back (+3 decodes)";
      } else { $("adCount").textContent = n; }
    }, 1000);
  };
  $("adSkip").onclick = function () {
    clearInterval(adTimer);
    $("adOverlay").classList.add("hidden");
    state.bonus += PAYWALL.adBonusPerWatch; state.adsToday++; save(); updateCounts();
    alert("+" + PAYWALL.adBonusPerWatch + " decodes. Bonus today: +" + state.bonus + ".");
  };
  $("closeAdBtn").onclick = function () { clearInterval(adTimer); $("adOverlay").classList.add("hidden"); };

  // ---- Subscribe ----
  // 订阅接口在 Dashboard Worker 的 /api/subscribe（见 subscribe.js）。
  // API 域名用 bite-api.chinavisacheck.com（Worker 自定义域名路由）：
  // workers.dev 生产域名 2026-11-26 14:38 起全站报 404 error code 1042，
  // 脚本本身正常（版本预览 URL 200），是生产路由故障，改走自定义域名绕过。
  var SUBSCRIBE_API = "https://bite-api.chinavisacheck.com/api/subscribe";
  var SUBSCRIBE_COPY = {
    en: { title: "New dishes first.", line: "One email when we add dishes. Nothing else.", btn: "Subscribe", privacy: "Only China Bite updates. No marketing. Unsubscribe anytime.", done: "You're in.", doneLine: "New dishes, in your inbox. First.", already: "Already subscribed.", bad: "That email doesn't look right.", pending: "Not live yet. Saved on this device." },
    zh: { title: "新菜先知道。", line: "加了新菜才发一封。别的没有。", btn: "订阅", privacy: "只收 China Bite 更新。不发营销。可随时退订。", done: "订好了。", doneLine: "有新菜，第一时间发你邮箱。", already: "已经订过了。", bad: "邮箱格式不对，再看一眼。", pending: "还没接通，先存在本机了。" },
    ja: { title: "新メニューを先に。", line: "新しい料理が増えたときだけ送ります。", btn: "登録する", privacy: "China Bite の更新のみ。広告なし。いつでも解除できます。", done: "登録完了。", doneLine: "新メニュー情報をお届けします。", already: "登録済みです。", bad: "メールアドレスを確認してください。", pending: "まだ接続されていません。この端末に保存しました。" },
    ko: { title: "새 메뉴를 먼저.", line: "새 요리가 추가될 때만 메일을 보냅니다.", btn: "구독하기", privacy: "China Bite 소식만 받습니다. 광고 없음. 언제든 해지 가능.", done: "구독 완료.", doneLine: "새 메뉴 소식을 가장 먼저 보내드립니다.", already: "이미 구독 중입니다.", bad: "이메일 형식을 확인해 주세요.", pending: "아직 연결되지 않았습니다. 이 기기에 저장했습니다." },
    de: { title: "Neue Gerichte zuerst.", line: "Eine Mail, wenn neue Gerichte kommen. Sonst nichts.", btn: "Abonnieren", privacy: "Nur China Bite Updates. Kein Marketing. Jederzeit kündbar.", done: "Angemeldet.", doneLine: "Neue Gerichte zuerst in deinem Postfach.", already: "Schon angemeldet.", bad: "Diese E-Mail sieht nicht richtig aus.", pending: "Noch nicht live. Auf diesem Gerät gespeichert." },
    fr: { title: "Les nouveaux plats d'abord.", line: "Un e-mail quand on ajoute des plats. Rien d'autre.", btn: "S'abonner", privacy: "Uniquement les actus China Bite. Pas de marketing. Désinscription à tout moment.", done: "C'est noté.", doneLine: "Les nouveaux plats, d'abord dans ta boîte mail.", already: "Déjà abonné.", bad: "Cette adresse e-mail semble incorrecte.", pending: "Pas encore en ligne. Enregistré sur cet appareil." }
  };
  var subForm = $("subscribeForm"), subEmail = $("subscribeEmail"), subLang = $("subscribeLang");
  function subCopy() { return SUBSCRIBE_COPY[subLang.value] || SUBSCRIBE_COPY.en; }
  function applySubCopy() {
    var c = subCopy();
    $("subTitle").textContent = c.title;
    $("subLine").textContent = c.line;
    $("subscribeBtn").textContent = c.btn;
    $("subPrivacy").textContent = c.privacy;
  }
  function showSubMsg(text) {
    var m = $("subscribeMsg");
    m.textContent = text; m.classList.remove("hidden");
  }
  function showSubDone(c, already) {
    subForm.classList.add("hidden");
    $("subDoneTitle").textContent = already ? c.already : c.done;
    $("subDoneLine").textContent = c.doneLine;
    $("subscribeDone").classList.remove("hidden");
  }
  if (subForm && subEmail && subLang) {
    subLang.addEventListener("change", applySubCopy);
    applySubCopy();
    subForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = subCopy();
      var email = subEmail.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showSubMsg(c.bad); return; }
      $("subscribeBtn").disabled = true;
      fetch(SUBSCRIBE_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, lang: subLang.value, source: "chinabite-site" })
      }).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); }).then(function (res) {
        $("subscribeBtn").disabled = false;
        if (res.status === 201) showSubDone(c, false);
        else if (res.status === 200 && res.data && res.data.already) showSubDone(c, true);
        else showSubMsg((res.data && res.data.error) || c.bad);
      }).catch(function () {
        // Worker 未上线：不假装成功。存本机待同步队列，如实提示。
        $("subscribeBtn").disabled = false;
        try {
          var q = JSON.parse(localStorage.getItem("chinabite_subscribe_pending_v1") || "[]");
          var norm = email.toLowerCase();
          if (!q.some(function (x) { return x.email_norm === norm; })) {
            q.push({ email: email, email_norm: norm, lang: subLang.value, at: new Date().toISOString() });
            localStorage.setItem("chinabite_subscribe_pending_v1", JSON.stringify(q));
          }
        } catch (err) {}
        showSubMsg(c.pending);
      });
    });
  }

  // ---- App mode nav: views (v5.0 — homepage IS the Uber Eats browse;
  // chat is a feature behind the Bun button / Ask Bun, not the homepage) ----
  // v5.0: Home = search + chips + hero + Ask Bun + Signature + cities +
  // decode teaser. Search = the decoder (type / voice / camera / 110
  // quick-pick). Orders = QR order slip. Account = Kit on top, then
  // subscribe / share / FAQ. Views are show/hide only — all sections stay
  // in the DOM, so decode, deep links (#/dish/, #/diet/) and the order
  // slip keep working.
  var VIEW_SECTIONS = ["homeView", "chatView", "chatComposer", "decoder", "qrSection", "dietSection", "adSection", "kitPreview", "citiesSection", "meituanSection", "kitSection", "referral", "faqSection", "subscribe"];
  var VIEWS = {
    home: ["homeView"],
    chat: ["chatView", "chatComposer"],
    search: ["decoder"],
    orders: ["qrSection"],
    cities: ["citiesSection"],
    diet: ["dietSection"],
    account: ["kitPreview", "kitSection", "subscribe", "referral", "faqSection"],
    qr: ["qrSection"],
    meituan: ["meituanSection"],
    subscribe: ["subscribe"],
  };
  var SECTION_VIEW = { homeView: "home", chatView: "chat", chatComposer: "chat", decoder: "search", qrSection: "orders", dietSection: "diet", adSection: "search", kitPreview: "account", citiesSection: "cities", meituanSection: "meituan", kitSection: "account", referral: "account", faqSection: "account", subscribe: "subscribe" };
  var currentView = "chat";
  function showView(name) {
    var ids = VIEWS[name] || VIEWS.home;
    currentView = name;
    VIEW_SECTIONS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      // PAYWALL: DEV_MODE hides the ad section; never un-hide it here.
      if (id === "adSection" && DEV_MODE) { el.classList.add("hidden"); return; }
      el.classList.toggle("hidden", ids.indexOf(id) < 0);
    });
    // Account view: Kit sits at the top, already open — no extra tap.
    if (name === "account") {
      var kp = $("kitPreview"); if (kp) kp.open = true;
      var ks = $("kitSection"); if (ks) ks.open = true;
    }
    window.scrollTo(0, 0);
    document.querySelectorAll(".bottomnav a").forEach(function (x) {
      x.classList.toggle("active", x.getAttribute("data-view") === name);
    });
  }
  // Tap a nav item: switch to the view holding that section, open the card
  // if it is collapsed, then scroll to it.
  function gotoSection(id) {
    var el = $(id);
    if (!el) return;
    showView(SECTION_VIEW[id] || "chat");
    if (el.tagName === "DETAILS") el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // v4.1: open the FAQ card and one answer inside it.
  function openFaq(id) {
    gotoSection("faqSection");
    if (!id) return;
    var f = $(id);
    if (f) { f.open = true; f.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
  // Homepage order v3.0: signature dishes first, decoder last.
  // Tapping a dish anywhere (signature card, city must-eat, deep link,
  // search result) must switch to the Search view FIRST, otherwise the
  // verdict would render inside the hidden decoder and the user would
  // see nothing.
  window.checkDish = function (zh) {
    $("dishInput").value = zh;
    showView("search");
    decode();
    var sec = $("decoder");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  document.querySelectorAll("[data-goto]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      gotoSection(a.getAttribute("data-goto"));
    });
  });
  document.querySelectorAll("[data-view]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      showView(a.getAttribute("data-view"));
    });
  });
  // v5.2: keep aria-expanded in sync on every <details> summary.
  // <summary> is natively keyboard-operable (Enter/Space); the attribute
  // makes the open/closed state explicit for assistive tech.
  document.querySelectorAll("details").forEach(function (d) {
    var s = d.querySelector(":scope > summary");
    if (!s) return;
    function sync() { s.setAttribute("aria-expanded", d.open ? "true" : "false"); }
    sync();
    d.addEventListener("toggle", sync);
  });
  var appTitle = $("appTitle");
  if (appTitle) {
    var goHome = function () { showView("home"); };
    appTitle.addEventListener("click", goHome);
    appTitle.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHome(); } });
  }
  // First paint: home, unless a deep link asked for a dish or diet card.
  (function initView() {
    var h = location.hash || "";
    if (/^#\/diet\//.test(h)) showView("diet");
    else if (/^#\/dish\//.test(h)) showView("search");
    else showView("home");
  })();

  // ---- Paid preview toggle (no real payment) ----
  // PAYWALL：DEV_MODE 下强制等同已购（paidPreview=true），开关锁定在 ON，
  // 广告区保持隐藏；DEV_MODE=false 时恢复手动切换。
  $("paidToggle").onchange = function (e) {
    if (DEV_MODE) {
      paidPreview = true;
      e.target.checked = true;
      $("adSection").classList.add("hidden");
      $("paidNote").textContent = "Dev mode: all unlocked, no ads.";
      updateCounts();
      return;
    }
    paidPreview = e.target.checked;
    $("adSection").classList.toggle("hidden", paidPreview);
    $("paidNote").textContent = paidPreview
      ? "Paid preview ON: no ads. Unlimited."
      : "Free version. Demo ads on.";
    updateCounts();
  };


  // ---- Theme follows the phone (v3.4) ----
  // No toggle button, no manual override, nothing in localStorage.
  // <head> sets data-theme from prefers-color-scheme before CSS loads;
  // this listener keeps it in step if the phone switches while open.
  function syncThemeFromSystem() {
    var dark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0A0E14" : "#ffffff");
  }
  syncThemeFromSystem();
  try {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", syncThemeFromSystem);
    else if (mq.addListener) mq.addListener(syncThemeFromSystem);
  } catch (e) {}

  // ---- DEV MODE 初始化：页面标记 + 解锁展示（付费逻辑本身不动，只绕过） ----
  // 角标 #devBadge、锁文案 .paywall-lock、Kit 全开提示 #kitDevNote 都在 index.html；
  // DEV_MODE=false 时角标隐藏、锁文案恢复显示、广告区恢复显示。
  if (DEV_MODE) {
    try { document.body.classList.add("dev-mode"); } catch (e) {}
    var devBadge = $("devBadge");
    if (devBadge) devBadge.classList.remove("hidden");
    var adSec = $("adSection");
    if (adSec) adSec.classList.add("hidden");
    var paidTgl = $("paidToggle");
    if (paidTgl) { paidTgl.checked = true; }
    var paidN = $("paidNote");
    if (paidN) paidN.textContent = "Dev mode: all unlocked, no ads.";
    document.querySelectorAll(".paywall-lock").forEach(function (el) { el.classList.add("hidden"); });
    var kitNote = $("kitDevNote");
    if (kitNote) kitNote.classList.remove("hidden");
    var kitSub = $("kitPreviewSub");
    if (kitSub) kitSub.textContent = "Dev mode: Kit preview fully open — 110 dishes · 12 cards · 10 cities visible.";
  }
    // ---- v5.0: minimal public API for the chat layer (chat.js) ----
  // The chat is a feature now (Bun button / Ask Bun open it); it answers
  // through these, so the verdict / order / voice / OCR logic stays in
  // one place (here).
  // LLM hook lives in chat.js (sendToAssistant -> Worker /api/chat);
  // this file only exposes the local tools the chat needs.
  function recognizePhoto(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        loadOCR().then(function (ok) {
          if (!ok || !window.Tesseract) return resolve({ dish: null, confidence: 0, reason: "no-ocr" });
          return window.Tesseract.recognize(reader.result, "eng+chi_sim", { logger: function () {} }).then(function (res) {
            var conf = res && res.data ? res.data.confidence : 0;
            var dish = matchOcrText(res && res.data ? res.data.text : "");
            resolve({ dish: dish || null, confidence: conf, reason: dish ? "ok" : "no-match" });
          }).catch(function () { resolve({ dish: null, confidence: 0, reason: "ocr-error" }); });
        });
      };
      reader.onerror = function () { resolve({ dish: null, confidence: 0, reason: "read-error" }); };
      reader.readAsDataURL(file);
    });
  }
  window.ChinaBite = {
    D: D, DEV_MODE: DEV_MODE,
    findDish: findDish, findDishBest: findDishBest, suggestDishes: suggestDishes,
    dishMatchesQuery: dishMatchesQuery, askBunAbout: askBunAbout,
    PRICE_BASIS: PRICE_BASIS, PRICE_BASIS_SHORT: PRICE_BASIS_SHORT, CITY_TIER: CITY_TIER,
    verdictFor: verdictFor, renderResult: renderResult,
    checkDish: window.checkDish, gotoSection: gotoSection, showView: showView, openFaq: openFaq,
    addToOrder: addToOrder, speakInto: speakInto, recognizePhoto: recognizePhoto,
    usd: usd, esc: esc, containsEn: containsEn, spiceLabel: spiceLabel,
    dishInCat: dishInCat, SIGNATURE_IDS: SIGNATURE_IDS, HALAL_IDS: HALAL_IDS,
    // v4.3: diet profile is an array (multi-select). Accepts an array, a
    // single id, or "none"/empty (= no restriction). Syncs the decoder chips.
    getProfile: function () { return profile.slice(); },
    setProfile: function (ids) {
      var arr = Array.isArray(ids) ? ids : (!ids || ids === "none" ? [] : [ids]);
      profile = arr.filter(function (id) { return !!profileById(id); });
      refreshProfileUI();
      if (lastDish) renderResult(lastDish);
    }
  };

})();
