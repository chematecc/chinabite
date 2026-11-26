// China Bite — POST /api/subscribe
// Worker 模块（ESM）。2026-11-26 已合入 Dashboard Worker `china-bite-dashboard`
// 的 src/index.js 并部署上线（版本 4，c9b2783d），D1 chinabite_subscribers 已接通。
// 生产地址：https://bite-api.chinavisacheck.com/api/subscribe（自定义域名路由；
// workers.dev 生产域名 2026-11-26 14:38 起报 404 error code 1042，脚本本身正常，
// 已改走 bite-api.chinavisacheck.com）。前端 app.js 直接 fetch 该地址。
// 本文件保留为源码备份 + 合入说明；不要改 Dashboard 目录之外的东西。
//
// 状态（2026-11-26，实测）：
// - /api/subscribe 已上线：POST 201 写入 D1，重复邮箱 200 already_subscribed，
//   OPTIONS 预检 204（CORS 头已加，前端跨域 POST 可读响应）。
// - D1 已接：库 chinabite（f25b6ee5-46e2-492d-b0de-904ddd7e009d），
//   wrangler.toml 有 [[d1_databases]] 绑定 CHINABITE_DB；建表 SQL 已执行。
// - Resend 已接（v5.5）：确认邮件由 Dashboard Worker 的 sendResendEmail 真发
//   （from China Bite <hello@chinavisacheck.com>），见 subscribeConfirmTemplate。
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

// ---- 订阅确认邮件模板（v6.1：标题不再是 "new dishes first"，Oliver 说没用；
// 改成欢迎订阅 + 只在有新内容时才发邮件）----
// 包子 Bun 名义，先确认订阅，再给链接。中英文各一版；
// ja/ko/de/fr 暂用英文版（模板只有中英文），lang 字段仍按用户所选存。
export function subscribeConfirmTemplate(lang, email) {
  const useZh = lang === "zh";
  const subject = useZh
    ? "订好了 — 欢迎来到 China Bite"
    : "You're in — welcome to China Bite";
  const body = useZh
    ? [
        `你好，${email}，`,
        "订好了。你已订阅 China Bite。",
        "有新内容时我会发一封邮件告诉你——新菜、新城市，或者值得知道的吃喝小贴士。",
        "只收 China Bite 的更新，不收营销。",
        "随时可退订。",
        "",
        "— 包子 Bun，China Bite",
        SITE_URL,
      ].join("\n")
    : [
        `Hi ${email},`,
        "You're in. You're subscribed to China Bite.",
        "You'll hear from me when there's something new — a new dish, a new city, or a food tip worth knowing.",
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
      ? "已写入 D1 chinabite_subscribers。确认邮件由 Worker 经 Resend 真发（v5.5 起）。"
      : "已记入内存（D1 未接，Worker 重启清零）。确认邮件由 Worker 经 Resend 真发（v5.5 起）。",
  }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === SUBSCRIBE_API_PATH) return handleSubscribe(request, env);
    return json({ ok: false, error: "未找到该接口", routes: ["POST /api/subscribe"] }, 404);
  },
};

// 部署路径（已完成 2026-11-26）：见本文件顶部状态。合入步骤存档如下：
// 1. wrangler.toml 加 D1 绑定：[[d1_databases]] binding = "CHINABITE_DB",
//    database_name = "chinabite"，database_id f25b6ee5-46e2-492d-b0de-904ddd7e009d。
// 2. 建表：D1 query API 执行 migrations/0001_chinabite_subscribers.sql（已执行）。
// 3. handleSubscribe / subscribeConfirmTemplate / 相关常量已拷进
//    ~/workspace/china-bite-dashboard/src/index.js，在 fetch() 里加路由：
//    if (path === "/api/subscribe") return handleSubscribe(request, env);
//    另加 OPTIONS 预检 + CORS 头（subscribeCors），前端跨域 POST 才能读响应。
// 4. 部署：python3 /tmp/worker-deploy.py（Cloudflare API 直连，wrangler 未登录）。
//    生产地址：https://bite-api.chinavisacheck.com/api/subscribe
//    （自定义域名路由；workers.dev 生产域名 2026-11-26 起报 404 error code 1042）。
// 5. Resend 已接入（v5.5）：Dashboard Worker 的 handleSubscribe 里调
//    sendResendEmail 真发确认邮件，再把 resend.connected / sent 写回响应。
