// Jade Bite — dish alias map (v5.3).
// ONE place for every "same dish, different name". Keys are matched AFTER
// app.js normStr() runs (lowercase, tone marks stripped, full-width folded,
// all spaces + punctuation dropped), so write keys in their natural form:
// "西红柿炒鸡蛋", "fanqie chaodan" and "tomato egg" all work.
// Value = dish id in data.js. Aliases NEVER change a dish's verdict
// or data — they only point at it.
//
// Classes covered (each with examples in the map):
//   A. Regional names — same dish, different city word:
//      番茄/西红柿 (tomato-egg), 馄饨/抄手/云吞 (guangzhou-wonton),
//      扁肉 (shaxian-bianrou), 水饺/蒸饺 (jiaozi), 米粉/米线 (guilin-mifen / guoqiao-mixian)
//   B. Pinyin — toneless pinyin, spaced or not: fanqie chaodan, huntun,
//      shuijiao, liangpi, luoshifen (auto pinyin from data.js `py` covers
//      the rest — these are only the ones the `py` field doesn't spell)
//   C. English variants — tomato egg, beijing duck, scallion pancake
//   D. Short forms — 麻婆, 回锅, 宫保, 鱼香, 担担, 小笼, 生煎, 烤鸭, 凉皮
//   E. Common typos — 麻婆豆付, 宫爆鸡丁
// Deliberately NOT mapped (ambiguous — the fuzzy "Did you mean" list
// handles them instead of guessing wrong):
//   馒头 (filled bun in some regions, plain steamed bun in others — no
//   single dish), 包子 (5 bao dishes), 土豆丝 (no such dish on the list),
//   河粉 (no such dish — fuzzy suggests 肠粉, 1 char away), 清汤 (wonton
//   in Sichuan, clear broth elsewhere), 番茄 on its own (3 tomato dishes).
window.CHINABITE_ALIASES = {
  // ---- A. Regional names (Chinese) ----
  "西红柿炒鸡蛋": "tomato-egg", "西红柿炒蛋": "tomato-egg",
  "番茄炒鸡蛋": "tomato-egg", "番茄炒蛋": "tomato-egg",
  "馄饨": "guangzhou-wonton", "抄手": "guangzhou-wonton", "云吞": "guangzhou-wonton",
  "扁肉": "shaxian-bianrou",
  "水饺": "jiaozi", "蒸饺": "jiaozi",
  "米粉": "guilin-mifen",
  "米线": "guoqiao-mixian",
  "辣子鸡丁": "lazi-chicken",
  "牛肉拉面": "lanzhou",
  "东坡肉": "hangzhou-dongporou",
  "左宗棠鸡": "general-tsos-chicken",
  "左宗棠": "general-tsos-chicken",
  "陈皮鸡": "orange-chicken",
  "橙香鸡": "orange-chicken",
  "橙汁鸡": "orange-chicken",
  "蒙古牛肉": "mongolian-beef",
  "蒙古牛": "mongolian-beef",
  "芙蓉蛋": "egg-foo-young",
  "蟹角": "crab-rangoon",
  "杂碎": "chop-suey",
  "柠檬鸡": "lemon-chicken",
  "甜酸肉": "sweet-sour-pork",
  "牛肉西兰花": "beef-broccoli",
  "芝麻鸡": "sesame-chicken",
  "云吞汤": "wonton-soup",
  "蛋花汤": "egg-drop-soup",
  "酸辣汤海外版": "hot-sour-soup-overseas",
  "海外版酸辣汤": "hot-sour-soup-overseas",
  "炒面": "chow-mein",
  "捞面": "lo-mein",
  // ---- B. Pinyin (toneless) ----
  "fanqie chaodan": "tomato-egg", "fanqie chao dan": "tomato-egg",
  "huntun": "guangzhou-wonton", "chaoshou": "guangzhou-wonton", "yuntun": "guangzhou-wonton",
  "bianrou": "shaxian-bianrou",
  "shuijiao": "jiaozi", "zhengjiao": "jiaozi",
  "mifen": "guilin-mifen",
  "mixian": "guoqiao-mixian",
  "liangpi": "xian-liangpi",
  "luoshifen": "liuzhou-luoshifen",
  "zuo zongtang ji": "general-tsos-chicken",
  "zuozongtangji": "general-tsos-chicken",
  "chen pi ji": "orange-chicken",
  "cheng xiang ji": "orange-chicken",
  "menggu niurou": "mongolian-beef",
  "furong dan": "egg-foo-young",
  "xie jiao": "crab-rangoon",
  "za sui": "chop-suey",
  "ningmeng ji": "lemon-chicken",
  "tian suan rou": "sweet-sour-pork",
  "niurou xilan hua": "beef-broccoli",
  "niurou xilanhua": "beef-broccoli",
  "zhima ji": "sesame-chicken",
  "yuntun tang": "wonton-soup",
  "dan hua tang": "egg-drop-soup",
  "suan la tang haiwai ban": "hot-sour-soup-overseas",
  "chao mian": "chow-mein",
  "lao mian": "lo-mein",
  // ---- C. English variants ----
  "tomato egg": "tomato-egg", "tomato and egg": "tomato-egg",
  "tomato scrambled egg": "tomato-egg", "tomato scrambled eggs": "tomato-egg",
  "beijing duck": "peking-duck",
  "scallion pancake": "congyou-bing", "scallion pancakes": "congyou-bing",
  "mapo": "mapo-tofu",
  "wonton": "guangzhou-wonton", "wontons": "guangzhou-wonton",
  "chinese crepe": "jianbing",
  "general tso's chicken": "general-tsos-chicken",
  "general tso chicken": "general-tsos-chicken",
  "general tsos chicken": "general-tsos-chicken",
  "tso chicken": "general-tsos-chicken",
  "orange chicken": "orange-chicken",
  "orange peel chicken": "orange-chicken",
  "mongolian beef": "mongolian-beef",
  "egg foo young": "egg-foo-young",
  "egg foo yung": "egg-foo-young",
  "egg fu yung": "egg-foo-young",
  "egg foo yong": "egg-foo-young",
  "crab rangoon": "crab-rangoon",
  "crab rangoons": "crab-rangoon",
  "cream cheese wontons": "crab-rangoon",
  "cream cheese wonton": "crab-rangoon",
  "chop suey": "chop-suey",
  "lemon chicken": "lemon-chicken",
  "sweet and sour pork": "sweet-sour-pork",
  "sweet sour pork": "sweet-sour-pork",
  "sweet & sour pork": "sweet-sour-pork",
  "goo loo yuk": "sweet-sour-pork",
  "koo loo yuk": "sweet-sour-pork",
  "beef and broccoli": "beef-broccoli",
  "beef broccoli": "beef-broccoli",
  "broccoli beef": "beef-broccoli",
  "sesame chicken": "sesame-chicken",
  "wonton soup": "wonton-soup",
  "egg drop soup": "egg-drop-soup",
  "egg flower soup": "egg-drop-soup",
  "hot and sour soup overseas": "hot-sour-soup-overseas",
  "hot & sour soup overseas": "hot-sour-soup-overseas",
  "chow mein": "chow-mein",
  "lo mein": "lo-mein",
  // ---- D. Short forms ----
  "麻婆": "mapo-tofu", "回锅": "huiguo-pork", "宫保": "kung-pao",
  "鱼香": "yuxiang", "担担": "dandan-mian", "小笼": "xiaolongbao",
  "生煎": "shengjian-bao", "烤鸭": "peking-duck", "凉皮": "xian-liangpi",
  "宫保鸡": "kung-pao", "鱼香肉": "yuxiang", "炸酱": "zhajiang",
  // ---- E. Common typos ----
  "麻婆豆付": "mapo-tofu", "麻婆豆府": "mapo-tofu",
  "宫爆鸡丁": "kung-pao",
  "素麻婆豆腐": "mapo-tofu-veg", "麻婆豆腐无肉": "mapo-tofu-veg",
  "无肉麻婆豆腐": "mapo-tofu-veg"
};
