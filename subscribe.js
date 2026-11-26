// China Bite — POST /api/subscribe
// Worker 模块（ESM）。部署路径：并入 Dashboard Worker `china-bite-dashboard`
// 的 src/index.js（见本文件底部注释），不要改 Dashboard 目录之外的东西。
// 开发站 ~/workspace/china-bite-dev/ 是纯静态 Pages，没有 Worker，
// 所以本文件目前只随开发站一起部署为静态源码（供合入用），/api/subscribe
// 在 chinabite.chinavisacheck.com 上还不存在；前端 app.js 直接 fetch
// Dashboard Worker 的 https://china-bite-dashboard.cc-chemate.workers.dev/api/subscribe。
//
// 状态（2026-11-26，实测）：
// - Dashboard Worker china-bite-dashboard 在账号上不存在（API 查过，404 code 10007），
//   /api/subscribe 未上线。前端 fetch 失败时走本机 localStorage 待同步队列，并如实提示。
// - D1 未接：wrangler.toml 里没有 [[d1_databases]] 绑定。接上 env.CHINABITE_DB
//   后自动走 D1，否则内存兜底（Worker 重启清零，与 Dashboard 现有事件/工单一致）。
// - Resend 未接：确认邮件只生成模板，不发送（见 subscribeConfirmTemplate）。
// - 订阅表独立：chinabite_subscribers，不混 chinavisacheck 的订阅表。
//   建表 SQL 在 migrations/0001_chinabite_subscribers.sql。

export const SUBSCRIBE_LANGS = ["en", "zh", "ja", "ko", "de", "fr"];
export const SUBSCRIBE_API_PATH = "/api/subscribe";
export const SITE_URL = "https://chinabite.chinavisacheck.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v) {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

// 去重键：去空格 + 全小写。同一邮箱只订一次，与大小写/前后空格无关。
export function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export function normalizeLang(v) {
  return SUBSCRIBE_LANGS.includes(v) ? v : "en";
}

// ---- 订阅确认邮件模板（只生成，不发送；Resend 未接）----
// 包子 Bun 名义，先确认订阅，再给链接。中英文各一版；
// ja/ko/de/fr 暂用英文版（模板只有中英文），lang 字段仍按用户所选存。
export function subscribeConfirmTemplate(lang, email) {
  const useZh = lang === "zh";
  const subject = useZh
    ? "订好了 — China Bite 新菜先知道"
    : "You're in — new China Bite dishes first";
  const body = useZh
    ? [
        `你好，${email}，`,
        "订好了。你已订阅 China Bite。",
        "有新菜、新城市上架时，我会发一封邮件告诉你。",
        "只收 China Bite 的更新，不收营销。",
        "随时可退订。",
        "",
        "— 包子 Bun，China Bite",
        SITE_URL,
      ].join("\n")
    : [
        `Hi ${email},`,
        "You're in. You're subscribed to China Bite.",
        "I'll email you when new dishes or cities land.",
        "Only China Bite updates. No marketing.",
        "Unsubscribe anytime.",
        "",
        "— Bun, China Bite",
        SITE_URL,
      ].join("\n");
  return {
    lang: useZh ? "zh" : "en",
    requestedLang: lang,
    subject,
    body,
    from: "China Bite <hello@chinavisacheck.com>",
    resend: { connected: false, sent: false, status: "待接 Resend 后发送（Resend 未接，未发送）" },
  };
}

// ---- 存储：D1 接入后走 D1，否则内存兜底 ----
// 内存 Map 放在模块级：同一 Worker 实例内多次请求共享，去重才跨请求生效。
// （Worker 重启仍清零，与 Dashboard 现有事件/工单一致；正式版走 D1。）
const memoryStore = new Map(); // key: email_norm -> row
export function createSubscribeStore(env) {
  const db = env && env.CHINABITE_DB ? env.CHINABITE_DB : null;
  const mem = memoryStore;
  return {
    d1Connected: !!db,
    async get(emailNorm) {
      if (db) {
        const row = await db
          .prepare("SELECT email, email_norm, lang, source, status, created_at FROM chinabite_subscribers WHERE email_norm = ?1")
          .bind(emailNorm)
          .first();
        return row || null;
      }
      return mem.get(emailNorm) || null;
    },
    async put(row) {
      if (db) {
        // UNIQUE(email_norm) 兜底：并发重复插入时 D1 报错，由调用方按已订阅处理。
        await db
          .prepare("INSERT INTO chinabite_subscribers (email, email_norm, lang, source, status, created_at) VALUES (?1, ?2, ?3, ?4, 'subscribed', ?5)")
          .bind(row.email, row.email_norm, row.lang, row.source, row.created_at)
          .run();
        return row;
      }
      mem.set(row.email_norm, row);
      return row;
    },
    async count() {
      if (db) {
        const r = await db.prepare("SELECT COUNT(*) AS n FROM chinabite_subscribers").first();
        return r ? r.n : 0;
      }
      return mem.size;
    },
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleSubscribe(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "只接受 POST" }, 405);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "body 不是合法 JSON" }, 400);
  }
  if (!isEmail(body.email)) {
    return json({ ok: false, error: "email 格式不对" }, 400);
  }
  const email = String(body.email).trim();
  const emailNorm = normalizeEmail(email);
  const lang = normalizeLang(body.lang);
  const store = createSubscribeStore(env);

  // 去重：同一邮箱只订一次。已存在 → 200 + already_subscribed，不重复写。
  const existing = await store.get(emailNorm);
  if (existing) {
    return json({
      ok: true,
      subscribed: true,
      already: true,
      status: "already_subscribed",
      email: existing.email,
      lang: existing.lang,
      d1Connected: store.d1Connected,
      note: "已经订过了，不重复写。",
    }, 200);
  }

  const row = {
    email,
    email_norm: emailNorm,
    lang,
    source: typeof body.source === "string" && body.source ? body.source.slice(0, 64) : "chinabite-site",
    status: "subscribed",
    created_at: new Date().toISOString(),
  };
  try {
    await store.put(row);
  } catch (e) {
    // D1 UNIQUE(email_norm) 冲突 = 并发重复订阅，按已订阅返回，不报错。
    if (String((e && e.message) || e).includes("UNIQUE")) {
      return json({ ok: true, subscribed: true, already: true, status: "already_subscribed", email, lang, d1Connected: store.d1Connected, note: "已经订过了，不重复写。" }, 200);
    }
    throw e;
  }
  const template = subscribeConfirmTemplate(lang, email);
  return json({
    ok: true,
    subscribed: true,
    already: false,
    status: "subscribed",
    email,
    lang,
    d1Connected: store.d1Connected,
    confirmEmail: template,
    note: store.d1Connected
      ? "已写入 D1 chinabite_subscribers。确认邮件模板已生成，未发送（Resend 未接）。"
      : "已记入内存（D1 未接，Worker 重启清零）。确认邮件模板已生成，未发送（Resend 未接）。",
  }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === SUBSCRIBE_API_PATH) return handleSubscribe(request, env);
    return json({ ok: false, error: "未找到该接口", routes: ["POST /api/subscribe"] }, 404);
  },
};

// 合入 Dashboard Worker 的部署路径（Dashboard 目录不动，本次不合入）：
// 1. wrangler.toml 加 D1 绑定：[[d1_databases]] binding = "CHINABITE_DB",
//    database_name = "chinabite"，database_id 由 `wrangler d1 create chinabite` 给。
// 2. 建表：`wrangler d1 execute chinabite --file migrations/0001_chinabite_subscribers.sql`
//    （SQL 也在 ~/workspace/china-bite-dev/migrations/0001_chinabite_subscribers.sql）。
// 3. 把本文件的 handleSubscribe / subscribeConfirmTemplate / 相关常量拷进
//    ~/workspace/china-bite-dashboard/src/index.js，在 fetch() 里加路由：
//    if (path === "/api/subscribe") return handleSubscribe(request, env);
//    注意 Dashboard 现有 fetch(request) 签名没有 env，要改成 fetch(request, env)。
// 4. `npx wrangler deploy`（在 china-bite-dashboard 目录）。部署后地址：
//    https://china-bite-dashboard.cc-chemate.workers.dev/api/subscribe
//    （子域名 cc-chemate 已实测；Worker 本身 2026-11-26 查过还不存在，需先部署）。
// 5. Resend 接入后：把 subscribeConfirmTemplate 的返回值发出去，
//    再把 resend.connected / sent 改成 true，不要在未发送时写已发送。
