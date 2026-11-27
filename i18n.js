// Jade Bite — UI strings by language (Phase 1, v6.7).
// ONE place for every user-facing verdict / label / decoder string.
// 27 Nov 2026 (Oliver): user-facing buttons and labels are English
// only — the user doesn't read Chinese. The zh block below mirrors
// en, so a Chinese dish query never flips buttons back to Chinese.
// The waiter card stays Chinese (spec §6) and never goes through t().
// ko / ja / de / fr: TODO — keys mirror en/zh; values are null until a
// native speaker translates them. t() falls back to en for any missing
// key, so an untranslated language still reads correctly, never blank.
// Dish details (dish.main, ingredients) stay English in Phase 1 by
// design (see multilang spec §8) — only the verdict + labels translate.
// The waiter card is ALWAYS Chinese (spec §6) and never goes through t().
window.CHINABITE_I18N = (function () {
  "use strict";
  var STRINGS = {
    en: {
      "verdict.ok": "You're good",
      "verdict.no": "Skip this one",
      "verdict.ask": "Ask them first",
      "verdict.spicy": "Too hot for you",
      "label.why": "Here's why:",
      "label.whatsIn": "What's in it:",
      "label.headsUp": "Heads up:",
      "label.howHot": "How hot:",
      "label.watch": "Watch:",
      "label.about": "About:",
      "label.showThem": "Show them this:",
      "btn.addOrder": "Add to order",
      "btn.delivery": "Get it delivered",
      "btn.qr": "How to order by QR",
      "btn.dietCard": "Show diet card to waiter",
      "btn.showBig": "Enlarge",
      "btn.waiterCard": "Show my waiter card",
      "next.pick": "Next · pick one",
      "contains.none": "Nothing sneaky in here.",
      "contains.has": "Has {list} in it.",
      "flag.pork": "pork",
      "flag.lard": "lard",
      "flag.stock": "meat stock",
      "flag.peanut": "peanuts",
      "flag.shrimp": "shrimp",
      "flag.shellfish": "shellfish",
      "flag.gluten": "wheat (gluten)",
      "flag.soy": "soy",
      "flag.sesame": "sesame",
      "flag.egg": "egg",
      "flag.dairy": "dairy",
      "flag.beef": "beef",
      "flag.chicken": "chicken",
      "flag.fish": "fish",
      "flag.lamb": "lamb",
      "flag.duck": "duck",
      "flag.goose": "goose",
      "flag.frog": "frog",
      "flag.alcohol": "alcohol",
      "spice.0": "Not spicy",
      "spice.1": "Mild",
      "spice.2": "Medium",
      "spice.3": "Very spicy",
      "why.vegMeat": "It's got meat in it. {contains}",
      "why.vegLard": "Could be lard or meat stock in there — worth one quick question.",
      "why.vegEgg": "Egg's fine for you. {contains}",
      "why.vegan": "Animal product in there. {contains}",
      "why.halalPork": "Pork or lard — not halal. {contains}",
      "why.halalMeat": "It's meat — ask if it's halal, or look for the green 清真 sign.",
      "why.peanut": "Peanuts are the whole point of this one. Don't risk it.",
      "why.peanutStock": "No peanuts in the dish itself — but ask about the sauce, just in case.",
      "why.shellfish": "Shellfish in there. Don't risk it.",
      "why.shellfishStock": "No shellfish in the dish — but the stock might have some. One quick question.",
      "why.egg": "Egg in there. Don't risk it.",
      "why.dairy": "Dairy in there. Don't risk it.",
      "why.sesame": "Sesame in there. Don't risk it.",
      "why.soy": "Soy in there. Don't risk it.",
      "why.gluten": "Wheat in there. {contains}",
      "why.spicyHigh": "Spice {n}/3 — this one bites back.",
      "why.spicyMild": "Just a little heat — ask them to hold the chili.",
      "why.spicyNone": "No heat at all. {contains}",
      "decode.emptyTitle": "What are we checking?",
      "decode.emptyBody": "Type a dish name — try Mapo Tofu. Or tap a dish below, and I'll tell you in 3 seconds.",
      "decode.looking": "Looking it up…",
      "dym.title": "Did you mean {dish}?",
      "dym.body": "You typed “{q}” — the closest match on my list is this one.",
      "dym.yes": "Yes — check this dish",
      "dym.no": "No — show me similar dishes",
      "nomatch.title": "Hmm, not on my list yet",
      "nomatch.body": "I know {count} dishes — and “{q}” isn't one of them. Yet.",
      "nomatch.saved": "I saved it on your phone, and we'll add it.",
      "nomatch.askBun": "Ask Bun — he'll check with AI",
      "nomatch.browse": "Browse all 125 dishes",
      "nomatch.tryAnother": "Try another name for it — the same dish can have two names. Or snap the menu photo and I'll read it.",
      "nomatch.didYouMean": "Did you mean…",
      "toast.pickDiet": "Pick your diet first — tap a chip above."
    },
    zh: {
      // 27 Nov 2026 (Oliver): mirrors en — buttons and labels stay
      // English even when the dish query was Chinese. Waiter card
      // strings are NOT here; they stay Chinese by design.
      "verdict.ok": "You're good",
      "verdict.no": "Skip this one",
      "verdict.ask": "Ask them first",
      "verdict.spicy": "Too hot for you",
      "label.why": "Here's why:",
      "label.whatsIn": "What's in it:",
      "label.headsUp": "Heads up:",
      "label.howHot": "How hot:",
      "label.watch": "Watch:",
      "label.about": "About:",
      "label.showThem": "Show them this:",
      "btn.addOrder": "Add to order",
      "btn.delivery": "Get it delivered",
      "btn.qr": "How to order by QR",
      "btn.dietCard": "Show diet card to waiter",
      "btn.showBig": "Enlarge",
      "btn.waiterCard": "Show my waiter card",
      "next.pick": "Next · pick one",
      "contains.none": "Nothing sneaky in here.",
      "contains.has": "Has {list} in it.",
      "flag.pork": "pork",
      "flag.lard": "lard",
      "flag.stock": "meat stock",
      "flag.peanut": "peanuts",
      "flag.shrimp": "shrimp",
      "flag.shellfish": "shellfish",
      "flag.gluten": "wheat (gluten)",
      "flag.soy": "soy",
      "flag.sesame": "sesame",
      "flag.egg": "egg",
      "flag.dairy": "dairy",
      "flag.beef": "beef",
      "flag.chicken": "chicken",
      "flag.fish": "fish",
      "flag.lamb": "lamb",
      "flag.duck": "duck",
      "flag.goose": "goose",
      "flag.frog": "frog",
      "flag.alcohol": "alcohol",
      "spice.0": "Not spicy",
      "spice.1": "Mild",
      "spice.2": "Medium",
      "spice.3": "Very spicy",
      "why.vegMeat": "It's got meat in it. {contains}",
      "why.vegLard": "Could be lard or meat stock in there — worth one quick question.",
      "why.vegEgg": "Egg's fine for you. {contains}",
      "why.vegan": "Animal product in there. {contains}",
      "why.halalPork": "Pork or lard — not halal. {contains}",
      "why.halalMeat": "It's meat — ask if it's halal, or look for the green 清真 sign.",
      "why.peanut": "Peanuts are the whole point of this one. Don't risk it.",
      "why.peanutStock": "No peanuts in the dish itself — but ask about the sauce, just in case.",
      "why.shellfish": "Shellfish in there. Don't risk it.",
      "why.shellfishStock": "No shellfish in the dish — but the stock might have some. One quick question.",
      "why.egg": "Egg in there. Don't risk it.",
      "why.dairy": "Dairy in there. Don't risk it.",
      "why.sesame": "Sesame in there. Don't risk it.",
      "why.soy": "Soy in there. Don't risk it.",
      "why.gluten": "Wheat in there. {contains}",
      "why.spicyHigh": "Spice {n}/3 — this one bites back.",
      "why.spicyMild": "Just a little heat — ask them to hold the chili.",
      "why.spicyNone": "No heat at all. {contains}",
      "decode.emptyTitle": "What are we checking?",
      "decode.emptyBody": "Type a dish name — try Mapo Tofu. Or tap a dish below, and I'll tell you in 3 seconds.",
      "decode.looking": "Looking it up…",
      "dym.title": "Did you mean {dish}?",
      "dym.body": "You typed “{q}” — the closest match on my list is this one.",
      "dym.yes": "Yes — check this dish",
      "dym.no": "No — show me similar dishes",
      "nomatch.title": "Hmm, not on my list yet",
      "nomatch.body": "I know {count} dishes — and “{q}” isn't one of them. Yet.",
      "nomatch.saved": "I saved it on your phone, and we'll add it.",
      "nomatch.askBun": "Ask Bun — he'll check with AI",
      "nomatch.browse": "Browse all 125 dishes",
      "nomatch.tryAnother": "Try another name for it — the same dish can have two names. Or snap the menu photo and I'll read it.",
      "nomatch.didYouMean": "Did you mean…",
      "toast.pickDiet": "Pick your diet first — tap a chip above."
    },
    // TODO(i18n): ko / ja / de / fr — translate every key above, one
    // language at a time, with a native speaker checking each line.
    // Until then these stay empty and t() falls back to English.
    // Draft translations live in aliases-i18n-draft.js (NOT loaded) —
    // merge them here only after verification, never straight from draft.
    ko: {},
    ja: {},
    de: {},
    fr: {}
  };

  // Voice button labels are language names in English (27 Nov 2026:
  // buttons must be English — the user doesn't read Chinese).
  var VOICE_LANGS = ["en-US", "zh-CN", "ko-KR", "ja-JP", "de-DE", "fr-FR"];
  var VOICE_LABELS = {
    "en-US": "English", "zh-CN": "Chinese", "ko-KR": "Korean",
    "ja-JP": "Japanese", "de-DE": "German", "fr-FR": "French"
  };
  var VOICE_TO_LANG = {
    "en-US": "en", "zh-CN": "zh", "ko-KR": "ko",
    "ja-JP": "ja", "de-DE": "de", "fr-FR": "fr"
  };

  // ---- Simplified / Traditional Chinese (简繁, Phase 1 v6.7) ----
  // Rule (Oliver 27 Nov): by the region's official Chinese usage —
  // mainland China, Singapore, Malaysia -> Simplified (hans);
  // Taiwan, Hong Kong, Macau -> Traditional (hant).
  // Signals, permission-free only: the browser language region code
  // (zh-CN / zh-SG / zh-MY / zh-TW / zh-HK / zh-MO, incl. zh-Hans /
  // zh-Hant script subtags) FIRST, the timezone as fallback. No
  // Geolocation prompt, no extra network request. Regions with no
  // official Chinese (US, UK, Australia, ...): the browser's own zh
  // variant first (a zh-TW browser in New York still gets Traditional),
  // otherwise Traditional — the overseas default.
  // The source strings in this app are all Simplified. Conversion is
  // one-way simp -> trad, and the map covers exactly the characters
  // used by the waiter-facing + UI Chinese surface (diet-card lines,
  // waiter sentences, order slip INCLUDING dish names, drink order
  // sentences, zh UI strings, pay-method values). Any character not
  // in the map passes through unchanged — still readable, just not
  // converted. If a new Chinese string adds a character, add its
  // pair here. Note: 台 here is 柜台 (counter) -> 檯; Taiwan as a
  // place name is 台, but no converted string uses it that way.
  var SIMP_TO_TRAD_PAIRS =
    "万萬严嚴个個为為么麼乐樂云雲们們价價会會内內净淨凉涼别別务務动動单單卖賣卤滷号號吗嗎员員咸鹹坚堅壶壺备備头頭宝寶对對尔爾岛島帮幫干乾张張总總扫掃换換数數无無时時暂暫机機杂雜条條来來汤湯没沒浆漿浏瀏温溫滨濱点點烫燙热熱现現猪豬类類红紅线線经經给給绿綠肠腸脏髒矿礦码碼补補规規览覽计計订訂认認让讓记記识識诉訴试試说說请請读讀谢謝贝貝质質购購贴貼车車输輸达達过過还還这這选選酱醬里裡锅鍋镇鎮问問险險隐隱面麵项項饭飯饮飲饺餃饼餅馄餛饨飩馅餡馍饃馕饢鱼魚鲜鮮鳝鱔鸡雞鸭鴨鹅鵝麦麥麸麩黄黃虾蝦蚝蠔蛳螄宫宮柜櫃台檯广廣县縣双雙响響妇婦姜薑扬揚杨楊桥橋烧燒狮獅盘盤罗羅钟鐘马馬东東兰蘭凤鳳汉漢斋齋庆慶";
  var SIMP_TO_TRAD = {};
  (function () {
    for (var i = 0; i + 1 < SIMP_TO_TRAD_PAIRS.length; i += 2) {
      SIMP_TO_TRAD[SIMP_TO_TRAD_PAIRS.charAt(i)] = SIMP_TO_TRAD_PAIRS.charAt(i + 1);
    }
  })();
  // One-way Simplified -> Traditional for the converted surface only.
  // Most characters are one-to-one, but 面 is two words in Traditional:
  // 麵 = noodles (拉面, 这个面, 不要面), 面 = "side" (里面/上面/下面).
  // The side-words are protected with private-use placeholders before
  // the character loop and restored after, so 里面 -> 裡面 (not 裡麵).
  var FACE_WORDS = { "里面": "裡面", "上面": "上面", "下面": "下面" };
  var FACE_PLACEHOLDER = { "里面": "\uE000", "上面": "\uE001", "下面": "\uE002" };
  function toTraditional(s) {
    s = String(s == null ? "" : s);
    Object.keys(FACE_WORDS).forEach(function (w) { s = s.split(w).join(FACE_PLACEHOLDER[w]); });
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += SIMP_TO_TRAD[c] || c;
    }
    Object.keys(FACE_WORDS).forEach(function (w) { out = out.split(FACE_PLACEHOLDER[w]).join(FACE_WORDS[w]); });
    return out;
  }
  var ZH_SIMP_REGIONS = { CN: 1, SG: 1, MY: 1 }; // mainland, Singapore, Malaysia
  var ZH_TRAD_REGIONS = { TW: 1, HK: 1, MO: 1 }; // Taiwan, Hong Kong, Macau
  var ZH_SIMP_TIMEZONES = {
    "Asia/Shanghai": 1, "Asia/Chongqing": 1, "Asia/Urumqi": 1,
    "Asia/Singapore": 1, "Asia/Kuala_Lumpur": 1, "Asia/Kuching": 1
  };
  var ZH_TRAD_TIMEZONES = { "Asia/Taipei": 1, "Asia/Hong_Kong": 1, "Asia/Macau": 1 };
  // navLangs / tz are optional overrides (used by tests); when omitted
  // they are read from navigator / Intl at call time.
  function detectZhVariant(navLangs, tz) {
    var langs = navLangs;
    if (!langs) {
      try { langs = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || []; }
      catch (e) { langs = []; }
    }
    for (var i = 0; i < langs.length; i++) {
      var tag = String(langs[i] || "");
      var script = tag.match(/^zh[-_](Hans|Hant)(?:[-_]|$)/i);
      if (script) return script[1].toLowerCase() === "hans" ? "hans" : "hant";
      var region = tag.match(/^zh[-_]([A-Za-z]{2})(?:[-_]|$)/i);
      if (region) {
        var r = region[1].toUpperCase();
        if (ZH_SIMP_REGIONS[r]) return "hans";
        if (ZH_TRAD_REGIONS[r]) return "hant";
      }
    }
    var zone = tz;
    if (zone === undefined || zone === null) {
      try { zone = (typeof Intl !== "undefined") ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""; }
      catch (e) { zone = ""; }
    }
    if (ZH_SIMP_TIMEZONES[zone]) return "hans";
    if (ZH_TRAD_TIMEZONES[zone]) return "hant";
    return "hant"; // overseas default: Traditional
  }

  function t(lang, key, vars) {
    var s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  return {
    t: t,
    strings: STRINGS,
    langs: ["zh", "en", "ko", "ja", "de", "fr"],
    voiceLangs: VOICE_LANGS,
    voiceLabels: VOICE_LABELS,
    voiceToLang: VOICE_TO_LANG,
    toTraditional: toTraditional,
    detectZhVariant: detectZhVariant
  };
})();
