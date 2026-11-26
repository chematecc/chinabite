// China Bite validation build — no real payment, no real ads, no server.
// All state is local (localStorage). Referral invites are a PLACEHOLDER here:
// sharing does NOT count as an invite. Real invite counting needs a server (D1).
(function () {
  "use strict";
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
  var baseFree = referred ? 6 : 3;
  var paidPreview = false;
  var profile = "none";
  var lastDish = null;

  function remaining() { return Math.max(0, baseFree + state.bonus - state.used); }
  function usd(cny) { return (cny / D.rate).toFixed(2); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // ---- Profiles ----
  var profEl = $("profiles");
  D.profiles.forEach(function (p) {
    var b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.textContent = p.en + " · " + p.zh;
    b.setAttribute("aria-pressed", p.id === profile ? "true" : "false");
    b.onclick = function () {
      profile = p.id;
      Array.prototype.forEach.call(profEl.children, function (c) { c.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      $("profileDesc").textContent = p.en + " — " + p.desc;
      if (lastDish) renderResult(lastDish);
    };
    profEl.appendChild(b);
  });

  // ---- Verdict logic ----
  function verdictFor(dish) {
    var f = dish.flags || [];
    function has() { for (var i = 0; i < arguments.length; i++) if (f.indexOf(arguments[i]) >= 0) return true; return false; }
    var meat = has("pork", "beef", "chicken", "duck", "fish", "shrimp", "frog", "goose", "lamb");
    var animal = meat || has("egg", "dairy");
    if (profile === "none") return { k: "ok", t: "You can eat it", why: dish.note };
    if (profile === "vegetarian") {
      if (meat) return { k: "no", t: "Avoid", why: "Meat. " + dish.note };
      if (has("lard", "stock")) return { k: "ask", t: "Ask first", why: "Lard or stock. Ask first." };
      if (has("egg")) return { k: "ok", t: "You can eat it", why: "Egg OK. " + dish.note };
      return { k: "ok", t: "You can eat it", why: dish.note };
    }
    if (profile === "vegan") {
      if (animal || has("lard", "stock")) return { k: "no", t: "Avoid", why: "Animal product. " + dish.note };
      return { k: "ok", t: "You can eat it", why: dish.note };
    }
    if (profile === "halal") {
      if (has("pork", "lard", "alcohol")) return { k: "no", t: "Avoid", why: "Pork or lard. " + dish.note };
      if (meat) return { k: "ask", t: "Ask first", why: "Meat. Ask: halal? Look for 清真." };
      return { k: "ok", t: "You can eat it", why: dish.note };
    }
    if (profile === "peanut") {
      if (has("peanut")) return { k: "no", t: "Avoid", why: "Peanuts. Don't order." };
      if (has("stock")) return { k: "ask", t: "Ask first", why: "No peanuts. Ask about sauce." };
      return { k: "ok", t: "You can eat it", why: dish.note };
    }
    if (profile === "shellfish") {
      if (has("shrimp")) return { k: "no", t: "Avoid", why: "Shellfish. Don't order." };
      if (has("stock")) return { k: "ask", t: "Ask first", why: "No shellfish. Ask about stock." };
      return { k: "ok", t: "You can eat it", why: dish.note };
    }
    if (profile === "gluten") {
      if (has("gluten")) return { k: "no", t: "Avoid", why: "Wheat. " + dish.note };
      return { k: "ok", t: "You can eat it", why: dish.note };
    }
    if (profile === "nospicy") {
      if (dish.spicy >= 2) return { k: "no", t: "Avoid", why: "Too spicy. " + dish.note };
      if (dish.spicy === 1) return { k: "ask", t: "Ask first", why: "Mild spice. Ask: no chili." };
      return { k: "ok", t: "You can eat it", why: "Not spicy. " + dish.note };
    }
    return { k: "ok", t: "You can eat it", why: dish.note };
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
      '<div class="verdict ' + cls + '">' + esc(v.t) + " — " + esc(dish.zh) + " " + esc(dish.en) + "</div>" +
      "<p><b>Why:</b> " + esc(v.why) + "</p>" +
      "<p><b>Inside:</b> " + esc(dish.main) + "</p>" +
      "<p><b>Hidden:</b> " + esc(dish.hidden) + "</p>" +
      "<p><b>Spice:</b> " + esc(spiceLabel(dish.spicy)) + "</p>" +
      ((dish.flags && dish.flags.length) ? "<p><b>Watch:</b> " + esc(dish.flags.join(", ")) + "</p>" : "") +
      "<p><b>Price:</b> ¥" + dish.price + " · ≈$" + usd(dish.price) + "</p>" +
      "<p><b>Show waiter:</b></p><p class=\"bigzh\">" + esc(dish.waiter) + "</p>" +
      "<p class=\"small\">" + esc(dish.py) + "</p>" +
      '<button type="button" id="addOrderBtn">Add to list · 加入清单</button> ' +
      '<button type="button" class="ghost" id="shareDishBtn">Share</button>' +
      '<details class="subcard"><summary>下一步 · 3 选 1</summary>' +
      '<div class="next-steps">' +
      '<button type="button" id="nextDianpingBtn">点评搜这道菜 · Search on Dianping</button>' +
      '<button type="button" class="ghost" id="nextQrBtn">扫码怎么点 · How to order by QR</button>' +
      '<button type="button" class="ghost" id="nextCardBtn">饮食卡给服务员看 · Show diet card</button></div></details>' +
      "<p><b>Dianping:</b> 点“点评搜这道菜”，菜名自动复制，去点评粘贴搜。</p>" +
      "<p><b>Delivery?</b> 菜名已复制，去美团外卖粘贴搜。酒店卡在下面美团区。</p>";
    $("addOrderBtn").onclick = function () { addToOrder(dish); };
    $("shareDishBtn").onclick = function () { shareDish(dish, v); };
    $("nextDianpingBtn").onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(dish.zh);
      var s = $("meituanSection"); if (s) { s.open = true; s.scrollIntoView(); }
    };
    $("nextQrBtn").onclick = function () { var s = $("qrSection"); if (s) { s.open = true; s.scrollIntoView(); } };
    $("nextCardBtn").onclick = function () { var s = $("dietSection"); if (s) { s.open = true; s.scrollIntoView(); } };
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
      $("result").innerHTML = "<div class=\"verdict ask\">Not in list yet · 没收录</div>" +
        "<p>" + D.dishes.length + " dishes here. Not this one.</p>" +
        "<p>Saved on this device. We'll add it.</p>" +
        "<p>Photo the menu. Check: lard, stock, oyster sauce.</p>";
      return;
    }
    if (remaining() <= 0 && !paidPreview) {
      $("result").className = "subcard";
      $("result").innerHTML = "<div class=\"verdict ask\">Free decodes used up · 用完了</div>" +
        "<p>Watch a 5s ad: +3.</p>" +
        "<p>Or get Kit: $6.99, 90 days.</p>" +
        '<button type="button" onclick="document.getElementById(\'adSection\').scrollIntoView()">Watch ad · +3</button>';
      return;
    }
    if (!paidPreview) { state.used++; save(); }
    renderResult(dish);
  }
  $("decodeBtn").onclick = decode;
  $("dishInput").addEventListener("keydown", function (e) { if (e.key === "Enter") decode(); });

  // Quick-pick dish list (110)
  var listEl = $("dishList");
  D.dishes.forEach(function (d) {
    var b = document.createElement("button");
    b.className = "dish"; b.type = "button";
    b.innerHTML = '<span class="zh">' + esc(d.zh) + '</span><br><span class="en">' + esc(d.en) + " · ¥" + d.price + " · Spice " + d.spicy + "/3</span>";
    b.onclick = function () { $("dishInput").value = d.zh; decode(); $("decoder").scrollIntoView(); };
    listEl.appendChild(b);
  });

  // ---- Order list + slip (B route) ----
  function addToOrder(dish) {
    var item = state.order.find(function (x) { return x.id === dish.id; });
    if (item) item.qty++; else state.order.push({ id: dish.id, qty: 1 });
    save(); renderOrder();
    alert("Added: " + dish.zh);
  }
  function renderOrder() {
    var el = $("orderList");
    if (!state.order.length) { el.innerHTML = "<p class=\"muted\">List empty. Decode a dish first.</p>"; }
    else {
      el.innerHTML = state.order.map(function (x) {
        var d = D.dishes.find(function (dd) { return dd.id === x.id; });
        return "<p>• " + esc(d.zh) + " " + esc(d.en) + " × " + x.qty + " — ¥" + (d.price * x.qty) + "</p>";
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
      (lines.length ? "<p class=\"bigzh\">" + esc(lines.join("<br>")) + "</p>" : "<p class=\"muted\">（先在解码器里把菜加入清单）</p>") +
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
      return "- " + d.zh + " " + d.en + " ×" + x.qty;
    }).join("\n") + "\nMade with China Bite: " + location.origin + location.pathname + "?ref=" + state.myRef;
    shareText("My China Bite order list", text);
  };
  renderOrder();

  // ---- QR route A table ----
  $("qrTable").innerHTML = "<table><tr><th>中文</th><th>English</th><th>What it means</th></tr>" +
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
        "<p><b>3 dishes · 必吃 3 道</b></p>" +
        (c.mustEat || []).map(function (m) {
          var d = dishById[m.id];
          if (!d) return "";
          return "<p><button type=\"button\" onclick=\"document.getElementById('dishInput').value='" + esc(d.zh) + "';document.getElementById('decodeBtn').click();document.getElementById('decoder').scrollIntoView()\">" + esc(d.zh) + " · " + esc(d.en) + "</button><br><span class=\"small\">" + esc(m.note) + "</span></p>";
        }).join("") +
        "<p><b>Watch · 注意：</b>" + esc(c.tip) + "</p>" +
        "<p><b>Getting there · 交通：</b>" + esc(c.transport) + "</p>" +
        c.places.map(function (p) { return "<p>• " + esc(p.name) + " — " + esc(p.type) + " · " + esc(p.area) + " · " + esc(p.note) + "<br><span class=\"small\">Dianping: search the shop name to see its score. No score copied here. 点评评分参考：去点评搜店名看分。</span></p>"; }).join("");
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

  // ---- Counts ----
  function updateCounts() {
    $("countText").textContent = "Left today: " + remaining() + " of " + (baseFree + state.bonus) +
      (paidPreview ? " — Paid: unlimited, no ads" : "") +
      " · Ads: " + state.adsToday + "/5";
    var pct = Math.min(100, Math.round(remaining() / Math.max(1, baseFree + state.bonus) * 100));
    $("countBar").style.width = pct + "%";
  }
  updateCounts();

  // ---- Rewarded ad (DEMO ONLY — no real AdMob / AdSense) ----
  var adTimer = null;
  $("watchAdBtn").onclick = function () {
    if (state.adsToday >= 5) { alert("Ad limit: 5/day. Back tomorrow."); return; }
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
        $("adSkip").textContent = "Back · 回主页 (+3)";
      } else { $("adCount").textContent = n; }
    }, 1000);
  };
  $("adSkip").onclick = function () {
    clearInterval(adTimer);
    $("adOverlay").classList.add("hidden");
    state.bonus += 3; state.adsToday++; save(); updateCounts();
    alert("+3 decodes. Bonus today: +" + state.bonus + ".");
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

  // ---- App mode nav: bottom nav + top menu ----
  // Tap a nav item: open the card if it is collapsed, then scroll to it.
  function gotoSection(id) {
    var el = $(id);
    if (!el) return;
    if (el.tagName === "DETAILS") el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    var menu = $("appMenu");
    if (menu) menu.classList.add("hidden");
    var btn = $("menuBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  document.querySelectorAll("[data-goto]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      gotoSection(a.getAttribute("data-goto"));
      if (a.closest(".bottomnav")) {
        document.querySelectorAll(".bottomnav a").forEach(function (x) { x.classList.remove("active"); });
        a.classList.add("active");
      }
    });
  });
  var menuBtn = $("menuBtn");
  if (menuBtn) {
    menuBtn.onclick = function () {
      var menu = $("appMenu");
      var open = menu.classList.toggle("hidden") === false;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    };
  }

  // ---- Paid preview toggle (no real payment) ----
  $("paidToggle").onchange = function (e) {
    paidPreview = e.target.checked;
    $("adSection").classList.toggle("hidden", paidPreview);
    $("paidNote").textContent = paidPreview
      ? "Paid preview ON: no ads. Unlimited."
      : "Free version. Demo ads on.";
    updateCounts();
  };
})();
