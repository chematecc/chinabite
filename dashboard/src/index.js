// China Bite Dashboard Worker — 独立于 chinavisacheck，不动它的 /api/admin。
// 只读 china-bite-dev 的数据（src/data.js，由 data.js 生成），不编造流量/订单/收入。
// 事件统计先放内存（Worker 实例重启即清零），正式版接 D1 后再持久化。
import { CHINABITE_DATA } from "./data.js";

const SITEMAP_COUNT = 133; // china-bite-dev/sitemap.xml 实测 <url> 条数，2026-11-26（110 道菜后）
const FAQ_COUNT = 11; // index.html JSON-LD FAQPage mainEntity 实测，2026-11-26
const SITE_URL = "https://chinabite.chinavisacheck.com";
const PAGES_DEV_URL = "https://chinabite-5qq.pages.dev"; // chinabite.pages.dev 被别的账号占了，实际备用是 chinabite-5qq
const SITE_URLS = [
  `${SITE_URL}/`,
  `${SITE_URL}/sitemap.xml`,
  `${SITE_URL}/robots.txt`,
  `${SITE_URL}/llms.txt`,
  `${PAGES_DEV_URL}/`,
];
const EVENT_KINDS = ["decode", "share", "ad_view", "kit_click"];

// ---- 客服：工单 + 机器人 + 邮件自动回复（模板，Resend 未接，只生成不发送）----
const SUPPORT_TYPES = {
  decode: "解码不对",
  allergy: "过敏 / 清真",
  qr: "扫码点餐",
  payment: "支付 / Kit",
  other: "其他",
};
const SUPPORT_STATUSES = ["auto_replied", "needs_info", "closed"];
const STATUS_ZH = { auto_replied: "已自动回复", needs_info: "待补充信息", closed: "已关闭" };

// ---- Dashboard 登录：30 天 session token（只存 token，不存密码）----
// 密码只存在 Worker 环境变量 ADMIN_PASSWORD 里，前端代码和 localStorage 里都没有密码。
// token 在内存（Worker 重启清零），有效期 30 天；退出登录即作废。
const authTokens = new Map(); // token -> expiresAt (ms)
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;
function bearerToken(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
function validAuthToken(request) {
  const t = bearerToken(request);
  if (!t) return null;
  const exp = authTokens.get(t);
  if (!exp || exp <= Date.now()) { if (exp) authTokens.delete(t); return null; }
  return { token: t, expiresAt: new Date(exp).toISOString() };
}
function issueAuthToken() {
  const rand = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const token = `${crypto.randomUUID()}-${rand}`;
  const expiresAt = Date.now() + THIRTY_DAYS_MS;
  authTokens.set(token, expiresAt);
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

// ---- Kit App：Trip Pass $6.99，一次解锁 90 天 ----
// 解锁码格式 CB-KIT-XXXX-XXXX；正式版由 Stripe 支付成功后发码（Stripe 未接，不收款）。
// token 在内存（Worker 重启清零）；过期后 /api/kit/status 返回 expired，Kit 页显示“已到期 + 重新购买”。
const kitTokens = new Map(); // token -> { token, code, plan, unlockedAt, expiresAt }
const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000;
const KIT_CODE_RE = /^CB-KIT-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
function kitStatusFor(token) {
  const rec = kitTokens.get(token);
  if (!rec) return null;
  const expMs = new Date(rec.expiresAt).getTime();
  if (expMs <= Date.now()) return { ...rec, active: false, expired: true, daysLeft: 0 };
  return { ...rec, active: true, expired: false, daysLeft: Math.ceil((expMs - Date.now()) / 86400000) };
}
const SITE_LINK = "https://chinabite.chinavisacheck.com";

// 内存工单（演示用，重启清零；正式版接 D1）
const tickets = [];
let ticketSeq = 0;

function newTicketId() {
  ticketSeq += 1;
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `CB-${ymd}-${String(ticketSeq).padStart(4, "0")}`;
}

function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// ---- 语言 + 称呼 + 落款（机器人：语言跟随提问者，真名问候，包子 Bun 落款）----
const LANGS = ["en", "zh", "ja", "ko", "de", "fr"];
// 吉祥物名字是“包子 Bun”（Oliver 2026-11-26 定名；形象仍是饺子图，不重画）。
const MASCOT_SIGNOFF = {
  en: "— Bun, China Bite",
  zh: "—— 包子 Bun，China Bite",
  ja: "—— 包子 Bun（バン）、China Bite",
  ko: "—— 包子 Bun（번）、China Bite",
  de: "— Bun von China Bite",
  fr: "— Bun de China Bite",
};
const LINKS_LABEL = { en: "Details:", zh: "详情：", ja: "詳細：", ko: "자세히:", de: "Details:", fr: "Détails :" };

function detectLang(q, hint) {
  if (hint && LANGS.includes(hint)) return hint;
  const s = String(q || "");
  if (/[\u3040-\u30ff]/.test(s)) return "ja"; // 平假名/片假名
  if (/[\uac00-\ud7a3]/.test(s)) return "ko"; // 谚文
  if (/[\u4e00-\u9fff]/.test(s)) return "zh"; // 汉字
  const l = s.toLowerCase();
  if (/\b(je|j'ai|puis-je|suis|peux|pouvez|comment|pourquoi|où|trouver|chercher|manger|avez-vous|bonjour)\b/.test(l) || /que faire|est-ce|cacahuète|épicé|sans gluten|aux\b/.test(l)) return "fr";
  if (/\b(ich|kann|nicht|habe|bin)\b/.test(l) || /erdnuss|erdnüsse|scharf|gegen\b/.test(l) || /[äöüß]/.test(l)) return "de";
  if (/\b(allergie|allergique)\b/.test(l)) return "fr";
  return "en";
}

// 真名问候：优先用发件人姓名；姓名是 test/空/含 @ 时，从邮箱前缀推断（anna@example.com → Anna）；
// 姓名和邮箱都不可用时不写名字，只写通用问候——绝不写 test。
function displayName(name, email) {
  if (typeof name === "string") {
    const n = name.trim();
    if (n && !/test/i.test(n) && !n.includes("@")) return n;
  }
  if (typeof email === "string") {
    const local = email.trim().split("@")[0] || "";
    const parts = local.split(/[._\-+]+/).filter((p) => p && !/test|admin|info|hello|support/i.test(p));
    if (parts.length) return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return "";
}
function greeting(lang, name) {
  const g = {
    en: name ? `Hi ${name},` : "Hi there,",
    zh: name ? `你好，${name}，` : "你好，",
    ja: name ? `${name}さん、こんにちは。` : "こんにちは。",
    ko: name ? `${name}님, 안녕하세요.` : "안녕하세요.",
    de: name ? `Hallo ${name},` : "Hallo,",
    fr: name ? `Bonjour ${name},` : "Bonjour,",
  };
  return g[lang] || g.en;
}
// 先回答后给链接：正文 + 链接行 + 落款，三段拼成完整回复。
function compose(lang, name, body, links) {
  const parts = [greeting(lang, name), body];
  if (links && links.length) parts.push(`${LINKS_LABEL[lang] || "Details:"} ${links.join(" ")}`);
  parts.push(MASCOT_SIGNOFF[lang] || MASCOT_SIGNOFF.en);
  return parts.join("\n");
}

const DIET_LABELS = {
  vegetarian: { en: "vegetarian", zh: "素食", ja: "ベジタリアン", ko: "채식", de: "vegetarisch", fr: "végétarien" },
  vegan: { en: "vegan", zh: "全素", ja: "ヴィーガン", ko: "비건", de: "vegan", fr: "vegan" },
  halal: { en: "halal", zh: "清真", ja: "ハラール", ko: "할랄", de: "halal", fr: "halal" },
  peanut: { en: "peanut allergy", zh: "花生过敏", ja: "ピーナッツアレルギー", ko: "땅콩 알레르기", de: "Erdnussallergie", fr: "allergie aux cacahuètes" },
  shellfish: { en: "shellfish allergy", zh: "虾蟹过敏", ja: "甲殻類アレルギー", ko: "갑각류 알레르기", de: "Schalentiereallergie", fr: "allergie aux crustacés" },
  gluten: { en: "gluten-free", zh: "无麸质", ja: "グルテンフリー", ko: "글루텐 프리", de: "glutenfrei", fr: "sans gluten" },
  egg: { en: "egg allergy", zh: "蛋过敏", ja: "卵アレルギー", ko: "계란 알레르기", de: "Eiallergie", fr: "allergie aux œufs" },
  dairy: { en: "dairy allergy", zh: "奶过敏", ja: "乳アレルギー", ko: "유제품 알레르기", de: "Milchallergie", fr: "allergie aux produits laitiers" },
  nospicy: { en: "no spicy", zh: "不吃辣", ja: "辛いものなし", ko: "매운 음식 금지", de: "nicht scharf", fr: "pas épicé" },
  treenut: { en: "tree nut allergy", zh: "坚果过敏", ja: "ナッツアレルギー", ko: "견과류 알레르기", de: "Nussallergie", fr: "allergie aux fruits à coque" },
  sesame: { en: "sesame allergy", zh: "芝麻过敏", ja: "ごまアレルギー", ko: "참깨 알레르기", de: "Sesamallergie", fr: "allergie au sésame" },
  soy: { en: "soy allergy", zh: "大豆过敏", ja: "大豆アレルギー", ko: "대두 알레르기", de: "Sojaallergie", fr: "allergie au soja" },
};
const dietLabel = (id, lang) => (DIET_LABELS[id] && DIET_LABELS[id][lang]) || id;

// 超出知识库的信号：订酒店/机票/火车票/签证——不在 110 道菜 + 12 张卡 + FAQ 11 问 + 10 城范围内，
// 走兜底跟进（请用户补充信息），不承诺人工回复。
const OUT_OF_SCOPE = ["hotel", "酒店", "订房", "机票", "flight", "train ticket", "火车票", "签证", "visa", "订票", "book a hotel", "book a flight"];
const isOutOfScope = (q) => OUT_OF_SCOPE.some((k) => q.toLowerCase().includes(k.toLowerCase()));

// 日文汉字→简体中文归一（只用于匹配：宮保鶏丁→宫保鸡丁，拉麺→拉面），回答原文不动。
const JP_KANJI_MAP = { "鶏": "鸡", "鷄": "鸡", "麺": "面", "麵": "面", "飯": "饭", "餃": "饺", "湯": "汤", "魚": "鱼", "龍": "龙", "龜": "龟", "園": "园", "學": "学", "會": "会", "來": "来", "蝦": "虾", "豬": "猪", "鳥": "鸟", "貝": "贝", "麥": "麦", "燒": "烧", "醬": "酱", "鹽": "盐", "鰻": "鳗", "鮨": "寿司", "宮": "宫", "價": "价", "錢": "钱", "點": "点", "飲": "饮", "館": "馆", "廳": "厅", "廣": "广", "門": "门", "問": "问", "題": "题", "場": "场", "歳": "岁", "話": "话", "語": "语", "読": "读", "書": "书", "寫": "写", "買": "买", "賣": "卖", "開": "开", "閉": "闭", "間": "间", "關": "关", "報": "报", "驛": "驿", "樂": "乐", "樣": "样", "檢": "检", "驗": "验", "應": "应", "擇": "择", "澤": "泽", "達": "达", "邊": "边", "過": "过", "違": "违", "遠": "远", "選": "选" };
function normalizeForMatch(q) {
  return String(q || "").replace(new RegExp(`[${Object.keys(JP_KANJI_MAP).join("")}]`, "g"), (c) => JP_KANJI_MAP[c] || c);
}

const FLAG_LABELS = {
  pork: { en: "pork", zh: "猪肉", ja: "豚肉", ko: "돼지고기", de: "Schweinefleisch", fr: "porc" },
  beef: { en: "beef", zh: "牛肉", ja: "牛肉", ko: "소고기", de: "Rindfleisch", fr: "bœuf" },
  chicken: { en: "chicken", zh: "鸡肉", ja: "鶏肉", ko: "닭고기", de: "Hähnchen", fr: "poulet" },
  duck: { en: "duck", zh: "鸭肉", ja: "鴨肉", ko: "오리고기", de: "Ente", fr: "canard" },
  fish: { en: "fish", zh: "鱼", ja: "魚", ko: "생선", de: "Fisch", fr: "poisson" },
  shrimp: { en: "shrimp", zh: "虾", ja: "エビ", ko: "새우", de: "Garnelen", fr: "crevettes" },
  egg: { en: "egg", zh: "蛋", ja: "卵", ko: "계란", de: "Ei", fr: "œuf" },
  dairy: { en: "dairy", zh: "奶", ja: "乳製品", ko: "유제품", de: "Milchprodukte", fr: "produits laitiers" },
  gluten: { en: "gluten", zh: "麸质", ja: "グルテン", ko: "글루텐", de: "Gluten", fr: "gluten" },
  peanut: { en: "peanut", zh: "花生", ja: "ピーナッツ", ko: "땅콩", de: "Erdnüsse", fr: "cacahuètes" },
  soy: { en: "soy", zh: "大豆", ja: "大豆", ko: "대두", de: "Soja", fr: "soja" },
  sesame: { en: "sesame", zh: "芝麻", ja: "ごま", ko: "참깨", de: "Sesam", fr: "sésame" },
  lard: { en: "lard", zh: "猪油", ja: "ラード", ko: "돼지기름", de: "Schmalz", fr: "saindoux" },
  stock: { en: "meat stock", zh: "肉汤", ja: "肉の出汁", ko: "육수", de: "Fleischbrühe", fr: "bouillon de viande" },
};
const flagLabel = (f, lang) => (FLAG_LABELS[f] && (FLAG_LABELS[f][lang] || FLAG_LABELS[f].en)) || f;
const DIET_KEYWORDS = [
  { id: "vegetarian", keys: ["vegetarian", "素食", "veggie", "ベジタリアン"] },
  { id: "vegan", keys: ["vegan", "全素", "ヴィーガン"] },
  { id: "halal", keys: ["halal", "清真", "穆斯林", "ハラール"] },
  { id: "peanut", keys: ["peanut", "花生", "ピーナッツ"] },
  { id: "shellfish", keys: ["shellfish", "虾蟹", "贝类", "虾过敏", "蟹过敏", "甲殻類"] },
  { id: "gluten", keys: ["gluten", "麸质", "小麦", "グルテン"] },
  { id: "egg", keys: ["egg allergy", "蛋过敏", "鸡蛋过敏"] },
  { id: "dairy", keys: ["dairy", "奶过敏", "牛奶过敏"] },
  { id: "nospicy", keys: ["no spicy", "不吃辣", "不能吃辣"] },
  { id: "treenut", keys: ["tree nut", "坚果过敏", "核桃过敏", "杏仁过敏"] },
  { id: "sesame", keys: ["sesame", "芝麻过敏"] },
  { id: "soy", keys: ["soy allergy", "大豆过敏"] },
];
// 各档案的禁忌 flag（l​ard / stock 只判“先问”，不直接判 Avoid）
const DIET_FORBIDDEN = {
  vegetarian: ["pork", "beef", "chicken", "duck", "fish", "shrimp"],
  vegan: ["pork", "beef", "chicken", "duck", "fish", "shrimp", "egg", "dairy"],
  halal: ["pork"],
  peanut: ["peanut"],
  shellfish: ["shrimp"],
  gluten: ["gluten"],
  egg: ["egg"],
  dairy: ["dairy"],
  nospicy: [],
  treenut: [],
  sesame: ["sesame"],
  soy: ["soy"],
};
const DIET_CARD_IDS = ["vegetarian", "vegan", "halal", "peanut", "shellfish", "egg", "dairy", "gluten", "nospicy", "treenut", "sesame", "soy"];

// FAQ 关键词规则（与开发站 JSON-LD FAQ 11 问一致；答案先回答问题本身，链接在后）
const FAQ_RULES = [
  { keys: ["qr", "扫码", "打不开", "点餐", "下单", "order"], link: "#qr", a: {
    en: "QR won't open? Show the order slip — the big Chinese slip on the table. Staff will order on their phone.",
    zh: "扫码打不开：给服务员看桌上的点单单，让他用店里手机帮你下单。",
    ja: "QRコードが開かないときは、テーブルにある注文票を店員に見せてください。店のスマホで注文してくれます。",
    ko: "QR 코드가 열리지 않으면 테이블에 있는 주문서를 직원에게 보여주세요. 가게 휴대폰으로 주문해 줍니다.",
    de: "QR-Code geht nicht auf? Zeigen Sie dem Personal den Bestellzettel auf dem Tisch — es bestellt dann über sein Handy.",
    fr: "Le QR code ne s'ouvre pas ? Montrez au serveur le bon de commande sur la table : il commandera avec son téléphone." } },
  { keys: ["alipay", "wechat", "支付", "付钱", "现金", "pay"], link: null, a: {
    en: "WeChat Pay or Alipay first. Cash at the counter also works.",
    zh: "先绑 Alipay / 微信支付。柜台付现金也可以。",
    ja: "Alipay か WeChat Pay を先に設定してください。レジでの現金払いもできます。",
    ko: "Alipay나 WeChat Pay를 먼저 설정하세요. 카운터에서 현금 결제도 됩니다.",
    de: "Am besten zuerst Alipay oder WeChat Pay einrichten. Barzahlung an der Kasse geht auch.",
    fr: "Configurez d'abord Alipay ou WeChat Pay. Le paiement en espèces à la caisse fonctionne aussi." } },
  { keys: ["delivery", "外卖", "送到酒店", "meituan", "美团", "dianping", "点评"], link: null, a: {
    en: "Dianping finds restaurants — scores, photos, price per person. Meituan delivers to your hotel: write the address in Chinese and ask the rider to leave it at the front desk.",
    zh: "点评找店看分，美团外卖送到酒店。地址写中文，让骑手放前台。",
    ja: "大众点评で店を探せます。美団ならホテルまで配達します。住所は中国語で書き、フロントに置いてもらってください。",
    ko: "디앤핑으로 식당을 찾으세요. 메이투안은 호텔까지 배달합니다. 주소는 중국어로 쓰고, 라이더에게 프런트에 맡겨 달라고 하세요.",
    de: "Mit Dianping finden Sie Restaurants — mit Bewertung, Fotos und Preis. Meituan liefert ins Hotel: Adresse auf Chinesisch angeben und den Fahrer bitten, es an der Rezeption abzugeben.",
    fr: "Trouvez un restaurant avec Dianping (notes, photos, prix). Meituan livre à l'hôtel : indiquez l'adresse en chinois et demandez au livreur de laisser la commande à la réception." } },
  { keys: ["free", "免费", "多少钱", "收费", "price", "cost"], link: null, a: {
    en: "3 free checks a day. Watch a 5s ad for +3 more. The Kit is $6.99 for 90 days.",
    zh: "每天免费 3 次。看 5 秒广告 +3 次。Kit $6.99，90 天。",
    ja: "1日3回まで無料です。5秒の広告を見ると+3回。Kit は $6.99 で 90 日間。",
    ko: "하루 3회 무료입니다. 5초 광고를 보면 +3회. Kit은 $6.99에 90일입니다.",
    de: "3 Checks pro Tag sind gratis. Ein 5-Sekunden-Werbespot gibt +3. Das Kit kostet $6.99 für 90 Tage.",
    fr: "3 vérifications gratuites par jour. Regardez une pub de 5 s pour +3. Le Kit coûte 6,99 $ pour 90 jours." } },
  { keys: ["spicy", "辣", "spice"], link: null, a: {
    en: "Spice scale 0–3: 0 not spicy, 3 very spicy. If you can't eat spicy food, say so before ordering.",
    zh: "辣度 0–3：0 不辣，3 很辣。怕辣点菜先说微辣或不要辣。",
    ja: "辛さは 0〜3：0 は辛くない、3 はとても辛いです。辛いものが苦手なら、注文前に伝えてください。",
    ko: "매운맛 0~3: 0은 안 매움, 3은 아주 매움. 매운 음식을 못 드시면 주문 전에 말씀하세요.",
    de: "Schärfe-Skala 0–3: 0 nicht scharf, 3 sehr scharf. Wer nichts Scharfes verträgt, sagt das am besten vor dem Bestellen.",
    fr: "Échelle de piquant 0–3 : 0 pas épicé, 3 très épicé. Si vous ne supportez pas le piquant, dites-le avant de commander." } },
  { keys: ["vegetarian", "素食", "veggie"], link: "#/diet/vegetarian", a: {
    en: "Lard, meat stock and oyster sauce hide in veg dishes. Ask first.",
    zh: "素菜里常有猪油、肉汤、蚝油。先问一句再点。",
    ja: "野菜料理にもラード、肉の出汁、オイスターソースが隠れています。まず聞いてください。",
    ko: "채소 요리에도 돼지기름, 육수, 굴 소스가 숨어 있습니다. 먼저 물어보세요.",
    de: "In Gemüsegerichten verstecken sich oft Schmalz, Fleischbrühe und Austernsauce. Bitte zuerst fragen.",
    fr: "Le saindoux, le bouillon de viande et la sauce d'huître se cachent dans les plats de légumes. Demandez d'abord." } },
  { keys: ["halal", "清真", "穆斯林"], link: "#/diet/halal", a: {
    en: "Look for the green 清真 sign. Ask staff.",
    zh: "找绿色的清真牌子。进店先问是不是清真。",
    ja: "緑色の「清真」の看板を探してください。店員にも聞いてください。",
    ko: "초록색 清真 간판을 찾으세요. 직원에게도 물어보세요.",
    de: "Achten Sie auf das grüne 清真-Schild. Fragen Sie das Personal.",
    fr: "Cherchez l'enseigne verte 清真. Demandez au personnel." } },
  { keys: ["peanut", "花生"], link: "#/diet/peanut", a: {
    en: "Peanuts hide in Sichuan dishes, noodles and hot pot sauce. Tell the waiter before ordering.",
    zh: "花生藏在川菜、面条、火锅蘸料里。点菜先说过敏。",
    ja: "ピーナッツは四川料理、麺類、火鍋のタレに隠れています。注文前に店員に伝えてください。",
    ko: "땅콩은 쓰촨 요리, 면, 훠궈 소스에 숨어 있습니다. 주문 전에 직원에게 말씀하세요.",
    de: "Erdnüsse verstecken sich in Sichuan-Gerichten, Nudeln und Hot-Pot-Sauce. Sagen Sie es dem Kellner vor dem Bestellen.",
    fr: "Les cacahuètes se cachent dans les plats du Sichuan, les nouilles et les sauces du hot pot. Prévenez le serveur avant de commander." } },
  { keys: ["city", "城市", "哪里吃", "去哪吃"], link: null, a: {
    en: "10 cities on the site. Each has 3 dishes for first-timers.",
    zh: "站上有 10 个城市，每城 3 道外国游客适合的菜。",
    ja: "サイトには 10 都市があり、それぞれ初めての方におすすめの 3 品があります。",
    ko: "사이트에 10개 도시가 있으며, 각 도시마다 처음 오신 분을 위한 요리 3가지가 있습니다.",
    de: "Auf der Seite gibt es 10 Städte. Jede hat 3 Gerichte für Erstbesucher.",
    fr: "Le site couvre 10 villes. Chacune propose 3 plats pour les nouveaux venus." } },
];

function findDish(q) {
  const nq = normalizeForMatch(q);
  const s = nq.toLowerCase();
  let best = null;
  for (const d of CHINABITE_DATA.dishes) {
    if (nq.includes(d.zh) || s.includes(d.en.toLowerCase()) || (d.py && s.includes(d.py.toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔù]/g, "")))) {
      if (!best || d.zh.length > best.zh.length) best = d;
    }
  }
  return best;
}

function findDiet(q) {
  const nq = normalizeForMatch(q);
  const s = nq.toLowerCase();
  for (const dk of DIET_KEYWORDS) {
    if (dk.keys.some((k) => s.includes(k.toLowerCase()))) return dk.id;
  }
  return null;
}

const CITY_KEYS = [
  { id: "shanghai", keys: ["shanghai", "上海"] },
  { id: "beijing", keys: ["beijing", "北京"] },
  { id: "chengdu", keys: ["chengdu", "成都"] },
  { id: "xian", keys: ["xi'an", "xian", "西安"] },
  { id: "guangzhou", keys: ["guangzhou", "广州"] },
  { id: "shenzhen", keys: ["shenzhen", "深圳"] },
  { id: "hangzhou", keys: ["hangzhou", "杭州"] },
  { id: "chongqing", keys: ["chongqing", "重庆"] },
  { id: "kunming", keys: ["kunming", "昆明"] },
  { id: "guilin", keys: ["guilin", "桂林"] },
];
function findCity(q) {
  const nq = normalizeForMatch(q);
  const s = nq.toLowerCase();
  for (const c of CITY_KEYS) {
    if (c.keys.some((k) => s.includes(k.toLowerCase()))) return CHINABITE_DATA.cities.find((x) => x.id === c.id) || null;
  }
  return null;
}

// ---- 机器人正文（六语；解释性文字按提问者语言，菜品事实原文照录）----
function dishBody(lang, dish, verdict) {
  const usd = (dish.price / CHINABITE_DATA.rate).toFixed(2);
  const n = dish.note || "";
  const t = {
    en: `${dish.zh} (${dish.en}): ${n}${n ? " " : ""}Watch out: ${dish.hidden || ""} Spice ${dish.spicy}/3. ¥${dish.price} (≈$${usd}).`,
    zh: `${dish.zh}：${n}${n ? "。" : ""}注意：${dish.hidden || ""}辣度 ${dish.spicy}/3。¥${dish.price}（≈$${usd}）。`,
    ja: `${dish.zh}（${dish.en}）：${n}${n ? "。" : ""} 注意：${dish.hidden || ""} 辛さ ${dish.spicy}/3。¥${dish.price}（約$${usd}）。`,
    ko: `${dish.zh}(${dish.en}): ${n}${n ? " " : ""}주의: ${dish.hidden || ""} 매운맛 ${dish.spicy}/3. ¥${dish.price}(약 $${usd}).`,
    de: `${dish.zh} (${dish.en}): ${n}${n ? " " : ""}Achtung: ${dish.hidden || ""} Schärfe ${dish.spicy}/3. ¥${dish.price} (ca. $${usd}).`,
    fr: `${dish.zh} (${dish.en}) : ${n}${n ? " " : ""}Attention : ${dish.hidden || ""} Piquant ${dish.spicy}/3. ¥${dish.price} (environ $${usd}).`,
  };
  return (t[lang] || t.en) + (verdict ? ` ${verdict}` : "");
}
function verdictText(lang, dish, diet) {
  if (!diet) return "";
  const label = dietLabel(diet, lang);
  const bad = (dish.flags || []).filter((f) => (DIET_FORBIDDEN[diet] || []).includes(f));
  const badNames = bad.map((f) => flagLabel(f, lang)).join(lang === "zh" || lang === "ja" ? "、" : ", ");
  const soft = (dish.flags || []).filter((f) => f === "lard" || f === "stock");
  const v = {
    avoid: {
      en: `Don't order this for ${label} — it contains ${badNames}.`,
      zh: `按${label}，这道别点：里面有${badNames}。`,
      ja: `${label}の方は注文しないでください。${badNames}が入っています。`,
      ko: `${label}인 경우 주문하지 마세요. ${badNames}이(가) 들어 있습니다.`,
      de: `Für ${label} bitte nicht bestellen: Es enthält ${badNames}.`,
      fr: `Pour ${label}, ne commandez pas ce plat : il contient ${badNames}.`,
    },
    ask: {
      en: "Ask first — it may contain lard or meat stock.",
      zh: "先问一句：可能有猪油或肉汤。",
      ja: "まず聞いてください。ラードや肉の出汁が入っているかもしれません。",
      ko: "먼저 물어보세요. 돼지기름이나 육수가 들어 있을 수 있습니다.",
      de: "Bitte zuerst fragen — es kann Schmalz oder Fleischbrühe enthalten.",
      fr: "Demandez d'abord : il peut contenir du saindoux ou du bouillon de viande.",
    },
    spicy: {
      en: `Spice ${dish.spicy}/3 — ask for no chili.`,
      zh: `辣度 ${dish.spicy}/3，点菜说不要辣。`,
      ja: `辛さ ${dish.spicy}/3 — 唐辛子なしで注文してください。`,
      ko: `매운맛 ${dish.spicy}/3 — 고추 없이 주문하세요.`,
      de: `Schärfe ${dish.spicy}/3 — bitte ohne Chili bestellen.`,
      fr: `Piquant ${dish.spicy}/3 — commandez sans piment.`,
    },
    safe: {
      en: `Nothing in our record for this dish conflicts with ${label}, but lard or meat stock can still hide in it — ask before ordering.`,
      zh: `这道菜的记录里没有和${label}冲突的成分，但猪油、肉汤仍可能藏在里面，点前先问一句。`,
      ja: `この料理の記録には${label}と冲突するものはありませんが、ラードや肉の出汁が隠れていることもあります。注文前に聞いてください。`,
      ko: `이 요리의 기록에는 ${label}과(와) 충돌하는 것이 없지만, 돼지기름이나 육수가 숨어 있을 수 있으니 주문 전에 물어보세요.`,
      de: `In unseren Angaben zu diesem Gericht steht nichts, was ${label} widerspricht — Schmalz oder Fleischbrühe können sich aber trotzdem darin verstecken. Bitte vor dem Bestellen fragen.`,
      fr: `Rien dans nos informations sur ce plat ne contredit ${label}, mais du saindoux ou du bouillon de viande peuvent s'y cacher — demandez avant de commander.`,
    },
  };
  if (diet === "nospicy" && dish.spicy >= 2) return v.spicy[lang] || v.spicy.en;
  if (bad.length) return v.avoid[lang] || v.avoid.en;
  if (soft.length && (diet === "vegetarian" || diet === "vegan" || diet === "halal")) return v.ask[lang] || v.ask.en;
  return v.safe[lang] || v.safe.en;
}
const VEG_VARIANT_TEXT = {
  en: (v) => `The no-meat version is ${v.zh} — ask for that instead.`,
  zh: (v) => `无肉版是${v.zh}，点那个，点前先问油和汤。`,
  ja: (v) => `肉なしバージョンは${v.zh}です。そちらを注文してください。`,
  ko: (v) => `고기 없는 버전은 ${v.zh}입니다. 그걸로 주문하세요.`,
  de: (v) => `Die fleischlose Version ist ${v.zh} — bitte die bestellen.`,
  fr: (v) => `La version sans viande est ${v.zh} — commandez celle-là.`,
};
function cardBody(lang, card, diet) {
  const lines = card.lines.join(" / ");
  const base = {
    en: `Show this card to the waiter. In Chinese it says: ${lines} (${card.en}, ${card.zh}).`,
    zh: `把这张卡给服务员看，上面写的是：${lines}（${card.en}，${card.zh}）。`,
    ja: `このカードを店員に見せてください。中国語でこう書いてあります：${lines}（${card.en}、${card.zh}）。`,
    ko: `이 카드를 직원에게 보여주세요. 중국어로 이렇게 적혀 있습니다: ${lines} (${card.en}, ${card.zh}).`,
    de: `Zeigen Sie diese Karte dem Kellner. Auf Chinesisch steht darauf: ${lines} (${card.en}, ${card.zh}).`,
    fr: `Montrez cette fiche au serveur. En chinois, elle dit : ${lines} (${card.en}, ${card.zh}).`,
  };
  let extra = "";
  if (diet === "halal") {
    const h = {
      en: "To find a halal restaurant: look for the green 清真 sign on the door, search “清真” on Dianping, or ask staff “这是清真吗?” Our city guides list example halal places, but their addresses are not yet verified — please check on Dianping before you go.",
      zh: "找清真餐厅：看门口绿色的“清真”牌子，在点评上搜“清真”，或进店问“这是清真吗？”城市指南里的清真店只是示例，地址还没核实，去之前先在点评上确认。",
      ja: "ハラールレストランの探し方：店の入口にある緑色の「清真」の看板を探すか、大众点评で「清真」と検索するか、店員に「这是清真吗？」と聞いてください。都市ガイドのハラール店は例であり、住所は未確認です。行く前に大众点评で確認してください。",
      ko: "할랄 식당을 찾는 방법: 문에 있는 초록색 清真 간판을 찾거나, 디앤핑에서 “清真”을 검색하거나, 직원에게 “这是清真吗?”라고 물어보세요. 도시 가이드의 할랄 식당은 예시이며 주소는 아직 확인되지 않았습니다. 가기 전에 디앤핑에서 확인하세요.",
      de: "So finden Sie ein Halal-Restaurant: Achten Sie auf das grüne 清真-Schild an der Tür, suchen Sie auf Dianping nach „清真“ oder fragen Sie das Personal: „这是清真吗?“ Unsere Stadtführer nennen Beispiel-Lokale, deren Adressen aber noch nicht geprüft sind — bitte vorab auf Dianping kontrollieren.",
      fr: "Pour trouver un restaurant halal : cherchez l'enseigne verte 清真 sur la porte, recherchez « 清真 » sur Dianping, ou demandez au personnel « 这是清真吗 ? » Nos guides de ville citent des exemples, mais leurs adresses ne sont pas encore vérifiées — vérifiez sur Dianping avant d'y aller.",
    };
    extra = h[lang] || h.en;
  }
  return (base[lang] || base.en) + (extra ? ` ${extra}` : "");
}
function cityBody(lang, city) {
  const dishes = city.mustEat.map((m) => {
    const d = CHINABITE_DATA.dishes.find((x) => x.id === m.id);
    return d ? `${d.zh} (${d.en})` : m.id;
  }).join("、");
  const t = {
    en: `In ${city.en} (${city.zh}), try these three first: ${dishes}. Tip: ${city.tip} Getting around: ${city.transport}`,
    zh: `在${city.zh}，先吃这三道：${dishes}。提醒：${city.tip}交通：${city.transport}`,
    ja: `${city.zh}（${city.en}）では、まずこの3品をどうぞ：${dishes}。ヒント：${city.tip} 移動：${city.transport}`,
    ko: `${city.zh}(${city.en})에서는 이 세 가지부터 드셔보세요: ${dishes}. 팁: ${city.tip} 이동: ${city.transport}`,
    de: `In ${city.en} (${city.zh}) probieren Sie zuerst diese drei: ${dishes}. Tipp: ${city.tip} Unterwegs: ${city.transport}`,
    fr: `À ${city.en} (${city.zh}), goûtez d'abord ces trois plats : ${dishes}. Conseil : ${city.tip} Pour vous déplacer : ${city.transport}`,
  };
  return t[lang] || t.en;
}
// 超出知识库：委婉跟进 + 请用户补充信息。
const FALLBACK_BODY = {
  en: "I don't have an answer for that in our 110 dishes, 12 diet cards, or 10 city guides yet. Could you tell me a bit more — the dish name, the city you're in, and any allergy or diet you follow? Once you add that, I'll look it up for you.",
  zh: "这个问题我手头的 110 道菜、12 张饮食卡、10 城指南里还没有现成答案。你能再补充一点吗——菜名、你在哪个城市、有什么过敏或饮食要求？补充后我再帮你查。",
  ja: "その質問には、110品の料理、12枚のダイエットカード、10都市のガイドの中にまだ答えがありません。料理名、今いる都市、アレルギーや食事制限をもう少し教えていただけますか？教えていただければ、改めて調べます。",
  ko: "그 질문에 대한 답은 110가지 요리, 12장의 식단 카드, 10개 도시 가이드 안에 아직 없습니다. 요리 이름, 지금 계신 도시, 알레르기나 식단 제한을 조금 더 알려주시겠어요? 알려주시면 다시 찾아보겠습니다.",
  de: "Dafür habe ich in unseren 110 Gerichten, 12 Diätkarten und 10 Stadtführern noch keine Antwort. Könnten Sie noch etwas ergänzen — den Namen des Gerichts, die Stadt, in der Sie sind, und Allergien oder Ernährungswünsche? Dann schaue ich noch einmal nach.",
  fr: "Je n'ai pas encore de réponse à cette question dans nos 110 plats, 12 fiches régime et 10 guides de ville. Pouvez-vous préciser — le nom du plat, la ville où vous êtes, vos allergies ou votre régime ? Avec ces détails, je chercherai à nouveau.",
};

// 机器人：菜名 > 超出范围 > 饮食卡 > 城市 > FAQ > 兜底跟进
// 链接用 #/dish/<id> / #/diet/<id> / #/city/<id> 形式；先回答问题本身，链接在后。
function botAnswer(question, opts = {}) {
  const q = (question || "").trim();
  const lang = detectLang(q, opts.lang);
  const name = displayName(opts.name, opts.email);
  const build = (bodyFn, links) => {
    const bodies = {};
    const answers = {};
    for (const l of LANGS) {
      bodies[l] = bodyFn(l);
      answers[l] = compose(l, name, bodies[l], links);
    }
    return { lang, body: bodies[lang], bodies, answer: answers[lang], answers, links: links || [] };
  };
  const dish = findDish(q);
  const diet = findDiet(q);
  if (dish) {
    const veg = CHINABITE_DATA.dishes.find((d) => d.id === `${dish.id}-veg`);
    const bad = diet ? (dish.flags || []).filter((f) => (DIET_FORBIDDEN[diet] || []).includes(f)) : [];
    const links = [`#/dish/${dish.id}`];
    if (diet) links.push(`#/diet/${diet}`);
    if (veg && bad.length) links.push(`#/dish/${veg.id}`);
    const r = build((l) => {
      let b = dishBody(l, dish, verdictText(l, dish, diet));
      if (veg && bad.length) b += ` ${(VEG_VARIANT_TEXT[l] || VEG_VARIANT_TEXT.en)(veg)}`;
      return b;
    }, links);
    return { ...r, matched: "dish", dishId: dish.id, waiter: dish.waiter || "" };
  }
  if (isOutOfScope(q)) {
    const r = build((l) => FALLBACK_BODY[l] || FALLBACK_BODY.en, []);
    return { ...r, matched: "fallback", waiter: "" };
  }
  if (diet && DIET_CARD_IDS.includes(diet)) {
    const card = CHINABITE_DATA.cards.find((c) => c.id === diet);
    const r = build((l) => (card ? cardBody(l, card, diet) : dietLabel(diet, l)), [`#/diet/${diet}`]);
    return { ...r, matched: "card", cardId: diet, waiter: card ? card.lines.join(" ") : "" };
  }
  const city = findCity(q);
  if (city) {
    const links = [`#/city/${city.id}`, ...city.mustEat.map((m) => `#/dish/${m.id}`)];
    const r = build((l) => cityBody(l, city), links);
    return { ...r, matched: "city", cityId: city.id, waiter: "" };
  }
  const s = normalizeForMatch(q).toLowerCase();
  for (const rule of FAQ_RULES) {
    if (rule.keys.some((k) => s.includes(k.toLowerCase()))) {
      const r = build((l) => rule.a[l] || rule.a.en, rule.link ? [rule.link] : []);
      return { ...r, matched: "faq", waiter: "" };
    }
  }
  const r = build((l) => FALLBACK_BODY[l] || FALLBACK_BODY.en, []);
  return { ...r, matched: "fallback", waiter: "" };
}

// 邮件自动回复模板（slide 风格短句）。只生成文本，不发送。
// 语言跟随提问者；先回答后给链接；不承诺人工回复；落款包子 Bun。
function autoReplyTemplate(ticket, bot) {
  const lang = ticket.lang || "zh";
  const name = displayName(ticket.name, ticket.email);
  const subjects = {
    en: `Got it — China Bite ticket ${ticket.id}`,
    zh: `已收到 — China Bite 工单 ${ticket.id}`,
    ja: `受け取りました — China Bite 工单 ${ticket.id}`,
    ko: `받았습니다 — China Bite 工单 ${ticket.id}`,
    de: `Angekommen — China Bite 工单 ${ticket.id}`,
    fr: `Bien reçu — China Bite 工单 ${ticket.id}`,
  };
  const received = {
    en: `We got your message. Ticket: ${ticket.id}`,
    zh: `你的消息收到了。工单号：${ticket.id}`,
    ja: `メッセージを受け取りました。工单番号：${ticket.id}`,
    ko: `메시지를 받았습니다. 工单 번호: ${ticket.id}`,
    de: `Ihre Nachricht ist angekommen. Ticket: ${ticket.id}`,
    fr: `Votre message est bien arrivé. Ticket : ${ticket.id}`,
  };
  const buildText = (l) => {
    const body = (bot && bot.bodies && bot.bodies[l]) || (bot && bot.body) || "";
    const links = bot && bot.links && bot.links.length ? `${LINKS_LABEL[l] || "Details:"} ${bot.links.join(" ")}` : "";
    return [greeting(l, name), received[l] || received.en, "", body, "", links, MASCOT_SIGNOFF[l] || MASCOT_SIGNOFF.en, `China Bite: ${SITE_LINK}`].filter((x) => x !== "").join("\n");
  };
  return {
    subject: subjects[lang] || subjects.en,
    subject_en: subjects.en,
    subject_zh: subjects.zh,
    body: buildText(lang),
    en: buildText("en"),
    zh: buildText("zh"),
    resend: { connected: false, sent: false, status: "待接 Resend 后发送（Resend 未接，未发送）" },
  };
}

function createTicket(body) {
  const lang = detectLang(body.message, body.lang);
  const bot = botAnswer(body.message, { name: body.name, email: body.email, lang });
  const ticket = {
    id: newTicketId(),
    name: displayName(body.name, body.email) || body.name.trim(),
    email: body.email.trim(),
    lang,
    type: body.type,
    typeZh: SUPPORT_TYPES[body.type],
    message: body.message.trim(),
    status: bot.matched === "fallback" ? "needs_info" : "auto_replied",
    createdAt: new Date().toISOString(),
    botMatched: bot.matched,
    botAnswer: bot.answers,
    botAnswerText: bot.answer,
    botSummary: bot.body.length > 120 ? bot.body.slice(0, 120) + "…" : bot.body,
    botLinks: bot.links,
    autoReply: null,
  };
  ticket.autoReply = autoReplyTemplate(ticket, bot);
  tickets.unshift(ticket);
  return ticket;
}


// 内存事件计数（演示用，重启清零；正式版接 D1）
const events = { decode: 0, share: 0, ad_view: 0, kit_click: 0, total: 0 };

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function stats() {
  const dishes = CHINABITE_DATA.dishes;
  const spicy = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const flags = {};
  let minPrice = Infinity, maxPrice = -Infinity;
  for (const d of dishes) {
    spicy[d.spicy] = (spicy[d.spicy] || 0) + 1;
    for (const f of d.flags || []) flags[f] = (flags[f] || 0) + 1;
    if (d.price < minPrice) minPrice = d.price;
    if (d.price > maxPrice) maxPrice = d.price;
  }
  return {
    project: "China Bite",
    version: "dashboard-v1",
    generatedAt: new Date().toISOString(),
    dishes: dishes.length,
    profiles: CHINABITE_DATA.profiles.length,
    cards: CHINABITE_DATA.cards.length,
    cities: CHINABITE_DATA.cities.length,
    cityPlaces: CHINABITE_DATA.cities.reduce((n, c) => n + c.places.length, 0),
    qrButtons: CHINABITE_DATA.qrButtons.length,
    sitemapUrls: SITEMAP_COUNT,
    faqCount: FAQ_COUNT,
    priceRangeCNY: [minPrice, maxPrice],
    priceRate: CHINABITE_DATA.rate,
    priceRateDate: CHINABITE_DATA.rateDate,
    spicyDistribution: spicy,
    flagCounts: flags,
    // 以下三项尚未接通：没有就是 0 / 未接通，不编造
    traffic: null,
    orders: 0,
    revenueUSD: 0,
    d1Connected: false,
    stripeConnected: false,
    support: { tickets: tickets.length, autoReplied: tickets.filter((t) => t.status === "auto_replied").length, needsInfo: tickets.filter((t) => t.status === "needs_info").length, closed: tickets.filter((t) => t.status === "closed").length, resendConnected: false },
    note: "流量/订单/收入未接通。事件统计为内存计数，重启清零；正式版接 D1。",
  };
}

async function checkUrl(url) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    // 只读状态码和少量内容判断，不下载整个页面
    const text = await r.text();
    return { url, ok: r.ok, status: r.status, ms: Date.now() - started, bytes: text.length, error: null };
  } catch (e) {
    return { url, ok: false, status: null, ms: Date.now() - started, bytes: 0, error: String(e && e.name || e) };
  }
}

// ---- Bun 聊天 LLM：system prompt + RAG 召回（/api/chat 用）----
// Bun 的身份：一个在中国生活的朋友，带第一次来中国的外国游客吃饭。
// 活人感、结论先行、短句、英文优先。不知道就说不知道，绝不编造。
// 过敏 / 清真问题宁可保守：不确定就说先问服务员，不要给“能吃”的结论。
// 价格只用下面上下文里给的数字；地址一律不编造（没有核实的地址就说没核实）。
const BUN_SYSTEM_PROMPT = `You are Bun, a cheerful dumpling and a food friend who lives in China. You help first-time visitors to China eat well — you speak like a friend sitting next to them, not like a manual.

Voice: warm, human, second person ("you"), short sentences, conclusion first. English first; add the Chinese dish name and one big Chinese waiter sentence when it helps them order. Never sound like a system prompt, a form, or a customer-service script.

Rules — never break these:
- Answer ONLY from the "What you know" context below. If the dish, price, or place is not in it, say you don't know it yet and suggest 2-3 close dishes from the list instead. Never invent a dish name, an ingredient, a price, or a restaurant address.
- Prices: use ONLY the ¥ prices in the context. Never guess a price.
- Addresses: we have NO verified restaurant addresses. Never give one. If asked where to eat, point to the city guide's area + "search the name on Dianping and check the score" — never a street address.
- Allergies and halal: be conservative. If you are not sure a dish is safe, say "Ask them first" and give the exact Chinese sentence to ask. Never say "you're good" when pork, lard, meat stock, peanuts, or shellfish might be hiding in it.
- Spice: use the 0-3 scale from the context (0 not spicy, 3 very spicy).
- Keep replies short: 2-4 short sentences, then stop. If a dish verdict is needed, lead with it: "You're good", "Skip this one", or "Ask them first" — then one line why.
- Do not promise human customer service. Do not mention that you are an AI model, an API, or a language model. You are Bun.`;
function chatContext(q, prof) {
  const norm = normalizeForMatch(q || "");
  const s = norm.toLowerCase();
  const tokens = s.split(/[^a-z0-9\u4e00-\u9fff]+/).filter((t) => t.length >= 2);
  const scored = CHINABITE_DATA.dishes.map((d) => {
    let score = 0;
    if (norm.includes(d.zh) || s.includes(d.en.toLowerCase())) score += 100;
    tokens.forEach((t) => {
      if (d.en.toLowerCase().includes(t) || d.zh.includes(t) || (d.py || "").toLowerCase().includes(t)) score += 3;
    });
    return { d, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const dishIds = scored.map((x) => x.d.id);
  const lines = scored.map((x) => {
    const d = x.d;
    return `- ${d.zh} (${d.en}, ${d.py || ""}) — ¥${d.price}, spice ${d.spicy}/3, contains: ${(d.flags || []).join(", ") || "nothing flagged"}. Note: ${d.note || ""} Waiter line: ${d.waiter || ""}`;
  });
  const dietId = findDiet(q);
  const card = dietId ? CHINABITE_DATA.cards.find((c) => c.id === dietId) : null;
  const city = findCity(q);
  const cityObj = city || (prof && prof.city ? CHINABITE_DATA.cities.find((c) => c.id === prof.city) : null);
  const profLine = prof && (prof.city || prof.diet || prof.craving)
    ? `User profile (remembered on their phone): city=${(prof.city && (CHINABITE_DATA.cities.find((c) => c.id === prof.city) || {}).en) || "unknown"}, diet=${prof.diet || "none"}, craving=${prof.craving || "any"}. Judge every dish against this diet.`
    : "User profile: none yet.";
  const text = [
    profLine,
    "Relevant dishes (top 5 by keyword match):",
    ...(lines.length ? lines : ["(none matched — say you don't know this dish yet)"]),
    card ? `Diet card (${card.en} · ${card.zh}): ${card.lines.join(" / ")}` : "",
    cityObj ? `City: ${cityObj.en} (${cityObj.zh}). Scene: ${cityObj.scene} Must-eat: ${cityObj.mustEat.map((m) => { const dd = CHINABITE_DATA.dishes.find((x) => x.id === m.id); return dd ? `${dd.zh} (${dd.en})` : m.id; }).join("; ")}. Tip: ${cityObj.tip} Transport: ${cityObj.transport}` : "",
    "Free/paid: 3 free checks a day, Kit $6.99 for 90 days. Prices are reference only (2026-11-26, ¥, rate 7.1).",
  ].filter(Boolean).join("\n");
  return { text, dishIds, cardId: card ? card.id : null, cityId: cityObj ? cityObj.id : null };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- Dashboard 登录：30 天 session token ----
    if (path === "/api/auth/login" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      const adminPassword = env && env.ADMIN_PASSWORD;
      if (!adminPassword) return json({ ok: false, error: "ADMIN_PASSWORD 未设置，无法登录" }, 503);
      if (typeof body.password !== "string" || body.password !== adminPassword) return json({ ok: false, error: "密码不对" }, 401);
      const t = issueAuthToken();
      return json({ ok: true, token: t.token, expiresAt: t.expiresAt, expiresInDays: 30, note: "输一次密码，30 天内不用再输。token 只存浏览器 localStorage，密码不保存。" });
    }
    if (path === "/api/auth/login") return json({ ok: false, error: "只接受 POST" }, 405);

    if (path === "/api/auth/me") {
      const t = validAuthToken(request);
      if (!t) return json({ ok: false, authenticated: false, error: "未登录或 token 已过期" }, 401);
      return json({ ok: true, authenticated: true, expiresAt: t.expiresAt });
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      const t = bearerToken(request);
      if (t) authTokens.delete(t);
      return json({ ok: true, note: "已退出登录，token 已作废。" });
    }
    if (path === "/api/auth/logout") return json({ ok: false, error: "只接受 POST" }, 405);

    // ---- Kit App：一次解锁 90 天（Trip Pass $6.99）----
    if (path === "/api/kit/unlock" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      if (typeof body.code !== "string" || !KIT_CODE_RE.test(body.code.trim())) return json({ ok: false, error: "解锁码格式不对，应为 CB-KIT-XXXX-XXXX" }, 400);
      const rand = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const token = `kit-${crypto.randomUUID()}-${rand}`;
      const now = Date.now();
      const rec = { token, code: body.code.trim().toUpperCase(), plan: "Trip Pass", priceUSD: 6.99, days: 90, unlockedAt: new Date(now).toISOString(), expiresAt: new Date(now + NINETY_DAYS_MS).toISOString() };
      kitTokens.set(token, rec);
      return json({ ok: true, token, plan: rec.plan, unlockedAt: rec.unlockedAt, expiresAt: rec.expiresAt, daysLeft: 90, note: "本地演示解锁码；正式版由 Stripe 支付成功后发码（Stripe 未接，不收款）。" }, 201);
    }
    if (path === "/api/kit/unlock") return json({ ok: false, error: "只接受 POST" }, 405);

    if (path === "/api/kit/status") {
      const t = bearerToken(request);
      if (!t) return json({ ok: false, error: "没有 Kit token" }, 401);
      const st = kitStatusFor(t);
      if (!st) return json({ ok: false, error: "无效的 Kit token" }, 401);
      if (st.expired) return json({ ok: true, active: false, expired: true, plan: st.plan, unlockedAt: st.unlockedAt, expiresAt: st.expiresAt, daysLeft: 0, note: "已到期，请重新购买。" });
      return json({ ok: true, active: true, expired: false, plan: st.plan, unlockedAt: st.unlockedAt, expiresAt: st.expiresAt, daysLeft: st.daysLeft });
    }

    if (path === "/api/stats") return json(stats());

    if (path === "/api/dishes") {
      const q = (url.searchParams.get("q") || "").trim();
      const spicy = url.searchParams.get("spicy");
      const flag = url.searchParams.get("flag");
      let list = CHINABITE_DATA.dishes;
      if (q) {
        const s = q.toLowerCase();
        list = list.filter((d) => d.zh.includes(q) || d.en.toLowerCase().includes(s) || d.py.toLowerCase().includes(s));
      }
      if (spicy !== null && spicy !== "") list = list.filter((d) => String(d.spicy) === spicy);
      if (flag) list = list.filter((d) => (d.flags || []).includes(flag));
      return json({ total: list.length, dishes: list });
    }

    if (path === "/api/health") {
      const results = [];
      for (const u of SITE_URLS) results.push(await checkUrl(u));
      const up = results.filter((r) => r.ok).length;
      return json({
        checkedAt: new Date().toISOString(),
        site: SITE_URL,
        pagesDev: PAGES_DEV_URL,
        pagesDevNote: "备用地址 chinabite-5qq.pages.dev（chinabite.pages.dev 被别的账号占了）",
        up: `${up}/${results.length}`,
        allOk: up === results.length,
        results,
      });
    }

    if (path === "/api/events") {
      return json({ ...events, d1Connected: false, note: "内存计数，Worker 重启清零。正式版接 D1 后持久化。" });
    }

    if (path === "/api/event" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      const kind = body.kind;
      if (!EVENT_KINDS.includes(kind)) {
        return json({ ok: false, error: `kind 必须是 ${EVENT_KINDS.join(" / ")}` }, 400);
      }
      events[kind] += 1;
      events.total += 1;
      return json({ ok: true, kind, count: events[kind], total: events.total, d1Connected: false, note: "已记入内存，未写入 D1（未接）" });
    }
    if (path === "/api/event") return json({ ok: false, error: "只接受 POST" }, 405);

    if (path === "/api/support" && request.method === "GET") {
      // 客户邮件看板只给登录后的 Dashboard 看
      if (!validAuthToken(request)) return json({ ok: false, error: "请先登录 Dashboard" }, 401);
      const status = url.searchParams.get("status");
      let list = tickets;
      if (status && SUPPORT_STATUSES.includes(status)) list = tickets.filter((t) => t.status === status);
      return json({ total: list.length, tickets: list, resendConnected: false, note: "工单在内存，Worker 重启清零。正式版接 D1。邮件自动回复只生成模板，未发送（Resend 未接）。" });
    }

    if (path === "/api/support" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      if (!body.name || typeof body.name !== "string" || !body.name.trim()) return json({ ok: false, error: "name 不能为空" }, 400);
      if (!isEmail(body.email)) return json({ ok: false, error: "email 格式不对" }, 400);
      if (!SUPPORT_TYPES[body.type]) return json({ ok: false, error: `type 必须是 ${Object.keys(SUPPORT_TYPES).join(" / ")}` }, 400);
      if (!body.message || typeof body.message !== "string" || body.message.trim().length < 3) return json({ ok: false, error: "message 至少 3 个字" }, 400);
      const ticket = createTicket(body);
      return json({ ok: true, ticket, note: "工单已建。自动回复模板已生成，未发送（Resend 未接）。" }, 201);
    }
    if (path === "/api/support" && request.method !== "GET") return json({ ok: false, error: "只接受 GET / POST" }, 405);

    if (path === "/api/support/bot" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      if (!body.question || typeof body.question !== "string" || !body.question.trim()) return json({ ok: false, error: "question 不能为空" }, 400);
      const bot = botAnswer(body.question, { name: body.name, email: body.email, lang: body.lang });
      let ticket = null;
      if (bot.matched === "fallback" && body.email && isEmail(body.email) && body.name && body.name.trim()) {
        ticket = createTicket({ name: body.name, email: body.email, type: SUPPORT_TYPES[body.type] ? body.type : "other", message: body.question, lang: body.lang });
      }
      return json({ ok: true, question: body.question.trim(), lang: bot.lang, matched: bot.matched, answer: bot.answer, answers: bot.answers, body: bot.body, waiter: bot.waiter || "", dishId: bot.dishId || null, cardId: bot.cardId || null, cityId: bot.cityId || null, links: bot.links || [], ticketId: ticket ? ticket.id : null, ticketStatus: ticket ? ticket.status : null, note: ticket ? "超出知识库，已建工单待补充信息；自动回复模板已生成，未发送（Resend 未接）。" : "机器人按知识库回答，未建工单。" });
    }
    if (path === "/api/support/bot") return json({ ok: false, error: "只接受 POST" }, 405);

    if (path === "/api/support/close" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      const t = tickets.find((x) => x.id === body.ticketId);
      if (!t) return json({ ok: false, error: "找不到该工单号" }, 404);
      t.status = "closed";
      return json({ ok: true, ticket: t });
    }
    if (path === "/api/support/close") return json({ ok: false, error: "只接受 POST" }, 405);

    if (path === "/api/support/templates") {
      const lang = url.searchParams.get("lang") === "zh" ? "zh" : "en";
      const sample = { id: "CB-20261126-0001", name: "{name}", lang };
      const tpl = autoReplyTemplate(sample, { body: "{botAnswer}", bodies: { en: "{botAnswer_en}", zh: "{botAnswer_zh}", ja: "{botAnswer_ja}", ko: "{botAnswer_ko}", de: "{botAnswer_de}", fr: "{botAnswer_fr}" }, links: ["#/dish/{dishId}"] });
      return json({
        lang,
        subject: tpl.subject,
        body: tpl.body,
        placeholders: ["{name}", "{ticketId}", "{botAnswer}"],
        resend: tpl.resend,
        note: "模板预览。占位符 {name} / 工单号 / 机器人答案在发信时替换。未发送（Resend 未接）。",
      });
    }

    // ---- Bun 聊天：POST /api/chat（SiliconFlow LLM + RAG + SSE）----
    // 架构：浏览器绝不直接调 LLM（key 不能暴露在前端）。前端 chat.js
    // 调这里，Worker 拿消息 + profile + 召回的上下文去调 SiliconFlow，
    // 再把回答流回前端。key 只存在 Worker secret SILICONFLOW_API_KEY
    // 里，绝不写进代码/仓库。模型由 Worker env LLM_MODEL 配置，默认
    // deepseek-ai/DeepSeek-V3.2；该模型不可用时按顺序回退到
    // DeepSeek-V3.1 → Qwen3-32B。没有 key 时返回 503 LLM_KEY_MISSING，
    // 前端回退到本地规则机器人并诚实说明 —— 不阻塞上线。
    if (path === "/api/chat" && request.method === "OPTIONS") {
      const origin = request.headers.get("origin") || "";
      const allow = [SITE_URL, PAGES_DEV_URL].includes(origin) ? origin : SITE_URL;
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": allow,
          "access-control-allow-methods": "POST, GET, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        },
      });
    }
    if (path === "/api/chat/status") {
      return json({
        ok: true,
        provider: "siliconflow",
        baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
        model: (env && env.LLM_MODEL) || "deepseek-ai/DeepSeek-V3.2",
        fallbackModels: ["deepseek-ai/DeepSeek-V3.1", "Qwen/Qwen3-32B"],
        configured: !!(env && env.SILICONFLOW_API_KEY),
        stream: true,
        fallback: "local rules bot (110 dishes / 12 cards / 10 cities)",
        note: "未配置 SILICONFLOW_API_KEY 时 /api/chat 返回 503 LLM_KEY_MISSING，前端用本地规则机器人回答。",
      });
    }
    if (path === "/api/chat" && request.method === "POST") {
      const origin = request.headers.get("origin") || "";
      const allow = [SITE_URL, PAGES_DEV_URL].includes(origin) ? origin : SITE_URL;
      const cors = {
        "access-control-allow-origin": allow,
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "content-type",
      };
      const apiKey = env && env.SILICONFLOW_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ ok: false, error: "LLM_KEY_MISSING", fallback: true, message: "SiliconFlow key not set yet — answering from the local 110-dish list for now." }), {
          status: 503,
          headers: { "content-type": "application/json; charset=utf-8", ...cors },
        });
      }
      let body = {};
      try { body = await request.json(); } catch { return json({ ok: false, error: "body 不是合法 JSON" }, 400); }
      const msgs = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")).slice(-10) : [];
      if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ ok: false, error: "messages 至少要有一条 user 消息" }, 400);
      if (msgs.some((m) => m.content.length > 1000)) return json({ ok: false, error: "单条消息不能超过 1000 字" }, 400);
      const prof = (body.profile && typeof body.profile === "object") ? body.profile : {};
      const lastUser = msgs[msgs.length - 1].content;
      const ctx = chatContext(lastUser, prof);
      const system = BUN_SYSTEM_PROMPT + "\n\n## What you know — use ONLY this. Never invent a dish, a price, or an address.\n" + ctx.text;
      const payload = {
        model: (env && env.LLM_MODEL) || "deepseek-ai/DeepSeek-V3.2",
        messages: [{ role: "system", content: system }, ...msgs],
        temperature: 0.3,
        max_tokens: 600,
        stream: !!body.stream,
      };
      const models = [payload.model, "deepseek-ai/DeepSeek-V3.1", "Qwen/Qwen3-32B"].filter((m, i, a) => a.indexOf(m) === i);
      let upstream = null;
      let usedModel = null;
      let lastErr = "";
      for (const model of models) {
        try {
          const r = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ ...payload, model, stream: !!body.stream }),
          });
          if (r.ok) { upstream = r; usedModel = model; break; }
          lastErr = `model ${model}: HTTP ${r.status}`;
          // 模型不存在/不可用（404/400）才换下一个；限流/余额问题直接报错
          if (r.status !== 404 && r.status !== 400) break;
        } catch (e) { lastErr = String(e && e.message || e); break; }
      }
      if (!upstream) return json({ ok: false, error: "LLM_UPSTREAM_FAILED", fallback: true, detail: lastErr }, 502);
      if (body.stream) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            connection: "keep-alive",
            ...cors,
          },
        });
      }
      const data = await upstream.json().catch(() => null);
      const answer = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
      if (!answer) return json({ ok: false, error: "LLM_EMPTY", fallback: true }, 502);
      return json({ ok: true, answer, model: usedModel, dishes: ctx.dishIds, cardId: ctx.cardId, cityId: ctx.cityId, usage: data.usage || null });
    }
    if (path === "/api/chat") return json({ ok: false, error: "只接受 POST / OPTIONS" }, 405);

    return json({ ok: false, error: "未找到该接口", routes: ["GET /api/stats", "GET /api/dishes", "GET /api/health", "GET /api/events", "POST /api/event", "POST /api/auth/login", "GET /api/auth/me", "POST /api/auth/logout", "POST /api/kit/unlock", "GET /api/kit/status", "GET / POST /api/support", "POST /api/support/bot", "POST /api/support/close", "GET /api/support/templates", "GET /api/chat/status", "POST /api/chat"] }, 404);
  },
};
