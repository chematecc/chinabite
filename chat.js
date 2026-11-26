// China Bite v4.0 — chat layer. The homepage IS the chat now.
// Bun is the food friend: asks where you are, what you can't eat,
// what you're in the mood for — then answers in bubbles, with rich
// dish cards underneath. Old card sections stay in the DOM as the
// function layer; Bun opens them when the conversation needs them.
//
// ---- LLM hook: sendToAssistant() ----
// It POSTs to the Worker POST /api/chat (SiliconFlow, RAG, SSE).
// No API key ever lives in the browser. If the Worker is unreachable
// or has no key yet (SILICONFLOW_API_KEY not set — Oliver sends the
// key later), we fall back to the local rules bot below and say so
// honestly in the chat status line — never pretend the AI answered.
// To go live with the LLM: set the Worker secret, nothing else changes
// in this file. Model is chosen server-side (Worker env LLM_MODEL).
// API 域名用 bite-api.chinavisacheck.com（Worker 自定义域名路由）：
// workers.dev 生产域名 2026-11-26 14:38 起全站报 404 error code 1042，
// 脚本本身正常（版本预览 URL 200），是生产路由故障，改走自定义域名绕过。
// /api/chat/status 由 CHAT_API 派生（见下），一起跟着走新域名。
(function () {
  "use strict";
  var CB = window.ChinaBite;
  var D = window.CHINABITE_DATA;
  if (!CB || !D) return;
  var CHAT_API = "https://bite-api.chinavisacheck.com/api/chat";
  var PROFILE_KEY = "chinabite_chat_profile_v1";
  var $ = function (id) { return document.getElementById(id); };
  var log = $("chatLog"), chipsBar = $("chatChips"), input = $("chatInput");
  var esc = CB.esc;
  var history = []; // {role, content} text only, last 10 turns, sent to the Worker
  var llmReady = false; // set by /api/chat/status; false = local bot + honest note
  var onboardingStep = null; // null | "city" | "diet" | "craving"
  var profile = loadProfile();

  function loadProfile() {
    try {
      var p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      if (p && typeof p === "object") {
        // v4.3: diet is an ARRAY (multi-select). Migrate the old single
        // string once: "vegetarian" -> ["vegetarian"], "none" -> [] —
        // and write the migrated array back immediately, so localStorage
        // itself holds an array from now on.
        if (typeof p.diet === "string") {
          p.diet = (!p.diet || p.diet === "none") ? [] : [p.diet];
          try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
        }
        if (!Array.isArray(p.diet)) p.diet = [];
        // v5.3 (idiot-friendly): city defaults to Shanghai — the first stop
        // for most visitors. Only when never set (undefined); an explicit
        // "Not in China yet" (null) is kept, never overwritten.
        if (p.city === undefined) p.city = "shanghai";
        return p;
      }
    } catch (e) {}
    return { diet: [] };
  }
  function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {}
  }
  function cityById(id) { return (D.cities || []).find(function (c) { return c.id === id; }) || null; }
  function dishById(id) { return (D.dishes || []).find(function (d) { return d.id === id; }) || null; }
  function cardById(id) { return (D.cards || []).find(function (c) { return c.id === id; }) || null; }
  function usd(cny) { return (cny / D.rate).toFixed(2); }
  function scrollDown() {
    setTimeout(function () { try { window.scrollTo(0, document.body.scrollHeight); } catch (e) {} }, 50);
  }

  // ---- Bubbles ----
  function addBun(html, opts) {
    opts = opts || {};
    var row = document.createElement("div");
    row.className = "msg bun";
    row.innerHTML = '<img class="avatar" src="assets/china-bite-mascot-dumpling-288.webp" alt="Bun">' +
      '<div class="bubble">' + html + "</div>";
    log.appendChild(row);
    if (opts.cards) row.querySelector(".bubble").appendChild(renderCards(opts.cards));
    if (opts.nextSteps) row.querySelector(".bubble").appendChild(renderNextSteps(opts.nextSteps));
    scrollDown();
    return row;
  }
  function addUser(html) {
    var row = document.createElement("div");
    row.className = "msg user";
    row.innerHTML = '<div class="bubble">' + html + "</div>";
    log.appendChild(row);
    scrollDown();
    return row;
  }
  function addTyping() {
    var row = document.createElement("div");
    row.className = "msg bun typing-row";
    row.innerHTML = '<img class="avatar" src="assets/china-bite-mascot-dumpling-288.webp" alt="Bun">' +
      '<div class="bubble typing"><i></i><i></i><i></i></div>';
    log.appendChild(row);
    scrollDown();
    return row;
  }
  function sayLater(html, opts, ms) {
    var t = addTyping();
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
      addBun(html, opts);
    }, ms || 700);
  }

  // ---- Quick-reply chips (horizontal scroll, above the composer) ----
  function renderChips(list) {
    chipsBar.classList.remove("wrap");
    chipsBar.innerHTML = "";
    list.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = c.label;
      b.onclick = function () { c.onClick(); };
      chipsBar.appendChild(b);
    });
    scrollDown();
  }
  function suggestChips() {
    renderChips([
      { label: "Check a dish", onClick: function () { input.focus(); input.placeholder = "Type a dish — try Mapo Tofu"; } },
      { label: "Recommend 3 for me", onClick: function () { handleUserText("Recommend 3 dishes for me"); } },
      { label: "Show my diet card", onClick: function () { handleUserText("Show my diet card"); } },
      { label: "How do I order?", onClick: function () { handleUserText("How do I order with a QR code?"); } }
    ]);
  }

  // ---- Rich dish cards (horizontal scroll, inside a Bun bubble) ----
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
  "liangfen": "assets/dish-liangfen.webp", "liusha-bao": "assets/dish-liushabao.webp", "liuzhou-luoshifen": "assets/dish-liuzhouluoshifen.webp",
  "luobo-gao": "assets/dish-luobogao.webp", "luohan-zhai": "assets/dish-luohanzhai.webp", "mala-gao": "assets/dish-malagao.webp",
  "mala-xiangguo": "assets/dish-malaxiangguo.webp", "malatang": "assets/dish-malatang.webp", "maoxuewang": "assets/dish-maoxuewang.webp",
  "mapo-tofu": "assets/dish-mapodoufu.webp", "mapo-tofu-veg": "assets/dish-mapotofuveg.webp", "nang": "assets/dish-nang.webp",
  "nanjing-yaxue-fensi": "assets/dish-nanjingyaxuefensi.webp", "niurou-mian": "assets/dish-niuroumian.webp", "peking-duck": "assets/dish-pekingduck.webp",
  "qingchao-shishu": "assets/dish-qingchaoshishu.webp", "qingtang-huoguo": "assets/dish-qingtanghuoguo.webp", "regan-mian": "assets/dish-reganmian.webp",
  "roujiamo": "assets/dish-roujiamo.webp", "shao-e": "assets/dish-shaoe.webp", "shaxian-bianrou": "assets/dish-shaxianbianrou.webp",
  "shengjian-bao": "assets/dish-shengjianbao.webp", "shizitou": "assets/dish-shizitou.webp", "shouzhuafan": "assets/dish-shouzhuafan.webp",
  "shuangpi-nai": "assets/dish-shuangpinai.webp", "shuizhu-beef": "assets/dish-shuizhubeef.webp", "shuizhu-fish": "assets/dish-shuizhufish.webp",
  "songshu-guiyu": "assets/dish-songshuguiyu.webp", "steamed-bass": "assets/dish-steamedbass.webp", "suancai-fish": "assets/dish-suancaifish.webp",
  "sweet-sour-ribs": "assets/dish-sweetsourribs.webp", "tangcu-xiaopai": "assets/dish-tangcuxiaopai.webp", "tingzai-zhou": "assets/dish-tingzaizhou.webp",
  "tomato-egg": "assets/dish-tomatoegg.webp", "xiajiao": "assets/dish-xiajiao.webp", "xian-liangpi": "assets/dish-xianliangpi.webp",
  "xianggu-qingcai": "assets/dish-xiangguqingcai.webp", "xiangyou-shanhu": "assets/dish-xiangyoushanhu.webp", "xiaolongbao": "assets/dish-xiaolongbao.webp",
  "xiefen-xiaolong": "assets/dish-xiefenxiaolong.webp", "yangrou-chuan": "assets/dish-yangrouchuan.webp", "yangrou-paomo": "assets/dish-yangroupaomo.webp",
  "yangrou-tang": "assets/dish-yangroutang.webp", "yangzhi-ganlu": "assets/dish-yangzhiganlu.webp", "yangzhou-rice": "assets/dish-yangzhourice.webp",
  "youpo-mian": "assets/dish-youpomian.webp", "yuxiang": "assets/dish-yuxiang.webp", "zhajiang": "assets/dish-zhajiang.webp"
  };
  function dishCardEl(dish) {
    var v = CB.verdictFor(dish);
    var el = document.createElement("div");
    el.className = "chat-dish";
    var img = DISH_IMG[dish.id] ? '<img src="' + DISH_IMG[dish.id] + '" alt="' + esc(dish.en) + '" loading="lazy">' : "";
    el.innerHTML = img + '<div class="cd-body">' +
      '<span class="en">' + esc(dish.en) + '</span>' +
      '<span class="zh">' + esc(dish.zh) + ' · ' + esc(dish.py || "") + '</span>' +
      '<span class="price">¥' + dish.price + ' · ≈$' + usd(dish.price) + ' · Spicy ' + dish.spicy + '/3</span>' +
      '<span class="cd-note">Price is reference only</span>' +
      '<span class="cd-verdict">' + esc(v.t) + " — " + esc(v.why) + '</span>' +
      '<div class="cd-actions">' +
      '<button type="button" data-act="check">Tell me more</button>' +
      '<button type="button" data-act="add">Add to order</button>' +
      '<button type="button" data-act="waiter">Show waiter</button>' +
      "</div></div>";
    el.querySelector('[data-act="check"]').onclick = function () { dishDetail(dish); };
    el.querySelector('[data-act="add"]').onclick = function () {
      CB.addToOrder(dish);
      addBun("Got it — " + esc(dish.en) + " is on your list. Want to add another, or shall I show you the order slip?");
    };
    el.querySelector('[data-act="waiter"]').onclick = function () {
      addBun("Show them this:<p class=\"bigzh\">" + esc(dish.waiter) + "</p><p class=\"small\">" + esc(dish.py || "") + "</p>");
    };
    return el;
  }
  function renderCards(dishes) {
    var wrap = document.createElement("div");
    wrap.className = "chat-cards";
    dishes.forEach(function (d) { if (d) wrap.appendChild(dishCardEl(d)); });
    return wrap;
  }
  // "Next · pick 1 of 3" under a dish verdict (same 3 as the old decoder).
  function renderNextSteps(dish) {
    var wrap = document.createElement("div");
    wrap.className = "next-row";
    var mk = function (label, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "ghost"; b.textContent = label;
      b.onclick = fn;
      wrap.appendChild(b);
    };
    mk("Search on Dianping", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(dish.zh);
      addBun("Copied “" + esc(dish.zh) + "” — paste it in Dianping search. Scores, photos, price per person, that's how you pick a place.");
      if (CB.openFaq) CB.openFaq("faq-dianping"); else CB.gotoSection("faqSection");
    });
    mk("How to order by QR", function () {
      addBun("Scan the table QR, pick dishes, pay first — then they cook. If it won't open, I have a slip the waiter can use. Opening the guide now.");
      CB.gotoSection("qrSection");
    });
    mk("Show diet card to waiter", function () {
      addBun("Here — this one matches what you told me. Opening your diet cards.");
      CB.gotoSection("dietSection");
    });
    return wrap;
  }

  // ---- Dish verdict as a Bun reply ----
  function dishDetail(dish, intro) {
    var v = CB.verdictFor(dish);
    var cls = v.k === "ok" ? "ok" : v.k === "ask" ? "ask" : "no";
    var html = (intro ? esc(intro) + "<br>" : "") +
      '<div class="verdict ' + cls + '">' + esc(v.t) + " — " + esc(dish.en) + " (" + esc(dish.zh) + ")</div>" +
      "<p><b>Here's why:</b> " + esc(v.why) + "</p>" +
      "<p><b>What's in it:</b> " + esc(dish.main) + "</p>" +
      "<p><b>Heads up:</b> " + esc(CB.containsEn(dish)) + "</p>" +
      "<p><b>How hot:</b> " + esc(CB.spiceLabel(dish.spicy)) + "</p>" +
      "<p><b>About:</b> ¥" + dish.price + " · ≈$" + usd(dish.price) + "</p>" +
      "<p class=\"small price-note\">" + esc(CB.PRICE_BASIS) + "</p>" +
      "<p><b>Show them this:</b></p><p class=\"bigzh\">" + esc(dish.waiter) + "</p>" +
      "<p class=\"small\">" + esc(dish.py || "") + "</p>";
    addBun(html, { cards: [dish], nextSteps: dish });
  }

  // ---- Diet card as a Bun reply ----
  function showCard(cardId, intro) {
    var card = cardById(cardId);
    if (!card) return false;
    var html = (intro ? esc(intro) + "<br>" : "") +
      "<p><b>" + esc(card.en) + " · " + esc(card.zh) + "</b></p>" +
      card.lines.map(function (l) { return '<p class="bigzh">' + esc(l) + "</p>"; }).join("") +
      '<p><button type="button" class="ghost" id="chatCardBigBtn">Show big</button></p>';
    var row = addBun(html);
    var btn = row.querySelector("#chatCardBigBtn");
    if (btn) btn.onclick = function () {
      $("cardOverlayText").innerHTML = "<h2>" + esc(card.en) + " · " + esc(card.zh) + "</h2>" +
        card.lines.map(function (l) { return '<p class="bigzh">' + esc(l) + "</p>"; }).join("");
      $("cardOverlay").classList.remove("hidden");
    };
    return true;
  }

  // ---- Recommendations: city must-eat first, then profile-safe picks ----
  function recommendDishes(n) {
    var out = [];
    var seen = {};
    function push(d) {
      if (!d || seen[d.id] || out.length >= n) return;
      if (CB.verdictFor(d).k === "no") return; // never recommend a Skip for this profile
      seen[d.id] = true; out.push(d);
    }
    var city = profile.city ? cityById(profile.city) : null;
    if (city) (city.mustEat || []).forEach(function (m) { push(dishById(m.id)); });
    var pool = D.dishes.slice();
    if (profile.craving === "noodles") pool = pool.filter(function (d) { return CB.dishInCat(d, "noodles"); });
    else if (profile.craving === "rice") pool = pool.filter(function (d) { return CB.dishInCat(d, "rice"); });
    else if (profile.craving === "light") pool = pool.filter(function (d) { return d.spicy <= 1 && CB.verdictFor(d).k === "ok"; });
    pool.forEach(push);
    if (out.length < n) D.dishes.forEach(push);
    return out;
  }
  function recommendReply() {
    var dishes = recommendDishes(3);
    var city = profile.city ? cityById(profile.city) : null;
    var where = city ? " in " + city.en : "";
    var t = addTyping();
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
      addBun("Here's 3 I'd order" + esc(where) + " — all fine for you. Tap one and I'll tell you exactly what's in it.", { cards: dishes });
      suggestChips();
    }, 700);
  }

  function dietLabels() {
    if (!profile.diet.length) return ["No restriction"];
    return profile.diet.map(function (id) {
      var d = DIET_CHIPS.find(function (x) { return x.value === id; });
      return d ? d.label : id;
    });
  }
  function dietSummary() { return dietLabels().join(", "); }

  // ---- Local rules bot (fallback + while the LLM key is not set) ----
  // Match order mirrors the Dashboard support bot: dish > card > FAQ > city.
  var DIET_WORDS = [
    { id: "vegetarian", keys: ["vegetarian", "素食", "veggie"] },
    { id: "vegan", keys: ["vegan", "全素"] },
    { id: "halal", keys: ["halal", "清真", "muslim"] },
    { id: "peanut", keys: ["peanut", "花生"] },
    { id: "shellfish", keys: ["shellfish", "shrimp allergy", "虾蟹", "虾过敏"] },
    { id: "gluten", keys: ["gluten", "麸质"] },
    { id: "egg", keys: ["egg allergy", "蛋过敏"] },
    { id: "dairy", keys: ["dairy", "奶过敏"] },
    { id: "nospicy", keys: ["no spicy", "不吃辣", "not spicy"] },
    { id: "treenut", keys: ["tree nut", "坚果过敏"] },
    { id: "sesame", keys: ["sesame", "芝麻过敏"] },
    { id: "soy", keys: ["soy allergy", "大豆过敏"] }
  ];
  var FAQ = [
    { keys: ["qr", "扫码", "won't open", "wont open", "how do i order", "how to order", "order"], a: "Scan the table QR, pick dishes, pay first — then they cook. If it won't open, show the waiter the order slip and they'll order on their phone. Want me to open the QR guide?", faqId: "faq-qr" },
    { keys: ["alipay", "wechat", "pay", "支付", "cash"], a: "WeChat Pay or Alipay first. Cash at the counter works too.", faqId: "faq-pay" },
    { keys: ["delivery", "外卖", "takeaway", "deliver", "meituan", "美团"], a: "Dianping finds restaurants — scores, photos, price per person. Meituan delivers to your hotel: address in Chinese, and ask the rider to leave it at the front desk. Your hotel card is in the app — want me to open it?", faqId: "faq-delivery" },
    { keys: ["free", "免费", "price", "cost", "kit", "$6.99", "how much"], a: "3 free checks a day. Watch a 5-second ad for +3 more. Paid unlock is $6.99 for 90 days, unlimited, no ads — want a peek at what's inside?", faqId: "faq-free" },
    { keys: ["how does this work", "how does bun work", "how do i use", "what can you do", "faq", "frequently asked", "help"], a: "You ask, I answer — snap the menu, say a dish, or type it. I check it and tell you straight if you can eat it. The longer answers live in the FAQ — want me to open it?", openFaqCard: true },
    { keys: ["find you", "instagram", "tiktok", "where can i find", "social", "follow"], a: "We're #ChinaBite on Instagram, TikTok and X — search any dish name there. Every dish has its own link too.", faqId: "faq-find" },
    { keys: ["invite", "friend", "referral", "share my link"], a: "Share your link — friends get 6 free checks, and you get +3 for each friend who finishes their first check.", faqId: "faq-invite" },
    { keys: ["address", "verified", "where is", "location of"], a: "I don't make up addresses — the city lists show the type of place and the area, not a verified street address. Dianping has the real one.", faqId: "faq-address" },
    { keys: ["hotel card", "hotel address"], a: "Fill it once and copy it whenever you order — hotel name in Chinese plus your room number.", section: "meituanSection" },
    { keys: ["are the prices", "prices exact", "price guide"], a: "Rough guides from 2026-11-26, about ¥7.1 to the dollar. Menus change, so treat them as a ballpark.", faqId: "faq-prices" },
    { keys: ["spicy", "辣", "spice", "hot"], a: "Spice runs 0–3: 0 not spicy, 3 very spicy. If you can't take heat, say so before you order — I'll tell you the number on every dish." },
    { keys: ["halal", "清真"], a: "Look for the green 清真 sign on the door. Ask staff “这是清真吗?” — want me to show you the halal card?" },
    { keys: ["peanut", "花生"], a: "Peanuts hide in Sichuan dishes, noodles and hot pot sauce. Tell the waiter before you order — want the peanut card?" },
    { keys: ["vegetarian", "素食"], a: "Lard, meat stock and oyster sauce hide in veg dishes. Ask first — and keep your vegetarian card handy." }
  ];
  function matchCardId(q) {
    var s = q.toLowerCase();
    for (var i = 0; i < DIET_WORDS.length; i++) {
      if (DIET_WORDS[i].keys.some(function (k) { return s.indexOf(k) >= 0; })) return DIET_WORDS[i].id;
    }
    return null;
  }
  function matchCity(q) {
    var s = q.toLowerCase();
    for (var i = 0; i < (D.cities || []).length; i++) {
      var c = D.cities[i];
      if (s.indexOf(c.en.toLowerCase()) >= 0 || s.indexOf(c.zh) >= 0) return c;
    }
    return null;
  }
  // findDish() matches a bare dish name; chat users type full sentences
  // ("Can I eat mapo tofu?"), so scan the sentence for a dish name too.
  function findDishInText(q) {
    var s = q.toLowerCase();
    var best = null;
    D.dishes.forEach(function (d) {
      if (s.indexOf(d.en.toLowerCase()) >= 0 || q.indexOf(d.zh) >= 0) {
        if (!best || d.en.length > best.en.length) best = d;
      }
    });
    return best;
  }
  function localAnswer(q) {
    var dish = CB.findDish(q) || findDishInText(q);
    if (dish) return { kind: "dish", dish: dish };
    if (/recommend|suggest|hungry|what should i eat|what can i eat|what's good|surprise me|i'm hungry|im hungry/i.test(q)) return { kind: "recommend" };
    // "Show my diet card" — with a multi-select profile, show EVERY
    // selected diet card, not just the first one.
    if (/diet card/i.test(q)) {
      if (profile.diet.length) return { kind: "cards", cardIds: profile.diet.slice() };
      return { kind: "section", section: "dietSection", text: "Here are the diet cards — tap one to show it big to the waiter." };
    }
    var cardId = matchCardId(q);
    if (cardId && /card|show|diet|allergy|vegetarian|vegan|halal|peanut|shellfish|gluten|egg|dairy|spicy/i.test(q)) return { kind: "card", cardId: cardId };
    var city = matchCity(q);
    if (city) return { kind: "city", city: city };
    var s = q.toLowerCase();
    for (var i = 0; i < FAQ.length; i++) {
      if (FAQ[i].keys.some(function (k) { return s.indexOf(k) >= 0; })) return { kind: "faq", text: FAQ[i].a, faqId: FAQ[i].faqId, openFaqCard: FAQ[i].openFaqCard, section: FAQ[i].section };
    }
    if (cardId) return { kind: "card", cardId: cardId };
    if (city) return { kind: "city", city: city };
    return { kind: "unknown", q: q };
  }
  function renderLocal(res) {
    if (res.kind === "dish") {
      dishDetail(res.dish);
      suggestChips();
    } else if (res.kind === "recommend") {
      recommendReply();
    } else if (res.kind === "card") {
      showCard(res.cardId, "Here you go — show this to the waiter, no talking needed.");
      suggestChips();
    } else if (res.kind === "cards") {
      showCard(res.cardIds[0], "Here are yours — show these to the waiter, no talking needed.");
      res.cardIds.slice(1).forEach(function (id) { showCard(id); });
      suggestChips();
    } else if (res.kind === "section") {
      addBun(esc(res.text));
      CB.gotoSection(res.section);
      suggestChips();
    } else if (res.kind === "city") {
      var c = res.city;
      var dishes = (c.mustEat || []).map(function (m) { return dishById(m.id); }).filter(Boolean);
      addBun("<b>" + esc(c.en) + " · " + esc(c.zh) + "</b><br>" + esc(c.scene) +
        "<br><br><b>3 must-eat dishes:</b><br>" + esc(c.tip) +
        "<br><br><b>Getting there:</b> " + esc(c.transport), { cards: dishes });
      suggestChips();
    } else if (res.kind === "faq") {
      var btn = res.faqId ? '<p><button type="button" class="ghost" id="chatFaqBtn">See the full answer →</button></p>'
        : res.openFaqCard ? '<p><button type="button" class="ghost" id="chatFaqBtn">Open the FAQ →</button></p>'
        : res.section ? '<p><button type="button" class="ghost" id="chatFaqBtn">Open it →</button></p>' : "";
      var row = addBun(esc(res.text) + btn);
      var fb = row.querySelector("#chatFaqBtn");
      if (fb && res.faqId) fb.onclick = function () { if (CB.openFaq) CB.openFaq(res.faqId); else CB.gotoSection("faqSection"); };
      else if (fb && res.openFaqCard) fb.onclick = function () { CB.gotoSection("faqSection"); };
      else if (fb && res.section) fb.onclick = function () { CB.gotoSection(res.section); };
      suggestChips();
    } else {
      var sug = recommendDishes(3);
      addBun("Hmm, not on my list yet — I know 110 dishes, and that one isn't one of them. Yet.<br>I saved it on your phone, and we'll add it.<br>Meanwhile, here are 3 safe bets:", { cards: sug });
      suggestChips();
    }
  }

  // The Worker streams raw SiliconFlow SSE (no metadata event), so the
  // rich cards come from matching dish names inside the answer text.
  function dishesFromText(text) {
    var found = [], seen = {};
    D.dishes.forEach(function (d) {
      if (seen[d.id]) return;
      if (text.indexOf(d.en) >= 0 || text.indexOf(d.zh) >= 0) { seen[d.id] = true; found.push(d); }
    });
    return found.slice(0, 3);
  }
  // Returns {text, dishes:[ids], cardId, cityId, source:"llm"} or throws.
  function callWorkerLLM(text) {
    var msgs = history.slice(-10).concat([{ role: "user", content: text }]);
    return fetch(CHAT_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: msgs, profile: profile, lang: "en", stream: true })
    }).then(function (r) {
      if (!r.ok || !r.body) throw new Error("worker-" + r.status);
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      var out = "";
      var meta = null;
      var row = null;
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) return { text: out, meta: meta };
          buf += decoder.decode(x.value, { stream: true });
          var parts = buf.split("\n\n");
          buf = parts.pop();
          parts.forEach(function (part) {
            var line = part.trim();
            if (line.indexOf("data:") !== 0) return;
            var data = line.slice(5).trim();
            if (data === "[DONE]") return;
            try {
              var j = JSON.parse(data);
              if (j.done) { meta = j; return; }
              if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) {
                out += j.choices[0].delta.content;
                if (row) row.querySelector(".bubble").textContent = out;
              }
            } catch (e) {}
          });
          return pump();
        });
      }
      row = addBun("");
      row.querySelector(".bubble").textContent = "…";
      return pump().then(function (res) {
        if (row.parentNode) row.parentNode.removeChild(row);
        if (!res.text.trim()) throw new Error("empty-llm");
        return { text: res.text.trim(), dishes: dishesFromText(res.text), source: "llm" };
      });
    });
  }
  function sendToAssistant(text) {
    // THE hook for the LLM. Swap the provider by changing the Worker
    // (env LLM_MODEL / SILICONFLOW_API_KEY) — this file stays the same.
    // Any failure (no key, Worker down, stream error) falls back to the
    // local rules bot; the caller tells the user honestly.
    return callWorkerLLM(text).catch(function () { return null; });
  }

  function handleUserText(text) {
    text = (text || "").trim();
    if (!text) return;
    addUser(esc(text));
    history.push({ role: "user", content: text });
    if (history.length > 10) history = history.slice(-10);
    input.value = "";
    var t = addTyping();
    sendToAssistant(text).then(function (res) {
      if (t.parentNode) t.parentNode.removeChild(t);
      if (res && res.text) {
        history.push({ role: "assistant", content: res.text });
        var dishes = (res.dishes || []).map(dishById).filter(Boolean);
        var row = addBun(esc(res.text), { cards: dishes.length ? dishes : null });
        if (res.cardId) showCard(res.cardId);
        if (res.cityId) { var c = cityById(res.cityId); if (c) addBun("<b>" + esc(c.en) + " · " + esc(c.zh) + "</b><br>" + esc(c.scene)); }
        suggestChips();
        return row;
      }
      // Fallback: local rules bot (no key yet, or Worker unreachable).
      renderLocal(localAnswer(text));
    });
  }

  // ---- Onboarding: 3 questions, chips, no typing ----
  var CITY_CHIPS = (D.cities || []).map(function (c) { return { label: c.en, value: c.id }; });
  var DIET_CHIPS = [
    { label: "No restriction", value: "none" },
    { label: "Vegetarian", value: "vegetarian" },
    { label: "Vegan", value: "vegan" },
    { label: "Halal", value: "halal" },
    { label: "Peanut allergy", value: "peanut" },
    { label: "Shellfish allergy", value: "shellfish" },
    { label: "Gluten-free", value: "gluten" },
    { label: "No spicy", value: "nospicy" }
  ];
  var CRAVE_CHIPS = [
    { label: "Noodles 🍜", value: "noodles" },
    { label: "Rice 🍚", value: "rice" },
    { label: "Something light", value: "light" },
    { label: "Surprise me", value: "surprise" }
  ];
  // v5.3 (idiot-friendly): the 3 questions are never a wall. One tap on
  // "Skip — just ask" fills the defaults (Shanghai, no restriction,
  // surprise me) and goes straight to asking. Defaults are pre-filled,
  // never mandatory; "My tastes" changes them anytime.
  function skipOnboarding(label) {
    if (!profile.city) profile.city = "shanghai";
    if (!Array.isArray(profile.diet)) profile.diet = [];
    profile.craving = profile.craving || "surprise";
    profile.done = true;
    saveProfile();
    CB.setProfile(profile.diet);
    onboardingStep = null;
    addUser(esc(label || "Skip — just ask"));
    sayLater("Got it — Shanghai · no restrictions · surprise me. You can change it anytime with “My tastes” up top.", null, 600);
    setTimeout(suggestChips, 1400);
  }
  function askCity() {
    onboardingStep = "city";
    sayLater("Hey, I'm Bun — your food friend in China. I know 110 dishes, 12 diet cards and 10 cities, and I'll tell you in 3 seconds if you can eat something.<br><br>First — where are you eating?", null, 600);
    setTimeout(function () {
      var list = CITY_CHIPS.concat([{ label: "Not in China yet", value: null }]).map(function (c) {
        return { label: c.label, onClick: function () { pickCity(c.value, c.label); } };
      });
      list.push({ label: "Skip — just ask", onClick: function () { skipOnboarding("Skip — just ask"); } });
      renderChips(list);
    }, 1400);
  }
  function pickCity(id, label) {
    addUser(esc(label));
    profile.city = id;
    saveProfile();
    onboardingStep = "diet";
    sayLater(id ? "Nice — " + esc(label) + ". Good eating there." : "No worries — we'll keep it general for now.", null, 600);
    setTimeout(askDiet, 1400);
  }
  // v4.3: diet is MULTI-SELECT — tap all that apply, then Done.
  // "No restriction" is exclusive: tapping it clears the rest, tapping
  // anything else clears it. Chips wrap (not a scroll row) so Done is
  // always visible without scrolling.
  function isDietSelected(v) { return v === "none" ? profile.diet.length === 0 : profile.diet.indexOf(v) >= 0; }
  function renderDietChips() {
    chipsBar.classList.add("wrap");
    chipsBar.innerHTML = "";
    DIET_CHIPS.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = c.label;
      b.setAttribute("aria-pressed", isDietSelected(c.value) ? "true" : "false");
      b.onclick = function () { toggleDiet(c.value); };
      chipsBar.appendChild(b);
    });
    var done = document.createElement("button");
    done.className = "chip chip-done"; done.type = "button"; done.textContent = "Done — that's me ✓";
    done.onclick = confirmDiet;
    chipsBar.appendChild(done);
    var skip = document.createElement("button");
    skip.className = "chip"; skip.type = "button"; skip.textContent = "Skip the rest →";
    skip.onclick = function () { skipOnboarding("Skip the rest →"); };
    chipsBar.appendChild(skip);
    scrollDown();
  }
  function toggleDiet(v) {
    if (v === "none") profile.diet = [];
    else {
      var i = profile.diet.indexOf(v);
      if (i >= 0) profile.diet.splice(i, 1); else profile.diet.push(v);
    }
    saveProfile();
    renderDietChips();
  }
  function askDiet() {
    addBun("Anything I should watch out for? Tap all that apply, then hit Done.");
    renderDietChips();
  }
  function confirmDiet() {
    addUser(esc(dietSummary()));
    CB.setProfile(profile.diet);
    saveProfile();
    onboardingStep = "craving";
    sayLater("Got it — " + esc(dietSummary()) + ". I'll remember that.", null, 600);
    setTimeout(function () {
      addBun("Last one — what are you in the mood for?");
      renderChips(CRAVE_CHIPS.map(function (c) {
        return { label: c.label, onClick: function () { pickCraving(c.value, c.label); } };
      }));
    }, 1400);
  }
  function pickCraving(value, label) {
    addUser(esc(label));
    profile.craving = value;
    profile.done = true;
    saveProfile();
    onboardingStep = null;
    var city = profile.city ? cityById(profile.city) : null;
    var dietLabel = dietSummary();
    sayLater("Done — " + (city ? esc(city.en) : "China") + " · " + esc(dietLabel) + " · " + esc(label) + ". Saved on your phone, change it anytime with “My tastes” up top.", null, 600);
    setTimeout(function () { recommendReply(); }, 1400);
  }
  function welcomeBack() {
    var city = profile.city ? cityById(profile.city) : null;
    sayLater("Hey, welcome back — still in " + (city ? esc(city.en) : "China") + "? Ask me anything, or tap one below.", null, 500);
    setTimeout(suggestChips, 1200);
  }

  // ---- Composer: text + voice + camera ----
  function submitInput() {
    var v = input.value;
    if (!v.trim()) return;
    if (onboardingStep) { // during onboarding, free text still works as a question
      handleUserText(v);
      return;
    }
    handleUserText(v);
  }
  $("chatSendBtn").onclick = submitInput;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") submitInput(); });

  $("chatVoiceBtn").onclick = function () {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      addBun("Voice typing doesn't work in this browser yet — iOS Safari doesn't offer it. Type it instead, it takes 3 seconds. (Voice is built into the App later.)");
      return;
    }
    addBun("Listening… say the dish name.");
    CB.speakInto(input, null, function (said) { if (said && said.trim()) handleUserText(said); });
  };
  var photoInput = $("chatPhotoInput");
  $("chatCameraBtn").onclick = function () { photoInput.click(); };
  photoInput.addEventListener("change", function () {
    var f = photoInput.files && photoInput.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var row = document.createElement("div");
      row.className = "msg user";
      row.innerHTML = '<div class="bubble msg-photo"><img src="' + reader.result + '" alt="Menu photo"></div>';
      log.appendChild(row);
      scrollDown();
      var t = addTyping();
      CB.recognizePhoto(f).then(function (res) {
        if (t.parentNode) t.parentNode.removeChild(t);
        if (res.dish) {
          history.push({ role: "user", content: "[photo] " + res.dish.en });
          dishDetail(res.dish, "That looks like " + res.dish.en + " — checking it for you.");
          suggestChips();
        } else {
          addBun("Hmm, I couldn't quite read that photo — no guessing. Tap a dish below and I'll tell you in 3 seconds.", { cards: recommendDishes(3) });
          suggestChips();
        }
      });
    };
    reader.readAsDataURL(f);
    photoInput.value = "";
  });

  // ---- "My tastes": redo the 3 questions ----
  // v4.3: keep the saved profile and PRE-FILL it — the diet step shows
  // the current selections checked, so this is editing, not starting over.
  $("chatTastesBtn").onclick = function () {
    log.innerHTML = "";
    askCity();
  };

  // ---- AI status: honest, one line under Bun's name ----
  function checkAiStatus() {
    var el = $("chatAiStatus");
    var done = function (ready) {
      llmReady = ready;
      el.textContent = ready
        ? "Bun · AI connected — ask me anything"
        : "AI coming soon";
    };
    try {
      var ctrl = new AbortController();
      var to = setTimeout(function () { ctrl.abort(); }, 5000);
      fetch(CHAT_API.replace("/api/chat", "/api/chat/status"), { signal: ctrl.signal })
        .then(function (r) { clearTimeout(to); return r.ok ? r.json() : null; })
        .then(function (j) { done(!!(j && j.configured)); })
        .catch(function () { done(false); });
    } catch (e) { done(false); }
  }

  // ---- Start ----
  CB.setProfile(profile.diet || []);
  checkAiStatus();
  if (profile.done) welcomeBack();
  else askCity();
})();
