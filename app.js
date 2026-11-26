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
  // v5.9: drinks live in drinks.js — same shape as the dishes, separate
  // file so the 110-dish data is never touched. DR.drinks, DR.aliases.
  var DR = window.CHINABITE_DRINKS || { drinks: [], aliases: {} };
  var TEMP_EN = { iced: "Iced", room: "Room temp", hot: "Hot", warm: "Warm" };
  var TEMP_ZH = { iced: "冰镇", room: "常温", hot: "热", warm: "温" };
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
  var lastDrink = null; // last decoded drink, for price re-render on FX change

  // PAYWALL：DEV_MODE 下解码无限次，不扣次数。
  function remaining() { if (DEV_MODE) return Infinity; return Math.max(0, baseFree + state.bonus - state.used); }
  // Live FX (v6.4): every ¥→foreign amount goes through CBFX (fx.js) — one
  // live rate, one formatter. Falls back to 7.1 only if fx.js is missing.
  function usd(cny) { return (window.CBFX ? window.CBFX.fmt(cny) : "$" + (cny / 7.1).toFixed(2)); }
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
  // Live FX (v6.4): the rate tail is dynamic — currency + live rate date.
  function priceBasis() {
    var tail = window.CBFX ? window.CBFX.rateText() : "¥(CNY)→USD $ at 7.1 (2026-11-26)";
    return "Reference only — mid-range local restaurant in a Tier-1 city (Shanghai / Beijing). Street stalls are cheaper; hotels & tourist spots cost more. " + tail + ".";
  }
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
      "<p><b>About:</b> ¥" + dish.price + " · ≈" + usd(dish.price) + "</p>" +
      "<p class=\"small price-note\">" + esc(priceBasis()) + "</p>" +
      "<p><b>Show them this:</b></p><p class=\"bigzh\">" + esc(dish.waiter) + "</p>" +
      "<p class=\"small\">" + esc(dish.py) + "</p>" +
      '<button type="button" id="addOrderBtn">Add to order</button> ' +
      '<details class="subcard"><summary>Next · pick one</summary>' +
      '<div class="next-steps">' +
      '<button type="button" id="nextDeliveryBtn">Get it delivered</button>' +
      '<button type="button" class="ghost" id="nextQrBtn">How to order by QR</button>' +
      '<button type="button" class="ghost" id="nextCardBtn">Show diet card to waiter</button></div></details>';
    $("addOrderBtn").onclick = function () { addToOrder(dish); };
    $("nextDeliveryBtn").onclick = function () { goDelivery(); };
    $("nextQrBtn").onclick = function () { gotoSection("qrSection"); };
    $("nextCardBtn").onclick = function () { gotoSection("dietSection"); };
    updateCounts();
    updateDeliveryNote();
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
    // v5.9: drinks. Dishes are checked first — a drink only wins when
    // no dish matches, or the dish hit is fuzzy (an exact drink name
    // beats a fuzzy dish guess). 豆浆 still decodes to the dish.
    if (!best.dish || best.how === "fuzzy") {
      var drink = findDrink(q);
      if (drink) { hideStatus(); renderDrinkResult(drink); return; }
    }
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
    // DEV_MODE=false 时恢复：免费次数用完 → 挡住，去看广告或解锁。
    if (remaining() <= 0 && !paidPreview) {
      $("result").className = "subcard";
      $("result").innerHTML = "<div class=\"verdict ask\">That's your free checks for today</div>" +
        "<p>Watch a 5-second ad and I'll give you 3 more.</p>" +
        "<p>Or unlock it — register in Account.</p>" +
        '<button type="button" onclick="var a=document.getElementById(\'adSection\');a.classList.remove(\'hidden\');a.scrollIntoView()">Watch ad · +3</button>' +
        ' <button type="button" class="ghost" onclick="window.ChinaBite.showView(\'account\')">Go to Account</button>';
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
  "baiqie-chicken": "assets/dish-baiqiechicken.webp", "bingfen": "assets/dish-bingfen.webp", "blanched-shrimp": "assets/dish-blanchedshrimp.webp",
  "bobo-chicken": "assets/dish-bobochicken.webp", "changfen": "assets/dish-changfen.webp", "chaoshan-beef-balls": "assets/dish-chaoshanbeefballs.webp",
  "chashao-bao": "assets/dish-chashaobao.webp", "chengdu-zhongshuijiao": "assets/dish-chengduzhongshuijiao.webp", "chizhi-fengzhua": "assets/dish-chizhifengzhua.webp",
  "chongqing-noodles": "assets/dish-chongqingnoodles.webp", "congyou-bing": "assets/dish-congyoubing.webp", "dahu-mian": "assets/dish-dahumian.webp",
  "dandan-mian": "assets/dish-dandanmian.webp", "daoxiao-mian": "assets/dish-daoxiaomian.webp", "dapanji": "assets/dish-dapanji.webp",
  "disanxian": "assets/dish-disanxian.webp", "doufunao": "assets/dish-doufunao.webp", "douhua": "assets/dish-douhua.webp",
  "doujiang": "assets/dish-doujiang.webp", "fanqie-danhua-tang": "assets/dish-fanqiedanhuatang.webp", "fanqie-huoguo": "assets/dish-fanqiehuoguo.webp",
  "fuqi-feipian": "assets/dish-fuqifeipian.webp", "furu-tongcai": "assets/dish-furutongcai.webp", "ganbian-sijidou": "assets/dish-ganbiansijidou.webp",
  "guangzhou-wonton": "assets/dish-guangzhouwonton.webp", "guilin-mifen": "assets/dish-guilinmifen.webp", "guoqiao-mixian": "assets/dish-guoqiaomixian.webp",
  "guotie": "assets/dish-guotie.webp", "hangzhou-dongporou": "assets/dish-hangzhoudongporou.webp", "hongshao-rou": "assets/dish-hongshaorou.webp",
  "hot-sour-soup": "assets/dish-hotsoursoup.webp", "hotpot": "assets/dish-hotpot.webp", "huiguo-pork": "assets/dish-huiguorou.webp",
  "jian-bing": "assets/dish-jian-bing.webp", "jianbing": "assets/dish-jianbing.webp", "jiangzhuang-nai": "assets/dish-jiangzhuangnai.webp",
  "jiaozi": "assets/dish-jiaozi.webp", "jidi-zhou": "assets/dish-jidizhou.webp", "kao-baozi": "assets/dish-kaobaozi.webp",
  "kao-hongshu": "assets/dish-kaohongshu.webp", "kao-shenghao": "assets/dish-kaoshenghao.webp", "kao-yangrou-chuan": "assets/dish-kaoyangrouchuan.webp",
  "kao-yumi": "assets/dish-kaoyumi.webp", "koushui-chicken": "assets/dish-koushuichicken.webp", "kung-pao": "assets/dish-kungpao.webp",
  "lanzhou": "assets/dish-lanzhou.webp", "lazi-chicken": "assets/dish-lazichicken.webp", "liangban-cucumber": "assets/dish-liangbancucumber.webp",
  "liangban-muer": "assets/dish-liangbanmuer.webp", "liangfen": "assets/dish-liangfen.webp", "liusha-bao": "assets/dish-liushabao.webp", "liuzhou-luoshifen": "assets/dish-liuzhouluoshifen.webp",
  "luobo-gao": "assets/dish-luobogao.webp", "luohan-zhai": "assets/dish-luohanzhai.webp", "mala-gao": "assets/dish-malagao.webp",
  "mala-xiangguo": "assets/dish-malaxiangguo.webp", "malatang": "assets/dish-malatang.webp", "maoxuewang": "assets/dish-maoxuewang.webp",
  "mapo-tofu": "assets/dish-mapodoufu.webp", "mapo-tofu-veg": "assets/dish-mapotofuveg.webp", "nang": "assets/dish-nang.webp",
  "nanjing-yaxue-fensi": "assets/dish-nanjingyaxuefensi.webp", "niurou-mian": "assets/dish-niuroumian.webp", "peking-duck": "assets/dish-pekingduck.webp",
  "qingchao-shishu": "assets/dish-qingchaoshishu.webp", "qingtang-huoguo": "assets/dish-qingtanghuoguo.webp", "regan-mian": "assets/dish-reganmian.webp",
  "roujiamo": "assets/dish-roujiamo.webp", "shao-e": "assets/dish-shaoe.webp", "shaxian-bianrou": "assets/dish-shaxianbianrou.webp",
  "shengjian-bao": "assets/dish-shengjianbao.webp", "shizitou": "assets/dish-shizitou.webp", "shouzhuafan": "assets/dish-shouzhuafan.webp",
  "shuangpi-nai": "assets/dish-shuangpinai.webp", "shuizhu-beef": "assets/dish-shuizhubeef.webp", "shuizhu-fish": "assets/dish-shuizhufish.webp",
  "songshu-guiyu": "assets/dish-songshuguiyu.webp", "steamed-bass": "assets/dish-steamedbass.webp", "suancai-fish": "assets/dish-suancaifish.webp",
  "suanmeitang": "assets/dish-suanmeitang.webp", "sweet-sour-ribs": "assets/dish-sweetsourribs.webp", "tangcu-xiaopai": "assets/dish-tangcuxiaopai.webp", "tingzai-zhou": "assets/dish-tingzaizhou.webp",
  "tomato-egg": "assets/dish-tomatoegg.webp", "xiajiao": "assets/dish-xiajiao.webp", "xian-liangpi": "assets/dish-xianliangpi.webp",
  "xianggu-qingcai": "assets/dish-xiangguqingcai.webp", "xiangyou-shanhu": "assets/dish-xiangyoushanhu.webp", "xiaolongbao": "assets/dish-xiaolongbao.webp",
  "xiefen-xiaolong": "assets/dish-xiefenxiaolong.webp", "yangrou-chuan": "assets/dish-yangrouchuan.webp", "yangrou-paomo": "assets/dish-yangroupaomo.webp",
  "yangrou-tang": "assets/dish-yangroutang.webp", "yangzhi-ganlu": "assets/dish-yangzhiganlu.webp", "yangzhou-rice": "assets/dish-yangzhourice.webp",
  "youpo-mian": "assets/dish-youpomian.webp", "yuxiang": "assets/dish-yuxiang.webp", "zhajiang": "assets/dish-zhajiang.webp"
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
      b.innerHTML = '<span class="en">' + esc(d.en) + '</span><br><span class="zh">' + esc(d.zh) + " · ¥" + d.price + " · ≈" + usd(d.price) + " · Spice " + d.spicy + "/3</span>";
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
  // ---- v6.4: Home — Signature big-image cards + Cities dropdown ----
  // Cities + categories are ONE dropdown each now (chips -> dropdown).
  // ---- v6.5: the Cities dropdown defaults to Shanghai on load, so
  // Signature shows Shanghai's photo + 3 must-eats immediately — no
  // "choose a city" prompt state on first load. The user can pull the
  // dropdown down to pick any other city; picking the placeholder
  // option returns to the hint state. The picked city's photo appears
  // with its 3 dishes (the picture is part of the reveal). City photos
  // come from the same map as the Cities view.
  var CITY_IMG = { beijing: "assets/city-beijing.webp", chengdu: "assets/city-chengdu.webp", chongqing: "assets/city-chongqing.webp", guangzhou: "assets/city-guangzhou.webp", guilin: "assets/city-guilin.webp", hangzhou: "assets/city-hangzhou.webp", kunming: "assets/city-kunming.webp", shanghai: "assets/city-shanghai.webp", shenzhen: "assets/city-shenzhen.webp", xian: "assets/city-xian.webp" };
  var selectedCity = "shanghai"; // v6.5: Shanghai is the homepage default; null = nothing picked yet (only via the placeholder option)
  var renderSigGroups = null;
  function renderHomeSignature() {
    var wrap = $("homeSignatureList");
    if (!wrap) return;
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
      b.innerHTML = thumb + '<span><span class="en">' + esc(d.en) + '</span><span class="zh">' + esc(d.zh) + '</span><span class="price">¥' + d.price + ' · ≈' + usd(d.price) + '</span><span class="spice">Spicy ' + d.spicy + '/3</span></span>';
      // Same verdict path as everywhere else: checkDish -> decode -> renderResult.
      b.onclick = function () { window.checkDish(d.zh); };
      return b;
    }
    function renderGroups(cityId) {
      wrap.innerHTML = "";
      if (!cityId) {
        wrap.innerHTML = '<p class="muted">Choose a city below to see its 3 must-eats.</p>';
        return;
      }
      groups.forEach(function (g) {
        if (g.city.id !== cityId) return;
        var img = CITY_IMG[g.city.id];
        if (img) {
          var ph = document.createElement("p");
          ph.innerHTML = '<img class="city-img" src="' + img + '" alt="' + esc(g.city.en) + ' street scene" width="491" height="327" loading="lazy">';
          wrap.appendChild(ph);
        }
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
    renderSigGroups = renderGroups;
    renderGroups(selectedCity);
  }
  function selectCity(id) {
    selectedCity = id || null;
    var sel = $("citySelect");
    if (sel && sel.value !== (selectedCity || "")) sel.value = selectedCity || "";
    if (renderSigGroups) renderSigGroups(selectedCity);
    if (!selectedCity) return;
    var hs = $("homeSignature");
    if (hs) { if (hs.tagName === "DETAILS") hs.open = true; hs.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
  renderHomeSignature();
  function renderHomeCities() {
    var sel = $("citySelect");
    if (!sel) return;
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = ""; ph.textContent = "Choose a city\u2026";
    sel.appendChild(ph);
    (D.cities || []).forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.en + " \u00b7 " + (c.mustEat || []).length + " must-eats";
      sel.appendChild(o);
    });
    sel.value = "shanghai"; // v6.5: dropdown shows Shanghai on first load
    sel.addEventListener("change", function () { selectCity(sel.value || null); });
  }
  renderHomeCities();

  // ---- Top search bar + category dropdown (v3.2, Uber Eats-style; v5.0: they
  // filter the Home results list in place — the browse blocks hide while
  // a filter is active, and come back when it is cleared. v6.4: chips are
  // one <select> now; same filter behaviour, "All" stays the default.) ----
  var CATS = [["all", "All"], ["signature", "Signature"], ["noodles", "Noodles"], ["dumplings", "Dumplings"], ["spicy", "Spicy"], ["veg", "Veg"], ["halal", "Halal"], ["soup", "Soup"], ["rice", "Rice"]];
  var catSel = $("catSelect");
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
  if (catSel) {
    CATS.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c[0]; o.textContent = c[1];
      catSel.appendChild(o);
    });
    catSel.value = "all";
    catSel.addEventListener("change", function () {
      var v = catSel.value;
      if (v === "signature") {
        // Signature lives as big cards on Home — clear the filter and
        // scroll to them instead of filtering the quick list.
        currentCat = "all";
        catSel.value = "all";
        if ($("topSearch")) $("topSearch").value = "";
        updateHomeFilter();
        var hs = $("homeSignature");
        // v5.2: Signature is a <details> now — open it before scrolling,
        // or the user lands on a closed header.
        if (hs) { if (hs.tagName === "DETAILS") hs.open = true; hs.scrollIntoView({ behavior: "smooth", block: "start" }); }
        return;
      }
      currentCat = v;
      updateHomeFilter();
      if (homeResults) homeResults.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  var topSearch = $("topSearch");
  if (topSearch) {
    topSearch.addEventListener("input", function () { updateHomeFilter(); });
    topSearch.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var dr = findDrink(topSearch.value);
      if (dr) { showDrink(dr); return; }
      var d = findDish(topSearch.value);
      if (d) window.checkDish(d.zh);
    });
  }

  // ---- Live FX re-render (v6.4) ----
  // Currency switch or live-rate arrival re-renders every converted amount
  // in place — no reload. Static .fx-basis tails are refreshed by fx.js.
  function refreshPrices() {
    renderHomeSignature();
    updateHomeFilter();
    if (typeof renderDrinks === "function") renderDrinks();
    if (typeof renderOrder === "function") renderOrder();
    var res = $("result");
    if (res && !res.classList.contains("hidden")) {
      if (lastDrink && res.querySelector(".drink-card")) renderDrinkResult(lastDrink);
      else if (lastDish) renderResult(lastDish);
    }
  }
  if (window.CBFX) window.CBFX.onChange(refreshPrices);

  // ---- Toast (v6.0 — Orders: every tap answers) ----
  // One small pill above the bottom nav. Replaces the blocking
  // alert() calls: adding, sharing, clearing and deep links all answer
  // here now, with an action button when there is a next step.
  var toastTimer = null;
  function showToast(msg, actionLabel, actionFn) {
    var t = $("toast"), m = $("toastMsg"), b = $("toastAction");
    if (!t || !m) return;
    m.textContent = msg;
    if (b) {
      if (actionLabel) {
        b.textContent = actionLabel;
        b.classList.remove("hidden");
        b.onclick = function (e) { if (e) e.stopPropagation(); hideToast(); if (actionFn) actionFn(); };
      } else { b.classList.add("hidden"); b.onclick = null; }
    }
    t.classList.remove("hidden");
    t.onclick = function () { hideToast(); };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 5000 : 3500);
  }
  function hideToast() {
    var t = $("toast");
    if (t) t.classList.add("hidden");
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  // ---- Order list + slip (B route) ----
  // v5.9: order items are dishes ({id, qty}) or drinks
  // ({id: "drink:<id>", qty, temp}). One lookup for both, so the
  // total, the slip and Share all stay in one place.
  function drinkById(id) {
    for (var i = 0; i < DR.drinks.length; i++) if (DR.drinks[i].id === id) return DR.drinks[i];
    return null;
  }
  function itemById(id) {
    if (!id) return null;
    if (id.indexOf("drink:") === 0) {
      var dr = drinkById(id.slice(6));
      return dr ? { id: id, en: dr.en, zh: dr.zh, price: dr.price, kind: "drink" } : null;
    }
    var d = D.dishes.find(function (dd) { return dd.id === id; });
    return d ? { id: d.id, en: d.en, zh: d.zh, price: d.price, kind: "dish" } : null;
  }
  function addToOrder(dish) {
    var item = state.order.find(function (x) { return x.id === dish.id; });
    if (item) item.qty++; else state.order.push({ id: dish.id, qty: 1 });
    // v6.0: adding IS checking — the delivery tab searches the last dish
    // added, so a dish added from chat (no decode) still has a target.
    lastDish = dish;
    save(); renderOrder(); updateDeliveryNote();
    showToast(dish.en + " is on your list.", "View order", function () { showView("orders"); });
  }
  // v5.9: drinks join the same order list — same slip, same total, no
  // second ordering system. Temp travels with the item so the slip can
  // say 冰镇, not just the drink name.
  function addDrinkToOrder(dr) {
    var temp = drinkTemp[dr.id] || dr.defaultTemp;
    var key = "drink:" + dr.id;
    var item = state.order.find(function (x) { return x.id === key && x.temp === temp; });
    if (item) item.qty++; else state.order.push({ id: key, qty: 1, temp: temp });
    save(); renderOrder();
    showToast(dr.en + " (" + TEMP_EN[temp] + ") is on your list.", "View order", function () { showView("orders"); });
  }
  function renderOrder() {
    var el = $("orderList");
    if (!state.order.length) {
      el.innerHTML = "<p class=\"muted\">Nothing here yet — check a dish first, then add it.</p><p><button type=\"button\" id=\"orderEmptyGo\">Decode a dish</button></p>";
      var go = $("orderEmptyGo");
      if (go) go.onclick = function () { showView("search"); };
    } else {
      var total = 0, items = 0;
      el.innerHTML = state.order.map(function (x) {
        var d = itemById(x.id);
        if (!d) return "";
        total += d.price * x.qty; items += x.qty;
        var temp = (d.kind === "drink" && x.temp) ? " · " + TEMP_ZH[x.temp] : "";
        return "<p class=\"ord-line\"><span class=\"ord-name\">• " + esc(d.en) + " (" + esc(d.zh) + temp + ")</span>" +
          "<span class=\"ord-qty\"><button type=\"button\" class=\"qty-btn\" data-qty=\"-1\" data-id=\"" + esc(x.id) + "\" aria-label=\"One fewer " + esc(d.en) + "\">−</button>" +
          "<span class=\"ord-n\">×" + x.qty + "</span>" +
          "<button type=\"button\" class=\"qty-btn\" data-qty=\"1\" data-id=\"" + esc(x.id) + "\" aria-label=\"One more " + esc(d.en) + "\">+</button></span>" +
          "<span class=\"ord-price\">¥" + (d.price * x.qty) + "</span>" +
          "<button type=\"button\" class=\"qty-btn ord-remove\" data-remove=\"" + esc(x.id) + "\" aria-label=\"Remove " + esc(d.en) + "\">×</button></p>";
      }).join("") + "<p><b>Total: ¥" + total + " · ≈" + usd(total) + "</b> · " + items + (items === 1 ? " item" : " items") + "</p>" +
        "<p class=\"small price-note\">The total is a guide, not the bill.</p>";
      el.querySelectorAll("[data-qty]").forEach(function (b) {
        b.onclick = function () {
          var item = state.order.find(function (y) { return y.id === b.getAttribute("data-id"); });
          if (!item) return;
          item.qty += parseInt(b.getAttribute("data-qty"), 10);
          if (item.qty <= 0) {
            var gone = itemById(item.id);
            state.order = state.order.filter(function (y) { return y.id !== item.id; });
            save(); renderOrder();
            if (gone) showToast(gone.en + " removed.");
            return;
          }
          save(); renderOrder();
        };
      });
      el.querySelectorAll("[data-remove]").forEach(function (b) {
        b.onclick = function () {
          var rid = b.getAttribute("data-remove");
          var d = itemById(rid);
          state.order = state.order.filter(function (y) { return y.id !== rid; });
          save(); renderOrder();
          if (d) showToast(d.en + " removed.");
        };
      });
    }
    renderSlip();
    updateOrdBadge();
    updateDeliveryLine();
  }
  // v6.0: the Orders tab carries the list count, so the tab never looks
  // empty — the user can see at a glance whether anything is on the list.
  function updateOrdBadge() {
    var b = $("ordBadge");
    if (!b) return;
    var n = state.order.reduce(function (s, x) { return s + x.qty; }, 0);
    b.textContent = n;
    b.classList.toggle("hidden", n === 0);
  }
  // v6.0: Delivery never used the list, so switching tabs made it look
  // lost. The Delivery panel now shows the list summary, and the search
  // buttons say which dish they will search BEFORE the tap.
  function updateDeliveryLine() {
    var el = $("deliveryListLine");
    if (!el) return;
    var total = 0, items = 0;
    state.order.forEach(function (x) {
      var d = itemById(x.id);
      if (d) { total += d.price * x.qty; items += x.qty; }
    });
    el.textContent = items
      ? "Your list: " + items + (items === 1 ? " item" : " items") + " · ¥" + total + " — delivery searches one dish at a time, starting with the last one you checked."
      : "Your list is empty — delivery searches one dish at a time, starting with the last one you checked.";
  }
  function updateDeliveryNote() {
    var note = $("deliveryDishNote");
    if (!note) return;
    note.textContent = lastDish
      ? "Will search: “" + lastDish.zh + " · " + lastDish.en + "” — tap a button below."
      : "No dish checked yet — check a dish first, then this button searches it directly.";
  }
  function renderSlip() {
    var tableNo = ($("tableNo") && $("tableNo").value) || "____";
    var people = ($("peopleNo") && $("peopleNo").value) || "____";
    var pay = document.querySelector('input[name="payMethod"]:checked');
    var payText = pay ? pay.value : "支付宝 / 现金在柜台付款";
    var lines = state.order.map(function (x, i) {
      var d = itemById(x.id);
      if (!d) return "";
      // Drinks carry their temp on the slip — 青岛啤酒（冰镇）— so the
      // waiter can't bring it warm by default.
      var temp = (d.kind === "drink" && x.temp) ? "（" + TEMP_ZH[x.temp] + "）" : "";
      return (i + 1) + ". " + d.zh + temp + " ×" + x.qty;
    }).filter(Boolean);
    var slipTotal = state.order.reduce(function (s, x) {
      var d = itemById(x.id);
      return s + (d ? d.price * x.qty : 0);
    }, 0);
    $("slipPreview").innerHTML =
      "<p class=\"bigzh\">您好，请帮我用你们的手机下单，谢谢！</p>" +
      "<p class=\"bigzh\">桌号：" + esc(tableNo) + " &nbsp; 人数：" + esc(people) + "</p>" +
      (lines.length ? "<p class=\"bigzh\">" + lines.map(esc).join("<br>") + "</p><p class=\"bigzh\">总计：" + slipTotal + "元。</p>" : "<p class=\"muted\">(Add dishes to your list in the decoder first.)</p>") +
      "<p class=\"bigzh\">我用" + esc(payText) + "。</p>";
  }
  ["tableNo", "peopleNo"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("input", renderSlip); });
  document.querySelectorAll('input[name="payMethod"]').forEach(function (r) { r.addEventListener("change", renderSlip); });
  $("showSlipBtn").onclick = function () {
    // v6.0: an empty slip is not a slip — answer with a next step instead
    // of opening a blank overlay. The overlay mirrors the live preview
    // here, not in a separate inline script — one place, always in sync.
    if (!state.order.length) { showToast("Your list is empty — check a dish first.", "Decode a dish", function () { showView("search"); }); return; }
    renderSlip();
    var full = $("slipFull"), prev = $("slipPreview");
    if (full && prev) full.innerHTML = prev.innerHTML;
    $("slipOverlay").classList.remove("hidden");
    setOrderStep(4);
  };
  $("closeSlipBtn").onclick = function () { $("slipOverlay").classList.add("hidden"); };
  // v6.0: Clear used to wipe the whole list on one tap, no questions
  // asked. Now it arms first — tap again within 3s to confirm.
  var clearArmTimer = null;
  $("clearOrderBtn").onclick = function () {
    var btn = $("clearOrderBtn");
    if (!state.order.length) { showToast("Your list is already empty."); return; }
    if (!clearArmTimer) {
      btn.textContent = "Tap again to clear";
      btn.classList.add("armed");
      showToast("Tap again to clear your whole list.");
      clearArmTimer = setTimeout(function () {
        clearArmTimer = null;
        btn.textContent = "Clear";
        btn.classList.remove("armed");
      }, 3000);
      return;
    }
    clearTimeout(clearArmTimer); clearArmTimer = null;
    btn.textContent = "Clear";
    btn.classList.remove("armed");
    state.order = []; save(); renderOrder();
    showToast("List cleared.");
  };
  renderOrder();

  // ---- QR route A table ----
  $("qrTable").innerHTML = "<table><tr><th>Chinese</th><th>English</th><th>What it means</th></tr>" +
    D.qrButtons.map(function (b) { return "<tr><td><b>" + esc(b.zh) + "</b></td><td>" + esc(b.en) + "</td><td>" + esc(b.note) + "</td></tr>"; }).join("") + "</table>";

  // ---- Dine-in steps carry state (v6.0) ----
  // The 3 steps were plain text — the user never knew where they were.
  // Step 2 is a real choice now: the branch they pick highlights the
  // matching route (A: mini-program table, B: order slip) and moves the
  // steps forward. Showing the slip finishes step 3.
  function setOrderStep(n) {
    var steps = document.querySelectorAll("#dineSteps li");
    steps.forEach(function (li) {
      var s = parseInt(li.getAttribute("data-step"), 10);
      li.classList.toggle("done", s < n);
      li.classList.toggle("current", s === n);
      li.classList.toggle("todo", s > n);
    });
  }
  function markRoute(which) {
    var a = $("routeA"), b = $("routeB");
    if (a) a.classList.toggle("route-on", which === "a");
    if (b) b.classList.toggle("route-on", which === "b");
    setOrderStep(3);
    var target = which === "a" ? a : b;
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if ($("qrOpenedBtn")) $("qrOpenedBtn").onclick = function () { markRoute("a"); showToast("Mini-program opened — the table below translates the buttons you'll see."); };
  if ($("qrBlockedBtn")) $("qrBlockedBtn").onclick = function () { markRoute("b"); showToast("No problem — show the slip below to staff. No +86 number needed."); };

  // ---- Orders tabs: Dine-in / Delivery (v5.2) ----
  // Delivery is a guide only — ordering happens in Meituan / Taobao
  // Flash Purchase, not here. This panel is the single home of the
  // delivery flow — the FAQ only points here (v6.0 dedup). No invented
  // restaurants, addresses, phone numbers, prices, or wait times.
  function setOrderTab(which) {
    var dine = $("tabDineIn"), del = $("tabDelivery"), dp = $("dineInPanel"), vp = $("deliveryPanel");
    if (!dine || !del || !dp || !vp) return;
    var isDel = which === "delivery";
    dine.setAttribute("aria-selected", isDel ? "false" : "true");
    del.setAttribute("aria-selected", isDel ? "true" : "false");
    dp.classList.toggle("hidden", isDel);
    vp.classList.toggle("hidden", !isDel);
    if (isDel) updateDeliveryNote();
  }
  // v6.0: one way into delivery — the decoder, the chat and the FAQ all
  // land here instead of keeping their own Meituan / Dianping buttons.
  // dishId (optional) makes the delivery tab search that dish.
  function goDelivery(dishId) {
    if (dishId) {
      var d = D.dishes.find(function (x) { return x.id === dishId; });
      if (d) lastDish = d;
    }
    showView("orders");
    setOrderTab("delivery");
    var dp = $("deliveryPanel");
    if (dp) dp.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // v6.0: deep-link buttons answer at once — "Opening…" + disabled for
  // 2s, so a second tap can't fire the scheme twice.
  function pressBusy(btn) {
    if (!btn) return;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Opening…";
    setTimeout(function () { btn.disabled = false; btn.textContent = label; }, 2000);
  }
  if ($("tabDineIn")) $("tabDineIn").onclick = function () { setOrderTab("dinein"); };
  if ($("tabDelivery")) $("tabDelivery").onclick = function () { setOrderTab("delivery"); };
  if ($("deliveryMeituanBtn")) $("deliveryMeituanBtn").onclick = function () {
    var note = $("deliveryDishNote");
    var btn = $("deliveryMeituanBtn");
    if (lastDish) {
      if (note) note.textContent = "Opening Meituan Waimai search for “" + lastDish.zh + "” — if the app isn't installed you'll land on the web search instead.";
      pressBusy(btn);
      openDeepLink(MEITUAN_LINKS.waimaiScheme(lastDish.zh), MEITUAN_LINKS.waimaiH5(lastDish.zh));
    } else {
      if (note) note.textContent = "Check a dish first — then this button searches it directly. Opening Meituan Waimai home for now.";
      pressBusy(btn);
      openDeepLink(MEITUAN_LINKS.waimaiSchemeHome, MEITUAN_LINKS.waimaiH5Home);
    }
  };
  if ($("deliveryDianpingBtn")) $("deliveryDianpingBtn").onclick = function () {
    var note = $("deliveryDishNote");
    var btn = $("deliveryDianpingBtn");
    if (lastDish) {
      if (note) note.textContent = "Opening Dianping search for “" + lastDish.zh + "” — reviews and group deals, in the app or on the web.";
      pressBusy(btn);
      openDeepLink(MEITUAN_LINKS.dianpingScheme(lastDish.zh), MEITUAN_LINKS.dianpingH5);
    } else {
      if (note) note.textContent = "Check a dish first — then this button searches it directly. Opening Dianping home for now.";
      pressBusy(btn);
      openDeepLink(MEITUAN_LINKS.dianpingSchemeHome, MEITUAN_LINKS.dianpingH5);
    }
  };
  if ($("deliveryElemeBtn")) $("deliveryElemeBtn").onclick = function () {
    var note = $("deliveryDishNote");
    var btn = $("deliveryElemeBtn");
    if (note) note.textContent = "Opening Ele.me — if nothing opens, search Taobao Flash Purchase inside Alipay instead.";
    pressBusy(btn);
    var w = window.open("https://www.ele.me/", "_blank");
    if (!w && note) note.textContent = "Popup blocked — open ele.me in your browser, or search Taobao Flash Purchase inside Alipay.";
  };
  if ($("deliveryHotelBtn")) $("deliveryHotelBtn").onclick = function () { gotoSection("meituanSection"); };
  if ($("deliveryPhoneBtn")) $("deliveryPhoneBtn").onclick = function () { openFaq("faq-phone"); };
  if ($("deliverySeeListBtn")) $("deliverySeeListBtn").onclick = function () { setOrderTab("dinein"); };
  updateDeliveryNote();

  // ---- Payment checklist ----
  var checks = [
    ["c1", "WeChat / Alipay linked"],
    ["c2", "Tour Pass set up"],
    ["c3", "Cash as backup"],
    ["c4", "List saved offline"]
  ];
  var ckEl = $("payChecks");
  // v6.0: the checklist used to be four silent boxes — now it says how
  // ready you are (x of 4), with the same progress bar as the decoder.
  function updatePayProgress() {
    var done = checks.filter(function (c) { return state.checks[c[0]]; }).length;
    var p = $("payProgress");
    if (p) p.textContent = done + " of " + checks.length + " ready" + (done === checks.length ? " — you're set." : "");
    var bar = $("payBar");
    if (bar) bar.style.width = Math.round(done / checks.length * 100) + "%";
  }
  checks.forEach(function (c) {
    var lab = document.createElement("label");
    lab.innerHTML = '<input type="checkbox" ' + (state.checks[c[0]] ? "checked" : "") + "> " + esc(c[1]);
    lab.querySelector("input").onchange = function (e) { state.checks[c[0]] = e.target.checked; save(); updatePayProgress(); };
    ckEl.appendChild(lab);
  });
  updatePayProgress();

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

  // ---- Drinks & beer (v5.9) ----
  // Same folding-card shape as Diet Cards; the culture note lives in the
  // HTML (drinksSection), the list renders here. One card per drink:
  // name, price, one-line note, temp chips, the big-Chinese order
  // sentence for the picked temp, Add to order (same order list as
  // dishes — no second ordering system).
  var drinkCat = "all";
  var drinkTemp = {}; // drink id -> picked temp key (default = drink.defaultTemp)
  // Temp chips are user-facing UI, so they read English only — the
  // Chinese temp word lives in the big order sentence below, which is
  // what the waiter sees.
  function tempLabel(dr, t) {
    if (t === "iced") return "Iced";
    if (t === "room") return "Room temp";
    if (t === "hot") return "Hot";
    return "Warm";
  }
  function drinkOrderSentence(dr, temp) {
    var w = temp === "iced" ? (dr.icedWord || "冰") : temp === "room" ? "常温" : temp === "hot" ? "热" : "温";
    return "请给我一" + dr.unit + w + dr.zh + "，谢谢。";
  }
  function drinkCardHTML(dr, pfx) {
    var temp = drinkTemp[dr.id] || dr.defaultTemp;
    return '<div class="subcard drink-card" id="' + pfx + 'Card-' + dr.id + '">' +
      "<h3>" + esc(dr.en) + " · " + esc(dr.zh) + "</h3>" +
      '<p class="small">' + esc(dr.py) + " · ¥" + dr.price + " · ≈" + usd(dr.price) + "</p>" +
      "<p>" + esc(dr.note) + "</p>" +
      '<div class="drink-temp" role="group" aria-label="Temperature">' +
      dr.temps.map(function (t) {
        return '<button type="button" class="chip" data-drink="' + dr.id + '" data-temp="' + t + '" aria-pressed="' + (t === temp) + '">' + esc(tempLabel(dr, t)) + "</button>";
      }).join("") + "</div>" +
      '<p><b>Show them this:</b></p><p class="bigzh" id="' + pfx + 'Order-' + dr.id + '">' + esc(drinkOrderSentence(dr, temp)) + "</p>" +
      '<p><button type="button" data-drink-add="' + dr.id + '">Add to order</button></p>' +
      "</div>";
  }
  // Wire one rendered card (temp chips + Add button). `root` is the
  // container holding the card; `pfx` is the id prefix used above.
  function bindDrinkCard(root, dr, pfx) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-drink="' + dr.id + '"][data-temp]'), function (b) {
      b.onclick = function () {
        drinkTemp[dr.id] = b.getAttribute("data-temp");
        var line = $(pfx + "Order-" + dr.id);
        if (line) line.textContent = drinkOrderSentence(dr, drinkTemp[dr.id]);
        Array.prototype.forEach.call(root.querySelectorAll('[data-drink="' + dr.id + '"][data-temp]'), function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
      };
    });
    var add = root.querySelector('[data-drink-add="' + dr.id + '"]');
    if (add) add.onclick = function () { addDrinkToOrder(dr); };
  }
  var DRINK_CATS = [["all", "All"], ["beer", "Beer"], ["soft", "Soft drinks"], ["tea", "Tea"], ["juice", "Juice & traditional"], ["spirit", "Spirits"]];
  function renderDrinks() {
    var list = $("drinkList");
    if (!list) return;
    var cc = $("drinkCatChips");
    if (cc) {
      cc.innerHTML = DRINK_CATS.map(function (c) {
        return '<button type="button" class="chip" data-drink-cat="' + c[0] + '" aria-pressed="' + (c[0] === drinkCat) + '">' + esc(c[1]) + "</button>";
      }).join("");
      Array.prototype.forEach.call(cc.querySelectorAll("[data-drink-cat]"), function (b) {
        b.onclick = function () { drinkCat = b.getAttribute("data-drink-cat"); renderDrinks(); };
      });
    }
    var shown = DR.drinks.filter(function (dr) { return drinkCat === "all" || dr.cat === drinkCat; });
    list.innerHTML = shown.map(function (dr) { return drinkCardHTML(dr, "dl"); }).join("");
    shown.forEach(function (dr) { bindDrinkCard(list, dr, "dl"); });
  }
  renderDrinks();
  // Open the drinks section on one drink (decoder hit, home search).
  function showDrink(dr) {
    drinkCat = "all";
    renderDrinks();
    gotoSection("drinksSection");
    var card = $("dlCard-" + dr.id);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // ---- Drink lookup for the decoder (v5.9) ----
  // Aliases live ONLY in drinks.js (window.CHINABITE_DRINKS.aliases),
  // matched after normStr() like the dish aliases. Dishes are checked
  // FIRST in decode() — this runs only when no dish matches, or the
  // dish hit is fuzzy — so 豆浆 still decodes to the dish, never here.
  var DRINK_ALIAS_MAP = {};
  (function buildDrinkIndex() {
    var raw = DR.aliases || {};
    Object.keys(raw).forEach(function (k) {
      var nk = normStr(k);
      if (nk) DRINK_ALIAS_MAP[nk] = raw[k];
    });
  })();
  function findDrink(q) {
    var n = normStr(q);
    if (!n) return null;
    if (DRINK_ALIAS_MAP[n]) return drinkById(DRINK_ALIAS_MAP[n]);
    var found = null;
    DR.drinks.forEach(function (dr) {
      if (normStr(dr.zh) === n || normStr(dr.en) === n || normStr(stripParen(dr.py || "")) === n) found = dr;
    });
    if (found) return found;
    // Contains, but only for queries of 2+ chars — a 1-char query like
    // 水 must not grab the first drink with 水 in its name.
    if (n.length >= 2) {
      DR.drinks.forEach(function (dr) {
        if (!found && (normStr(dr.zh).indexOf(n) >= 0 || normStr(dr.en).indexOf(n) >= 0)) found = dr;
      });
    }
    return found;
  }
  // Decoder hit for a drink: no verdict, no free-count spent — drinks
  // are guidance, not a dish check. Same card as the drinks section,
  // plus a way into the full list.
  function renderDrinkResult(dr) {
    lastDrink = dr;
    var res = $("result");
    res.className = "subcard";
    res.innerHTML =
      '<div class="verdict ok">Drink — ' + esc(dr.en) + " (" + esc(dr.zh) + ")</div>" +
      "<p>Pick iced below — the order line says so in Chinese.</p>" +
      "<p><b>About:</b> ¥" + dr.price + " · ≈" + usd(dr.price) + "</p>" +
      '<p class="small price-note">' + esc(priceBasis()) + "</p>" +
      drinkCardHTML(dr, "res");
    bindDrinkCard(res, dr, "res");
  }

  // ---- Cities (10 cities; sample only, address not verified) ----
  var cityEl = $("cityList");
  if (cityEl && D.cities) {
    var dishById = {};
    (D.dishes || []).forEach(function (d) { dishById[d.id] = d; });
    D.cities.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "subcard";
      var cityImg = CITY_IMG[c.id];
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
      " Price ¥" + dish.price + " (≈" + usd(dish.price) + ").";
    setMeta("description", d);
    setMeta("og:title", t);
    setMeta("og:description", d);
    setMeta("twitter:title", t);
    setMeta("twitter:description", d);
  }
  function shareText(title, text) {
    if (navigator.share) { navigator.share({ title: title, text: text }).then(function () { showToast("Shared."); }).catch(function () {}); }
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { showToast("Copied. Paste into WeChat."); });
    } else { showToast("Sharing isn't available here — copy from the slip below."); }
  }
  window.shareText = shareText;

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
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { showToast("Hotel card copied."); });
      else showToast("Copy isn't available here — long-press the card text instead.");
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
  // v6.1: share goes DIRECT to the social app — one tap on the tag opens
  // that platform's share sheet with the invite link ready. Only platforms
  // with a real web share URL are here: X, Facebook, WhatsApp. Instagram
  // and TikTok have no web share-intent URL, so they are NOT listed
  // (do not invent a deep link for them).
  (function wireShareLinks() {
    var link = location.origin + location.pathname + "?ref=" + state.myRef;
    var text = "China Bite — I can read any Chinese menu in 3 seconds. Try it free: " + link + " #ChinaBite";
    function set(id, href) { var a = $(id); if (a) a.href = href; }
    set("shareXBtn", "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text));
    set("shareFbBtn", "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link));
    set("shareWaBtn", "https://wa.me/?text=" + encodeURIComponent(text));
  })();
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
    // v6.1: paid = no ads. Paid users never reach this button (the ad
    // section is hidden for them), but guard anyway — never show an ad
    // to someone who paid to remove them.
    if (paidPreview) return;
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
  // v6.1: sign-up copy — "new dishes first" is gone (Oliver: no use).
  // Your email IS your account: no password. We email only when there's
  // something new worth sending.
  // v6.1: Account copy is English-only (Oliver: the user is a native
  // foreigner; Chinese appears only where shown to Chinese people — the
  // waiter-facing lines and dish names). The language dropdown below only
  // picks the confirmation EMAIL language; the card itself stays English.
  var SUBSCRIBE_COPY = {
    en: { title: "Register.", line: "Your email is your account. We email you when there's something new — nothing else.", btn: "Subscribe", privacy: "Only China Bite updates. No marketing. Unsubscribe anytime.", done: "You're in.", doneLine: "We'll email you when there's something new.", already: "Already subscribed.", bad: "That email doesn't look right.", pending: "Couldn't reach the server. Saved on this device." }
  };
  var subForm = $("subscribeForm"), subEmail = $("subscribeEmail"), subLang = $("subscribeLang");
  function subCopy() { return SUBSCRIBE_COPY.en; }
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
  // quick-pick). Orders = QR order slip. Account = one clean page:
  // Register (email, blinking) + Share + Invite + FAQ. No Kit zone, no
  // separate paid zone (v6.1). Unlock lives only in Account — everywhere
  // else just links there. Views are show/hide only — all sections stay
  // in the DOM, so decode, deep links (#/dish/, #/diet/) and the order
  // slip keep working.
  var VIEW_SECTIONS = ["homeView", "chatView", "chatComposer", "decoder", "qrSection", "dietSection", "drinksSection", "adSection", "citiesSection", "meituanSection", "shareSection", "referral", "faqSection", "subscribe"];
  var VIEWS = {
    home: ["homeView"],
    chat: ["chatView", "chatComposer"],
    search: ["decoder"],
    orders: ["qrSection"],
    cities: ["citiesSection"],
    diet: ["dietSection"],
    drinks: ["drinksSection"],
    account: ["subscribe", "shareSection", "referral", "faqSection"],
    qr: ["qrSection"],
    meituan: ["meituanSection"],
    subscribe: ["subscribe"],
  };
  var SECTION_VIEW = { homeView: "home", chatView: "chat", chatComposer: "chat", decoder: "search", qrSection: "orders", dietSection: "diet", drinksSection: "drinks", adSection: "search", citiesSection: "cities", meituanSection: "meituan", shareSection: "account", referral: "account", faqSection: "account", subscribe: "subscribe" };
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
    // Account view: Register open at the top — no extra tap. The sign-up
    // email input blinks, so the empty field reads as "fill me in".
    if (name === "account") {
      var sb = $("subscribe"); if (sb) sb.open = true;
    }
    // v6.0: Orders opens the QR Order card — the bottom-nav tap used to
    // switch views but leave the card collapsed, so it looked dead.
    if (name === "orders") {
      var q = $("qrSection"); if (q) q.open = true;
    }
    window.scrollTo(0, 0);
    document.querySelectorAll(".bottomnav a").forEach(function (x) {
      x.classList.toggle("active", x.getAttribute("data-view") === name);
    });
    // v6.5: the floating Ask Bun button lives on every view except chat —
    // in chat you're already talking to Bun, and it would sit on top of
    // the composer. Hidden there, visible everywhere else.
    var fb = $("askBunFloat"); if (fb) fb.classList.toggle("hidden", name === "chat");
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
      var t = a.getAttribute("data-goto");
      if (t === "delivery") { goDelivery(); return; }
      gotoSection(t);
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
    else if (/^#\/orders\/delivery/.test(h)) {
      // v6.0: #/orders/delivery[/<dish-id>] — the single delivery entry;
      // dish pages link here instead of keeping their own deep links.
      // Handled here (not in deepLink above) because showView needs
      // VIEWS, which is assigned just before this point.
      var om = h.match(/^#\/orders\/delivery(?:\/([a-z0-9-]+))?/);
      if (om && om[1]) {
        var od = D.dishes.find(function (d) { return d.id === om[1]; });
        if (od) lastDish = od;
      }
      showView("orders");
      setOrderTab("delivery");
      updateDeliveryNote();
      var dp = $("deliveryPanel");
      if (dp) dp.scrollIntoView();
    }
    else if (/^#\/orders/.test(h)) showView("orders");
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
  // 角标 #devBadge、锁文案 .paywall-lock 都在 index.html；
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
    DR: DR, findDrink: findDrink, showDrink: showDrink, addDrinkToOrder: addDrinkToOrder,
    findDish: findDish, findDishBest: findDishBest, suggestDishes: suggestDishes,
    dishMatchesQuery: dishMatchesQuery, askBunAbout: askBunAbout,
    get PRICE_BASIS() { return priceBasis(); }, PRICE_BASIS_SHORT: PRICE_BASIS_SHORT, CITY_TIER: CITY_TIER,
    verdictFor: verdictFor, renderResult: renderResult,
    checkDish: window.checkDish, gotoSection: gotoSection, showView: showView, openFaq: openFaq, goDelivery: goDelivery,
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
