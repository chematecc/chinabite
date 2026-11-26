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
      "<p><b>Show them this:</b></p><p class=\"bigzh\">" + esc(dish.waiter) + "</p>" +
      "<p class=\"small\">" + esc(dish.py) + "</p>" +
      '<button type="button" id="addOrderBtn">Add to order</button> ' +
      '<button type="button" class="ghost" id="shareDishBtn">Share</button>' +
      '<details class="subcard"><summary>Next · pick 1 of 3</summary>' +
      '<div class="next-steps">' +
      '<button type="button" id="nextDianpingBtn">Search on Dianping</button>' +
      '<button type="button" class="ghost" id="nextQrBtn">How to order by QR</button>' +
      '<button type="button" class="ghost" id="nextCardBtn">Show diet card to waiter</button></div></details>' +
      "<p><b>Dianping:</b> Tap \"Search on Dianping\" — I've copied the name for you. Just paste it in Dianping.</p>" +
      "<p><b>Getting it delivered?</b> The name's already copied — paste it in Meituan. Your hotel card is waiting in the Meituan section.</p>";
    $("addOrderBtn").onclick = function () { addToOrder(dish); };
    $("shareDishBtn").onclick = function () { shareDish(dish, v); };
    $("nextDianpingBtn").onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(dish.zh);
      openFaq("faq-dianping");
    };
    $("nextQrBtn").onclick = function () { gotoSection("qrSection"); };
    $("nextCardBtn").onclick = function () { gotoSection("dietSection"); };
    updateCounts();
  }

  function findDish(q) {
    q = (q || "").trim();
    if (!q) return null;
    var exact = D.dishes.find(function (d) { return d.zh === q || d.en.toLowerCase() === q.toLowerCase(); });
    if (exact) return exact;
    return D.dishes.find(function (d) { return d.zh.indexOf(q) >= 0 || d.en.toLowerCase().indexOf(q.toLowerCase()) >= 0; }) || null;
  }

  function decode() {
    var q = $("dishInput").value;
    var dish = findDish(q);
    if (!dish) {
      if (q.trim()) {
        state.unknown.push({ q: q.trim(), at: new Date().toISOString() });
        save();
      }
      $("result").className = "subcard";
      $("result").innerHTML = "<div class=\"verdict ask\">Hmm, not on my list yet</div>" +
        "<p>I know " + D.dishes.length + " dishes — and this one isn't one of them. Yet.</p>" +
        "<p>I saved it on your phone, and we'll add it.</p>" +
        "<p>Meanwhile, snap the menu — and watch out for lard, stock and oyster sauce. They hide everywhere.</p>";
      return;
    }
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
  $("decodeBtn").onclick = decode;
  $("dishInput").addEventListener("keydown", function (e) { if (e.key === "Enter") decode(); });

  // Quick-pick dish list (110) — Uber Eats-style rows, English first.
  // Re-rendered by the top search bar and the category chips (v3.2).
  var SIGNATURE_IDS = ["dandan-mian", "mapo-tofu", "huiguo-pork", "shao-e", "xiajiao", "changfen", "shengjian-bao", "xiefen-xiaolong", "hongshao-rou"];
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
  function renderDishList(cat, q) {
    currentCat = cat || "all";
    q = (q || "").trim().toLowerCase();
    listEl.innerHTML = "";
    var shown = 0;
    D.dishes.forEach(function (d) {
      if (!dishInCat(d, currentCat)) return;
      if (q && d.en.toLowerCase().indexOf(q) < 0 && d.zh.indexOf(q) < 0 && (d.py || "").toLowerCase().indexOf(q) < 0) return;
      shown++;
      var b = document.createElement("button");
      b.className = "dish"; b.type = "button";
      b.innerHTML = '<span class="en">' + esc(d.en) + '</span><br><span class="zh">' + esc(d.zh) + " · ¥" + d.price + " · ≈$" + usd(d.price) + " · Spice " + d.spicy + "/3</span>";
      b.onclick = function () { $("dishInput").value = d.zh; decode(); $("decoder").scrollIntoView(); };
      listEl.appendChild(b);
    });
    if (!shown) listEl.innerHTML = "<p class=\"muted\">Nothing matches that — try All, or just say it out loud.</p>";
    return shown;
  }
  renderDishList("all", "");

  // ---- Top search bar + category chips (v3.2, Uber Eats-style) ----
  var CATS = [["all", "All"], ["signature", "Signature"], ["noodles", "Noodles"], ["dumplings", "Dumplings"], ["spicy", "Spicy"], ["veg", "Veg"], ["halal", "Halal"], ["soup", "Soup"], ["rice", "Rice"]];
  var chipsEl = $("catChips");
  if (chipsEl) {
    CATS.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = c[1];
      b.setAttribute("aria-pressed", c[0] === "all" ? "true" : "false");
      b.onclick = function () {
        Array.prototype.forEach.call(chipsEl.children, function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        if (c[0] === "signature") {
          showView("dishes");
          var sd = $("storyDishes"); if (sd) { sd.open = true; sd.scrollIntoView({ behavior: "smooth", block: "start" }); }
          return;
        }
        renderDishList(c[0], ($("topSearch") || { value: "" }).value);
        showView("dishes");
        var pk = $("dishPicker"); if (pk) { pk.open = true; pk.scrollIntoView({ behavior: "smooth", block: "start" }); }
      };
      chipsEl.appendChild(b);
    });
  }
  var topSearch = $("topSearch");
  if (topSearch) {
    topSearch.addEventListener("input", function () { renderDishList(currentCat, topSearch.value); });
    topSearch.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var d = findDish(topSearch.value);
      if (d) { $("dishInput").value = d.zh; showView("dishes"); decode(); }
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
    if (!state.order.length) { el.innerHTML = "<p class=\"muted\">Nothing here yet — check a dish first, then add it.</p>"; }
    else {
      el.innerHTML = state.order.map(function (x) {
        var d = D.dishes.find(function (dd) { return dd.id === x.id; });
        return "<p>• " + esc(d.en) + " (" + esc(d.zh) + ") × " + x.qty + " — ¥" + (d.price * x.qty) + "</p>";
      }).join("");
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
    $("slipPreview").innerHTML =
      "<p class=\"bigzh\">您好，请帮我用你们的手机下单，谢谢！</p>" +
      "<p class=\"bigzh\">桌号：" + esc(tableNo) + " &nbsp; 人数：" + esc(people) + "</p>" +
      (lines.length ? "<p class=\"bigzh\">" + esc(lines.join("<br>")) + "</p>" : "<p class=\"muted\">(Add dishes to your list in the decoder first.)</p>") +
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
  // 开发站是纯静态 Pages，没有 Worker。订阅接口在 Dashboard Worker
  // china-bite-dashboard 的 /api/subscribe（见 subscribe.js 的部署路径说明）。
  // 该 Worker 2026-11-26 查过还不存在：fetch 失败时如实提示，并把邮箱
  // 存在本机待同步队列，不假装已订阅成功。
  var SUBSCRIBE_API = "https://china-bite-dashboard.cc-chemate.workers.dev/api/subscribe";
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

  // ---- App mode nav: views (v4.0 — homepage IS the chat) ----
  // v4.0: homepage = chat with Bun. No hero, no card-list homepage.
  // Old sections stay in the DOM as the function layer behind the chat;
  // Bun opens them via gotoSection() when the conversation needs them.
  // Views are show/hide only — all sections stay in the DOM, so decode,
  // deep links (#/dish/, #/diet/) and the order slip keep working.
  var VIEW_SECTIONS = ["chatView", "chatComposer", "searchBar", "catChips", "decoder", "storyDishes", "qrSection", "dietSection", "adSection", "kitPreview", "citiesSection", "meituanSection", "kitSection", "referral", "faqSection", "subscribe"];
  var VIEWS = {
    chat: ["chatView", "chatComposer"],
    dishes: ["searchBar", "catChips", "decoder", "storyDishes"],
    cities: ["citiesSection"],
    diet: ["dietSection"],
    account: ["kitPreview", "kitSection", "subscribe", "referral", "faqSection"],
    qr: ["qrSection"],
    meituan: ["meituanSection"],
    subscribe: ["subscribe"],
  };
  var SECTION_VIEW = { chatView: "chat", chatComposer: "chat", searchBar: "dishes", catChips: "dishes", decoder: "dishes", storyDishes: "dishes", qrSection: "qr", dietSection: "diet", adSection: "dishes", kitPreview: "account", citiesSection: "cities", meituanSection: "meituan", kitSection: "account", referral: "account", faqSection: "account", subscribe: "subscribe" };
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
    // Dishes view: signature dishes open so the list shows them.
    var story = $("storyDishes");
    if (story) story.open = (name === "dishes");
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
  // Tapping a dish anywhere (signature card, city must-eat, deep link)
  // must switch to the decode view FIRST, otherwise the verdict would
  // render inside the hidden decoder and the user would see nothing.
  window.checkDish = function (zh) {
    $("dishInput").value = zh;
    showView("dishes");
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
  var appTitle = $("appTitle");
  if (appTitle) {
    var goHome = function () { showView("chat"); };
    appTitle.addEventListener("click", goHome);
    appTitle.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHome(); } });
  }
  // First paint: chat, unless a deep link asked for a dish or diet card.
  (function initView() {
    var h = location.hash || "";
    if (/^#\/diet\//.test(h)) showView("diet");
    else if (/^#\/dish\//.test(h)) showView("dishes");
    else showView("chat");
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
    // ---- v4.0: minimal public API for the chat layer (chat.js) ----
  // The chat is the homepage now; it answers through these, so the
  // verdict / order / voice / OCR logic stays in one place (here).
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
    findDish: findDish, verdictFor: verdictFor, renderResult: renderResult,
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
