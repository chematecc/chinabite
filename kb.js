// Jade Bite — Knowledge Base v1 (v6.6 pending).
// ONE place for the know-how Bun answers from. Ask Bun consults this
// FIRST — before any external LLM call (Oliver's rule, 2026-11-27:
// external LLM tokens are used ONLY when the KB cannot satisfy the
// request). Priority in KB.answer():
//   1. dish (strict match, same rules as the decoder — exact/alias/
//      pinyin/contains, never a fuzzy auto-judge)
//   2. drink — only when the question is a drink REQUEST (want / get /
//      order / iced / cold / how much / price). A question ABOUT drinks
//      ("why is my beer warm?") goes to the KB entries, not the drink card.
//   3. diet card — explicit "show my card" / allergy mention
//   4. city — a question naming one of the 10 cities
//   5. KB topical entry — score >= 55 AND >= 5 clear of the runner-up
//      (exact phrase 100, substring 75, token overlap up to 65)
//   6. recommend ("recommend 3", "what should I eat")
//   -> null means "KB cannot satisfy this" -> external LLM (last resort),
//      grounded on snippetsFor() when anything topically matches.
// Every KB answer carries its source id (kb:<id>, dish:<id>, ...) for
// debugging — the source is NOT shown to the user.
//
// Sources: ONLY the site's own verified content. Dishes (125), drinks
// (21), diet cards (12) and cities (10) are REFERENCED by id — never
// copied here; data.js / drinks.js stay the single source of truth.
// The 18 entries below are the KB-only consolidation of the scattered
// know-how: the 14 FAQ answers + ordering phrases, delivery/payment
// steps, drinks-temperature rules and diet-asking guidance that used to
// live in index.html FAQ, chat.js FAQ, app.js and the Drinks section.
// SYNC POINT: index.html #faqSection mirrors these answers in display
// copy. If an answer changes here, change it there too (future: render
// the FAQ from this file so there is literally one copy).
// No invented facts: no new dishes, prices, addresses or phone numbers.
// Addresses are never given — the KB says so, same as the site.
(function () {
  "use strict";
  var D = window.CHINABITE_DATA;
  var DR = window.CHINABITE_DRINKS;
  var CB = window.JadeBite;
  if (!D) return;

  // ---- Normalizer: mirrors app.js normStr() (same rules, kept in sync).
  // Lowercase, tone marks stripped, full-width folded, all spaces and
  // punctuation dropped — so "麻婆豆付", "Mapo Tofu" and "mapo doufu"
  // all reduce to comparable keys.
  function kbNorm(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\p{P}\u3000-\u303F]/gu, "");
  }
  function stripParen(s) { return String(s || "").replace(/[(（][^)）]*[)）]/g, ""); }
  function normTokens(s) {
    // Latin words (len >= 2) + each CJK char as its own token.
    // Apostrophes are dropped first, so "won't" tokenizes as "wont"
    // (matching the keys) instead of "won" + "t".
    var t = String(s || "").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "");
    var words = t.replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim().split(" ").filter(function (w) { return w.length >= 2; });
    var out = [];
    words.forEach(function (w) {
      if (/[\u4e00-\u9fff]/.test(w)) { w.split("").forEach(function (c) { out.push(c); }); }
      else out.push(w);
    });
    return out;
  }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  // ---- Entries ----
  // answer: plain string, or build() for answers composed at runtime
  // from the single source of truth (never a second copy of the data).
  // action: { section, label } — a button that opens the matching
  // section (same destinations the FAQ buttons already use).
  var ENTRIES = [
    { id: "kb-qr", type: "faq", title: "How do I order with a QR code?",
      keys: ["qr", "qr code", "qrcode", "扫码", "scan qr", "scan the code", "scan the qr", "how do i order", "how to order", "order with qr", "order by qr", "ordering", "how do you order", "how do we order"],
      build: function () {
        var steps = (D.qrButtons || []).filter(function (b) {
          return ["加入购物车", "选规格", "提交订单", "去支付"].indexOf(b.zh) >= 0;
        }).map(function (b, i) { return (i + 1) + ". " + b.zh + " — " + b.en + "."; }).join(" ");
        return "Scan the QR code on the table — most restaurants work this way. " + steps +
          " The table number (桌号) is on the table or the QR stand. 备注 is the note box — that's where you write 'no spicy' or 'no peanuts' in Chinese. If the code won't open, the slip in Orders does the ordering for you.";
      },
      action: { section: "qrSection", label: "Open QR Order" } },
    { id: "kb-qr-fail", type: "faq", title: "What if the QR code won't open?",
      keys: ["qr wont open", "qr won't open", "qr not working", "code wont open", "code won't open", "qr fails", "qr failed", "cant open qr", "can't open qr", "cant scan", "can't scan", "qr code wont open", "qr code won't open"],
      answer: "Don't wait — the QR Order card in Orders has the backup plan: the slip does the ordering for you. Show it to the waiter, no talking needed.",
      action: { section: "qrSection", label: "Open QR Order" } },
    { id: "kb-dianping", type: "faq", title: "Dianping or Meituan — what's the difference?",
      keys: ["dianping", "meituan", "difference", "dianping or meituan", "meituan or dianping", "点评", "美团", "what is dianping", "what is meituan"],
      answer: "Both do delivery. Meituan is the delivery app; Dianping is for finding restaurants and reading reviews. The Delivery tab in Orders explains it where you use it — with the buttons and your hotel card.",
      action: { section: "delivery", label: "Open Delivery" } },
    { id: "kb-delivery", type: "faq", title: "How do I get food delivered to my hotel?",
      keys: ["delivery", "delivered", "deliver", "外卖", "takeaway", "takeout", "take out", "deliver to hotel", "hotel delivery", "order delivery", "food delivery", "how do i get food delivered", "get food delivered", "delivery to my hotel"],
      answer: "The Delivery tab in Orders has the whole flow — the steps, the Meituan / Dianping buttons, and your hotel card with the address in Chinese. You need a login for delivery — a +86 number.",
      action: { section: "delivery", label: "Open Delivery" } },
    { id: "kb-phone", type: "faq", title: "Do I need a Chinese phone number?",
      keys: ["chinese phone number", "phone number", "+86", "sim card", "chinese sim", "phone", "do i need a chinese phone", "need a phone number", "phone number needed"],
      answer: "Not to look around. Without a +86 number you can still browse lists, see photos, check prices and save places offline. You need a login for delivery, queue numbers and group vouchers. Buttons can switch to English — names, menus and reviews stay Chinese." },
    { id: "kb-pay", type: "faq", title: "How do I pay?",
      keys: ["how do i pay", "how to pay", "payment", "pay", "alipay", "wechat pay", "wechatpay", "cash", "支付", "pay first", "pay after", "can i pay with card", "pay by card", "how do you pay", "how do we pay"],
      answer: "WeChat Pay or Alipay first. Cash at the counter works too. Fast food: pay first. Sit-down: pay after. Tableware is often ¥1–5 per person, extra." },
    { id: "kb-free", type: "faq", title: "How many free checks do I get?",
      keys: ["free checks", "free", "免费", "how many free", "free check", "free decodes", "how much is it", "is it free", "is this free", "free to use"],
      answer: "3 free checks a day. A friend's link gets you 6. Watch a 5-second ad for +3 more, up to 5 ads a day. Paid unlock is $6.99 for 90 days — see Register in Account." },
    { id: "kb-kit", type: "faq", title: "What do I get when I pay $6.99?",
      keys: ["what do i get", "6.99", "$6.99", "worth it", "what's included", "what is included", "unlock", "paid unlock", "kit include", "what do you get", "what does it include"],
      answer: "One payment, 90 days: 125 dishes with photos, 12 diet cards, 10 cities. Unlimited checks, no ads. What's included — and whether payments are open yet — is in the Register card in Account." },
    { id: "kb-cost", type: "faq", title: "How much does a dish cost?",
      keys: ["how much does it cost", "how much does a dish cost", "what does it cost", "what's the price", "what is the price", "how much is this dish", "how much", "cost", "price", "how expensive", "dish price", "price of", "多少钱", "价格", "贵吗", "收费吗"],
      answer: "We don't list prices — they change too fast to keep right. Check the menu, or look the dish up on Dianping before you order." },
    { id: "kb-invite", type: "faq", title: "How does inviting friends work?",
      keys: ["invite", "inviting", "referral", "refer", "friend", "share my link", "share link", "invite friends", "inviting friends", "how does inviting work"],
      answer: "Your link gives friends 6 free checks, and you get +3 for each friend who finishes their first check. Honest note: there's no server checking this yet, so sharing isn't the same as a verified invite. Your Invite card in Account has the link." },
    { id: "kb-address", type: "faq", title: "Are the restaurant addresses verified?",
      keys: ["address", "addresses", "verified", "street address", "where is the restaurant", "location", "where exactly", "are addresses verified", "restaurant address", "exact address"],
      answer: "No. The city lists show the type of place and the area — not a verified street address. Dianping has the real one." },
    { id: "kb-find", type: "faq", title: "Where can I find you?",
      keys: ["instagram", "tiktok", "follow", "social", "find you", "where can i find", "facebook", "where are you", "social media"],
      answer: "We're #JadeBite on Instagram, TikTok and X — search any dish name there. Every dish has its own page too: chinabite.chinavisacheck.com/dish/mapo-tofu/" },
    { id: "kb-drinks-warm", type: "faq", title: "Why is my beer warm?",
      keys: ["warm beer", "beer warm", "my beer is warm", "beer is warm", "warm drink", "why is my beer", "why is my beer warm", "啤酒温", "beer not cold", "beer is not cold"],
      answer: "Short answer: that's normal here — not a mistake. Drinks arrive at room temperature unless you ask. For iced beer say 冰镇啤酒. The full phrase list is in Drinks & Beer — open it from Orders.",
      action: { section: "drinksSection", label: "Open Drinks & Beer" } },
    { id: "kb-drinks-temp", type: "howto", title: "How do I ask for a cold drink?",
      keys: ["iced", "cold drink", "ice cold", "冰镇", "冰的", "加冰", "how to order a drink", "cold beer", "iced beer", "iced tea", "drink cold", "temperature", "ice-cold beer", "ask for iced", "order a drink"],
      answer: "Drinks arrive at room temperature unless you ask. Say: 冰镇啤酒 (ice-cold beer), 冰的 (iced / cold), 加冰 (with ice), 常温 (room temperature), 不要冰 (no ice), 热的 (hot). Beer: ask 冰镇. Tea: hot by the pot. Baijiu: never iced.",
      action: { section: "drinksSection", label: "Open Drinks & Beer" } },
    { id: "kb-diet-ask", type: "howto", title: "What do I say about my allergy?",
      keys: ["allergy", "allergic", "allergies", "ask the waiter", "ask staff", "can i eat this", "is it safe", "safe to eat", "food allergy", "i have an allergy", "what do i say"],
      answer: "Tell the waiter before you order — and show your diet card. It says it in big Chinese, no talking needed. If you're not sure a dish is safe, ask first: the card has the exact sentence. Your diet cards are in the Diet Cards section.",
      action: { section: "dietSection", label: "Open diet cards" } },
    { id: "kb-spicy", type: "howto", title: "How spicy is it?",
      keys: ["spicy", "spice", "spice level", "how spicy", "hot food", "辣", "is it spicy", "too spicy", "mild", "not spicy", "less spicy", "spiciness"],
      answer: "Spice runs 0–3: 0 not spicy, 3 very spicy. Every dish shows its number. If you can't take heat, say so before you order — 不辣 (not spicy) or 微辣 (mild)." },
    { id: "kb-hotel-card", type: "howto", title: "What is the hotel card?",
      // NOTE: no bare "hotel" / "my hotel" key — "Book me a hotel"
      // must NOT match this entry (booking a hotel is not the hotel
      // card). Only the card itself matches.
      keys: ["hotel card", "hotel address", "hotel address card", "where i stay", "show my hotel"],
      answer: "The hotel card holds it — your hotel name in Chinese plus your room number. Show it to a taxi driver or delivery rider. It's in Orders → Delivery.",
      action: { section: "delivery", label: "Open Delivery" } },
    { id: "kb-how", type: "faq", title: "How does Bun work?",
      keys: ["how does bun work", "how does this work", "how do i use", "what can you do", "help", "faq", "frequently asked", "what is jade bite", "how does it work"],
      answer: "You ask, I answer — snap the menu, say a dish, or type it. I check it and tell you straight if you can eat it. I know 125 dishes, 12 diet cards and 10 cities. The longer answers live in the FAQ — want me to open it?",
      action: { section: "faqSection", label: "Open the FAQ" } }
  ];

  // ---- Scoring ----
  // exact phrase 100 · substring 75 · token overlap up to 65.
  // Token score: (matched / key tokens) * 50 + 5 per matched token
  // (max 15) — so a full 3-token key (65) beats a 1-token key (55),
  // which is what separates "QR won't open" from a bare "QR".
  // entryScoreFull also returns bestKeyLen (the longest key that
  // produced the score): when two sibling entries tie on score, the
  // more specific one wins — "QR code won't open" (14 chars) beats
  // "QR code" (6 chars) for kb-qr-fail over kb-qr.
  function entryScoreFull(entry, nq, qTokens) {
    var best = 0, bestKeyLen = 0;
    (entry.keys || []).forEach(function (k) {
      var nk = kbNorm(k);
      if (!nk) return;
      var s = 0;
      if (nk === nq) s = 100;
      else if (nk.length >= 4 && (nq.indexOf(nk) >= 0 || nk.indexOf(nq) >= 0)) s = 75;
      else {
        var kt = normTokens(k);
        if (kt.length) {
          var hit = 0;
          kt.forEach(function (t) { if (qTokens.indexOf(t) >= 0) hit++; });
          if (hit) s = Math.round((hit / kt.length) * 50) + Math.min(hit, 3) * 5;
        }
      }
      if (s > best || (s === best && nk.length > bestKeyLen)) { best = s; bestKeyLen = nk.length; }
    });
    return { score: best, keyLen: bestKeyLen };
  }
  function entryScore(entry, nq, qTokens) {
    return entryScoreFull(entry, nq, qTokens).score;
  }
  function scoreEntries(q) {
    var nq = kbNorm(q);
    var qTokens = uniq(normTokens(q));
    return ENTRIES.map(function (e) {
      var r = entryScoreFull(e, nq, qTokens);
      return { entry: e, score: r.score, keyLen: r.keyLen };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return (b.score - a.score) || (b.keyLen - a.keyLen); });
  }
  // Topical matches for LLM grounding: anything scoring >= 40.
  // Returned as plain text lines the Worker pastes into the prompt as
  // the ONLY grounding context beyond its own dish RAG.
  function snippetsFor(q, n) {
    return scoreEntries(q).filter(function (x) { return x.score >= 40; })
      .slice(0, n || 3).map(function (x) {
        return { id: x.entry.id, title: x.entry.title, score: x.score,
          text: entryText(x.entry) };
      });
  }
  function entryText(entry) {
    try { return entry.build ? entry.build() : (entry.answer || ""); }
    catch (e) { return entry.answer || ""; }
  }

  // ---- Dish / drink / diet / city matching (references, not copies) ----
  function dishById(id) { return (D.dishes || []).find(function (d) { return d.id === id; }) || null; }
  function findDishInText(q) {
    // Same idea as chat.js findDishInText, but also matches the toneless
    // pinyin and the parenthetical English name ("Soup Dumplings
    // (Xiaolongbao)" must match a bare "xiaolongbao" — the full en
    // string alone never matches that). Longest matched name wins.
    var s = String(q || "").toLowerCase();
    var best = null, bestLen = -1;
    // Parenthetical English names are real names users type
    // ("xiaolongbao" in "Soup Dumplings (Xiaolongbao)") — but never a
    // city name, a "no …" negation, an "in …" descriptor, or a phrase
    // shared by two dishes ("in chili oil" fits two dishes, so it
    // matches neither on its own).
    var parenCounts = {};
    (D.dishes || []).forEach(function (d) {
      var p = (d.en || "").match(/\(([^)]+)\)/);
      if (p) parenCounts[p[1].toLowerCase()] = (parenCounts[p[1].toLowerCase()] || 0) + 1;
    });
    var cityNames = {};
    (D.cities || []).forEach(function (c) { cityNames[c.en.toLowerCase()] = true; cityNames[c.zh] = true; });
    (D.dishes || []).forEach(function (d) {
      var cands = [d.en.toLowerCase(), d.zh, kbNorm(stripParen(d.py || ""))];
      var paren = (d.en || "").match(/\(([^)]+)\)/);
      if (paren) {
        var pp = paren[1].toLowerCase();
        if (!cityNames[pp] && pp.indexOf("no ") !== 0 && pp.indexOf("in ") !== 0 && parenCounts[pp] === 1) cands.push(pp);
      }
      cands.forEach(function (c) {
        if (c && c.length >= 3 && s.indexOf(c) >= 0 && c.length > bestLen) { best = d; bestLen = c.length; }
      });
      if (q.indexOf(d.zh) >= 0 && d.zh.length > bestLen) { best = d; bestLen = d.zh.length; }
    });
    return best;
  }
  function findDrinkInText(q) {
    if (!DR) return null;
    var nq = kbNorm(q);
    var best = null, bestLen = -1;
    var tryKey = function (key, id) {
      var nk = kbNorm(key);
      if (nk.length >= 2 && nq.indexOf(nk) >= 0 && nk.length > bestLen) {
        var dr = (DR.drinks || []).find(function (x) { return x.id === id; });
        if (dr) { best = dr; bestLen = nk.length; }
      }
    };
    Object.keys(DR.aliases || {}).forEach(function (k) { tryKey(k, DR.aliases[k]); });
    (DR.drinks || []).forEach(function (dr) {
      tryKey(dr.en, dr.id); tryKey(dr.zh, dr.id);
      tryKey(stripParen(dr.py || ""), dr.id);
    });
    return best;
  }
  var DIET_KEYS = [
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
  function matchDiet(q) {
    var s = String(q || "").toLowerCase();
    for (var i = 0; i < DIET_KEYS.length; i++) {
      if (DIET_KEYS[i].keys.some(function (k) { return s.indexOf(k) >= 0; })) return DIET_KEYS[i].id;
    }
    return null;
  }
  function matchCity(q) {
    var s = String(q || "").toLowerCase();
    for (var i = 0; i < (D.cities || []).length; i++) {
      var c = D.cities[i];
      if (s.indexOf(c.en.toLowerCase()) >= 0 || q.indexOf(c.zh) >= 0) return c;
    }
    return null;
  }
  // A drink REQUEST (not a question about drinks): the query names a
  // drink AND asks for it / its price. "Why is my beer warm?" names a
  // drink but asks why — it must fall through to the KB entries.
  function looksLikeDrinkRequest(q) {
    return /(want|get|order|iced|cold|how much|price|menu|give me|bring|buy|one |a |please)/i.test(q || "");
  }

  // ---- The answerer ----
  // Returns null when the KB cannot satisfy the question (caller then
  // tries the external LLM, grounded on snippetsFor()).
  // Every result carries `source` for debugging (kb:<id> / dish:<id> /
  // drink:<id> / card:<id> / city:<id> / recommend).
  function answer(q, profile) {
    profile = profile || {};
    var text = String(q || "").trim();
    if (!text) return null;
    // 1. Dish — strict, same rules as the decoder (CB.findDish is
    // exact/alias/pinyin/contains, never a fuzzy auto-judge).
    var dish = null;
    try { dish = (CB && CB.findDish) ? CB.findDish(text) : null; } catch (e) {}
    if (!dish) dish = findDishInText(text);
    if (dish) return { kind: "dish", dish: dish, source: "dish:" + dish.id };
    // 2. Drink request.
    if (looksLikeDrinkRequest(text)) {
      var drink = findDrinkInText(text);
      if (drink) return { kind: "drink", drink: drink, source: "drink:" + drink.id };
    }
    // 3. Recommend.
    if (/recommend|suggest|hungry|what should i eat|what can i eat|what's good|surprise me|i'm hungry|im hungry/i.test(text))
      return { kind: "recommend", source: "recommend" };
    // 4. Diet card — explicit show-my-card / allergy mention.
    if (/diet card/i.test(text)) {
      var diets = Array.isArray(profile.diet) ? profile.diet : [];
      if (diets.length) return { kind: "cards", cardIds: diets.slice(), source: "cards:profile" };
      return { kind: "section", section: "dietSection", text: "Here are the diet cards — tap one to show it big to the waiter.", source: "section:diet" };
    }
    var dietId = matchDiet(text);
    if (dietId && /card|show|diet|allergy|vegetarian|vegan|halal|peanut|shellfish|gluten|egg|dairy|spicy/i.test(text))
      return { kind: "card", cardId: dietId, source: "card:" + dietId };
    // 5. City.
    var city = matchCity(text);
    if (city) return { kind: "city", city: city, source: "city:" + city.id };
    // 6. KB topical entry — must clear the threshold AND the runner-up,
    // unless the top entry is strictly more specific (longer matched
    // key) than the runner-up — sibling entries like kb-qr / kb-qr-fail
    // tie on score, and the longer key is the right answer.
    var scored = scoreEntries(text);
    if (scored.length && scored[0].score >= 55) {
      var second = scored.length > 1 ? scored[1] : null;
      var clearWin = !second || (scored[0].score - second.score >= 5) || (scored[0].keyLen > second.keyLen);
      if (clearWin) {
        var e = scored[0].entry;
        return { kind: "kb", entry: e, score: scored[0].score, text: entryText(e), source: "kb:" + e.id };
      }
    }
    return null;
  }

  window.CHINABITE_KB = {
    version: "kb-v1",
    entries: ENTRIES,
    answer: answer,
    snippetsFor: snippetsFor,
    entryScore: entryScore,
    stats: function () {
      return {
        version: "kb-v1",
        kbEntries: ENTRIES.length,
        kbByType: ENTRIES.reduce(function (m, e) { m[e.type] = (m[e.type] || 0) + 1; return m; }, {}),
        dishesReferenced: (D.dishes || []).length,
        drinksReferenced: (DR && DR.drinks ? DR.drinks.length : 0),
        dietCardsReferenced: (D.cards || []).length,
        citiesReferenced: (D.cities || []).length
      };
    }
  };
})();
