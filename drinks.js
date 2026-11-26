// China Bite — drinks & beer (v5.9).
// ONE place for every drink on the list. Same rules as the dishes:
// prices are reference only — a mid-range local restaurant in a Tier-1
// city (Shanghai / Beijing), ¥→$ at 7.1 (2026-11-26). Numbers are NOT
// verified against real menus; the price basis line on the page says so.
//
// Why drinks need their own list: in China drinks arrive at ROOM
// TEMPERATURE unless you ask. Beer, Coke, water — all of it. A foreign
// visitor who doesn't say 冰镇 / 冰的 gets a warm beer and thinks the
// restaurant forgot to chill it. It didn't. That's the default here.
// Each drink carries its temps and the exact Chinese sentence to show
// the waiter for each temp, so the order can't come back warm by
// accident. Baijiu is never iced; red wine is room temp; yellow wine
// is often served warm — those temps aren't offered.
//
// Fields: id, en, zh, py, price (¥), cat (beer/soft/tea/juice/spirit),
// temps (subset of iced/room/hot/warm), defaultTemp, unit (瓶/壶/杯),
// icedWord (the word for "iced" in the order sentence — 冰镇 for beer,
// 冰 for everything else), note (one line, human, no fluff).
window.CHINABITE_DRINKS = {
  rate: 7.1,
  rateDate: "2026-11-26",
  drinks: [
    // ---- Beer 啤酒 ----
    { id: "qingdao", en: "Tsingtao Beer", zh: "青岛啤酒", py: "Qīng dǎo pí jiǔ", price: 10, cat: "beer",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶", icedWord: "冰镇",
      note: "China's most famous beer — light lager, 4.7%." },
    { id: "snow", en: "Snow Beer", zh: "雪花啤酒", py: "Xuě huā pí jiǔ", price: 8, cat: "beer",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶", icedWord: "冰镇",
      note: "China's best-selling beer — light and easy, 4.3%. The one on every table." },
    { id: "yanjing", en: "Yanjing Beer", zh: "燕京啤酒", py: "Yàn jīng pí jiǔ", price: 8, cat: "beer",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶", icedWord: "冰镇",
      note: "Beijing's local lager — crisp, 4.5%." },
    { id: "harbin", en: "Harbin Beer", zh: "哈尔滨啤酒", py: "Hā ěr bīn pí jiǔ", price: 10, cat: "beer",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶", icedWord: "冰镇",
      note: "Northeast lager — a little stronger, 4.8%." },
    { id: "budweiser", en: "Budweiser", zh: "百威啤酒", py: "Bǎi wēi pí jiǔ", price: 12, cat: "beer",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶", icedWord: "冰镇",
      note: "Brewed in China — the familiar one, 5%." },
    // ---- Soft drinks 软饮 ----
    { id: "coke", en: "Coca-Cola", zh: "可口可乐", py: "Kě kǒu kě lè", price: 8, cat: "soft",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶",
      note: "The classic — sweet, fizzy, everywhere." },
    { id: "sprite", en: "Sprite", zh: "雪碧", py: "Xuě bì", price: 8, cat: "soft",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶",
      note: "Lemon-lime, crisp and clear." },
    { id: "fanta", en: "Fanta", zh: "芬达", py: "Fēn dá", price: 8, cat: "soft",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶",
      note: "Usually orange in China." },
    { id: "water", en: "Mineral Water", zh: "矿泉水", py: "Kuàng quán shuǐ", price: 3, cat: "soft",
      temps: ["iced", "room"], defaultTemp: "room", unit: "瓶",
      note: "Nongfu Spring is the one you'll see everywhere. Cheapest thing on the menu." },
    { id: "coconut", en: "Coconut Water", zh: "椰汁", py: "Yē zhī", price: 10, cat: "soft",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶",
      note: "Sweet, milky coconut drink — a restaurant classic, not plain coconut water." },
    // ---- Tea 茶 ----
    { id: "green-tea", en: "Green Tea", zh: "绿茶", py: "Lǜ chá", price: 15, cat: "tea",
      temps: ["hot", "iced"], defaultTemp: "hot", unit: "壶",
      note: "A pot of hot tea — the house default, sometimes free." },
    { id: "jasmine-tea", en: "Jasmine Tea", zh: "茉莉花茶", py: "Mò lì huā chá", price: 15, cat: "tea",
      temps: ["hot", "iced"], defaultTemp: "hot", unit: "壶",
      note: "Light and floral — the Beijing restaurant classic, by the pot." },
    { id: "black-tea", en: "Black Tea", zh: "红茶", py: "Hóng chá", price: 15, cat: "tea",
      temps: ["hot", "iced"], defaultTemp: "hot", unit: "壶",
      note: "Served hot by the pot." },
    { id: "iced-black-tea", en: "Iced Black Tea", zh: "冰红茶", py: "Bīng hóng chá", price: 8, cat: "tea",
      temps: ["iced"], defaultTemp: "iced", unit: "瓶",
      note: "Bottled sweet iced tea — the convenience-store favourite. Always cold." },
    // ---- Juice & traditional 果汁 · 传统 ----
    { id: "orange-juice", en: "Orange Juice", zh: "橙汁", py: "Chéng zhī", price: 12, cat: "juice",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "瓶",
      note: "Usually bottled, not fresh. Fresh-squeezed is a separate listing." },
    { id: "fresh-orange", en: "Fresh Orange Juice", zh: "现榨橙汁", py: "Xiàn zhà chéng zhī", price: 18, cat: "juice",
      temps: ["iced"], defaultTemp: "iced", unit: "杯",
      note: "Fresh-squeezed, made to order." },
    { id: "suanmeitang", en: "Sour Plum Drink", zh: "酸梅汤", py: "Suān méi tāng", price: 10, cat: "juice",
      temps: ["iced", "room"], defaultTemp: "iced", unit: "杯",
      note: "Sweet-sour plum — the classic with hotpot and BBQ. Usually served chilled." },
    { id: "doujiang-drink", en: "Soy Milk", zh: "豆浆", py: "Dòu jiāng", price: 6, cat: "juice",
      temps: ["hot", "iced"], defaultTemp: "hot", unit: "杯",
      note: "Warm and lightly sweet — the breakfast-table classic. (Also a dish — the decoder checks dishes first.)" },
    // ---- Spirits 酒 — brief, no deep dive ----
    { id: "baijiu", en: "Baijiu", zh: "白酒", py: "Bái jiǔ", price: 30, cat: "spirit",
      temps: ["room"], defaultTemp: "room", unit: "瓶",
      note: "China's white spirit, 40–53%. Strong. From ¥30 a small bottle." },
    { id: "red-wine", en: "Red Wine", zh: "红酒", py: "Hóng jiǔ", price: 88, cat: "spirit",
      temps: ["room"], defaultTemp: "room", unit: "瓶",
      note: "From ¥88 a bottle in a mid-range restaurant." },
    { id: "huangjiu", en: "Yellow Wine", zh: "黄酒", py: "Huáng jiǔ", price: 25, cat: "spirit",
      temps: ["warm", "room"], defaultTemp: "warm", unit: "壶",
      note: "Mellow rice wine, brewed for centuries. From ¥25." }
  ],
  // Alias keys are matched AFTER app.js normStr() runs (same convention
  // as aliases.js): lowercase, tones stripped, spaces + punctuation
  // dropped. Value = drink id above. Drink aliases NEVER override a
  // dish: the decoder checks dishes first, and only asks the drink
  // list when no dish matches (or the dish hit is fuzzy) — so 豆浆
  // still decodes to the dish, and 水 still finds nothing dish-side.
  aliases: {
    // ---- Beer ----
    "beer": "qingdao", "ice cold beer": "qingdao", "ice-cold beer": "qingdao",
    "iced beer": "qingdao", "ice beer": "qingdao", "cold beer": "qingdao",
    "chinese beer": "qingdao", "tsingtao": "qingdao",
    "snow beer": "snow", "yanjing": "yanjing", "yanjing beer": "yanjing",
    "harbin beer": "harbin", "budweiser": "budweiser",
    "啤酒": "qingdao", "冰啤酒": "qingdao", "冰镇啤酒": "qingdao",
    "青岛啤酒": "qingdao", "雪花": "snow", "雪花啤酒": "snow",
    "燕京啤酒": "yanjing", "哈尔滨啤酒": "harbin", "百威": "budweiser",
    "pijiu": "qingdao", "bing pijiu": "qingdao", "bingzhen pijiu": "qingdao",
    // ---- Soft drinks ----
    "coke": "coke", "cola": "coke", "coca cola": "coke", "coca-cola": "coke",
    "sprite": "sprite", "fanta": "fanta",
    "mineral water": "water", "water": "water", "bottled water": "water",
    "coconut": "coconut", "coconut water": "coconut",
    "可乐": "coke", "可口可乐": "coke", "冰可乐": "coke",
    "雪碧": "sprite", "芬达": "fanta",
    "矿泉水": "water", "水": "water",
    "椰汁": "coconut", "椰子水": "coconut",
    "kele": "coke", "xuebi": "sprite", "kuangquanshui": "water",
    // ---- Tea ----
    "tea": "green-tea", "hot tea": "green-tea", "green tea": "green-tea",
    "jasmine tea": "jasmine-tea", "black tea": "black-tea",
    "iced tea": "iced-black-tea", "ice tea": "iced-black-tea",
    "绿茶": "green-tea", "茉莉花茶": "jasmine-tea", "茉莉茶": "jasmine-tea",
    "红茶": "black-tea", "冰红茶": "iced-black-tea",
    "茶": "green-tea",
    "lvcha": "green-tea", "lucha": "green-tea",
    "moli huacha": "jasmine-tea", "hongcha": "black-tea",
    "bing hongcha": "iced-black-tea",
    // ---- Juice & traditional ----
    "orange juice": "orange-juice", "juice": "orange-juice",
    "fresh orange juice": "fresh-orange", "fresh-squeezed orange juice": "fresh-orange",
    "sour plum": "suanmeitang", "sour plum drink": "suanmeitang",
    "soy milk": "doujiang-drink", "soymilk": "doujiang-drink",
    "橙汁": "orange-juice", "果汁": "orange-juice",
    "现榨橙汁": "fresh-orange", "酸梅汤": "suanmeitang",
    "豆浆": "doujiang-drink",
    "chengzhi": "orange-juice", "suanmeitang": "suanmeitang",
    "doujiang": "doujiang-drink",
    // ---- Spirits ----
    "baijiu": "baijiu", "red wine": "red-wine", "yellow wine": "huangjiu",
    "rice wine": "huangjiu",
    "白酒": "baijiu", "红酒": "red-wine", "黄酒": "huangjiu",
    "hongjiu": "red-wine", "huangjiu": "huangjiu"
  }
};
