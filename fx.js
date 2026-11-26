/* Live FX — one source of truth for every ¥→foreign conversion on the site.
   Rates come from open.er-api.com (free, no key): ONE request, base CNY,
   all currencies at once. Fallback chain: live -> cached (localStorage)
   -> baked-in table (er-api, 2026-11-26). Fetch never blocks rendering:
   prices render immediately on fallback/cache and update quietly when the
   live rate arrives. JPY is labelled "JPY" (not ¥) so it can't be confused
   with the CNY ¥ price next to it. */
(function () {
  var API = "https://open.er-api.com/v6/latest/CNY";
  var CUR_KEY = "cbfx-cur";
  var RATE_KEY = "cbfx-rates";
  var CURRENCIES = [
    { code: "USD", label: "$", dec: 2 },
    { code: "EUR", label: "€", dec: 2 },
    { code: "GBP", label: "£", dec: 2 },
    { code: "JPY", label: "JPY", dec: 0 },
    { code: "KRW", label: "₩", dec: 0 },
    { code: "SGD", label: "S$", dec: 2 },
    { code: "HKD", label: "HK$", dec: 2 },
    { code: "AUD", label: "A$", dec: 2 },
    { code: "CAD", label: "C$", dec: 2 },
    { code: "TWD", label: "NT$", dec: 2 }
  ];
  // Baked-in fallback, 7.1 CNY/USD (the old hardcoded rate) — used ONLY when
  // the API is unreachable AND there is no cached rate. Non-USD rates are
  // the er-api 2026-11-26 cross-rates scaled to the same 7.1 USD base, so
  // every currency stays consistent with the USD fallback.
  var FALLBACK_RATES = { USD: 0.140845, EUR: 0.128591, GBP: 0.107673, JPY: 22.438, KRW: 189.609, SGD: 0.181762, HKD: 1.10409, AUD: 0.213474, CAD: 0.200625, TWD: 4.660426 };
  var FALLBACK_DATE = "2026-11-26";

  function cur(code) {
    for (var i = 0; i < CURRENCIES.length; i++) if (CURRENCIES[i].code === code) return CURRENCIES[i];
    return CURRENCIES[0];
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var fx = {
    CURRENCIES: CURRENCIES,
    currency: "USD",
    rates: FALLBACK_RATES,
    date: FALLBACK_DATE,
    source: "fallback", // live | cache | fallback
    _listeners: [],
    onChange: function (fn) { fx._listeners.push(fn); },
    _notify: function () { fx._listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); },
    rate: function (code) {
      var r = fx.rates[code || fx.currency];
      return (typeof r === "number" && r > 0) ? r : FALLBACK_RATES[code || fx.currency];
    },
    // "¥28" -> "$4.19" (USD) / "€3.83" / "JPY 667" — symbol + number, no "≈".
    fmt: function (cny, code) {
      var c = cur(code || fx.currency);
      var v = cny * fx.rate(c.code);
      if (c.dec === 0) return c.label + " " + Math.round(v).toLocaleString("en-US");
      return c.label + v.toFixed(2);
    },
    // "¥(CNY)→USD $ at live rate (2026-11-27)" — honest basis tail.
    rateText: function () {
      var c = cur(fx.currency);
      var lab = (c.label === c.code) ? "" : " " + c.label;
      return "¥(CNY)→" + c.code + lab + " at " + fx.source + " rate (" + fx.date + ")";
    },
    setCurrency: function (code) {
      var ok = false;
      for (var i = 0; i < CURRENCIES.length; i++) if (CURRENCIES[i].code === code) ok = true;
      if (!ok) return;
      fx.currency = code;
      store(CUR_KEY, fx.currency);
      var sel = document.getElementById("fxSelect");
      if (sel) sel.value = fx.currency;
      fx.applyStatic();
      fx._notify();
    },
    // Static pages + static spans in the app: [data-cny] and .fx-basis.
    applyStatic: function () {
      var amts = document.querySelectorAll("[data-cny]");
      for (var i = 0; i < amts.length; i++) {
        var n = parseFloat(amts[i].getAttribute("data-cny"));
        if (!isNaN(n)) amts[i].textContent = "≈" + fx.fmt(n);
      }
      var basis = document.querySelectorAll(".fx-basis");
      for (var j = 0; j < basis.length; j++) basis[j].textContent = fx.rateText();
    },
    fetchRates: function () {
      var ctrl = null, timer = null;
      try {
        if (window.AbortController) { ctrl = new AbortController(); timer = setTimeout(function () { ctrl.abort(); }, 3000); }
        fetch(API, ctrl ? { signal: ctrl.signal } : {}).then(function (res) {
          if (timer) clearTimeout(timer);
          if (!res.ok) throw new Error("bad status " + res.status);
          return res.json();
        }).then(function (json) {
          if (!json || json.result !== "success" || !json.rates || !json.rates.USD) throw new Error("bad payload");
          fx.rates = json.rates;
          var d = json.time_last_update_utc ? new Date(json.time_last_update_utc) : null;
          fx.date = (d && !isNaN(d.getTime())) ? d.toISOString().slice(0, 10) : "today";
          fx.source = "live";
          store(RATE_KEY, JSON.stringify({ rates: fx.rates, date: fx.date }));
          fx.applyStatic();
          fx._notify();
        }).catch(function () { /* keep cache/fallback — never break the page */ });
      } catch (e) { /* fetch unavailable — keep cache/fallback */ }
    },
    init: function () {
      var savedCur = read(CUR_KEY);
      if (savedCur && cur(savedCur)) fx.currency = cur(savedCur).code;
      try {
        var cached = JSON.parse(read(RATE_KEY) || "null");
        if (cached && cached.rates && cached.rates.USD) { fx.rates = cached.rates; fx.date = cached.date || FALLBACK_DATE; fx.source = "cache"; }
      } catch (e) {}
      var sel = document.getElementById("fxSelect");
      if (sel) {
        sel.innerHTML = CURRENCIES.map(function (c) {
          return '<option value="' + c.code + '"' + (c.code === fx.currency ? " selected" : "") + ">" + c.code + " " + c.label + "</option>";
        }).join("");
        sel.addEventListener("change", function () { fx.setCurrency(sel.value); });
      }
      fx.applyStatic();
      fx.fetchRates();
    }
  };

  window.CBFX = fx;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fx.init);
  else fx.init();
})();
