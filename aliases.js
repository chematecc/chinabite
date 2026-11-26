// China Bite — dish alias map (v5.3).
// ONE place for every "same dish, different name". Keys are matched AFTER
// app.js normStr() runs (lowercase, tone marks stripped, full-width folded,
// all spaces + punctuation dropped), so write keys in their natural form:
// "西红柿炒鸡蛋", "fanqie chaodan" and "tomato egg" all work.
// Value = dish id in data.js. Aliases NEVER change a dish's verdict, price
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
  // ---- B. Pinyin (toneless) ----
  "fanqie chaodan": "tomato-egg", "fanqie chao dan": "tomato-egg",
  "huntun": "guangzhou-wonton", "chaoshou": "guangzhou-wonton", "yuntun": "guangzhou-wonton",
  "bianrou": "shaxian-bianrou",
  "shuijiao": "jiaozi", "zhengjiao": "jiaozi",
  "mifen": "guilin-mifen",
  "mixian": "guoqiao-mixian",
  "liangpi": "xian-liangpi",
  "luoshifen": "liuzhou-luoshifen",
  // ---- C. English variants ----
  "tomato egg": "tomato-egg", "tomato and egg": "tomato-egg",
  "tomato scrambled egg": "tomato-egg", "tomato scrambled eggs": "tomato-egg",
  "beijing duck": "peking-duck",
  "scallion pancake": "congyou-bing", "scallion pancakes": "congyou-bing",
  "mapo": "mapo-tofu",
  "wonton": "guangzhou-wonton", "wontons": "guangzhou-wonton",
  "chinese crepe": "jianbing",
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
