-- China Bite 订阅表（独立表，不混 chinavisacheck 的订阅表）
-- D1 未接：本 SQL 先存档，接 D1 后执行。
-- 执行：wrangler d1 execute chinabite --file migrations/0001_chinabite_subscribers.sql
-- （需先在 Dashboard Worker 的 wrangler.toml 加 [[d1_databases]] 绑定 CHINABITE_DB）

CREATE TABLE IF NOT EXISTS chinabite_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT 'chinabite-site',
  status TEXT NOT NULL DEFAULT 'subscribed',
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);

-- 去重键：email_norm = trim + lower(email)，同一邮箱只订一次。
-- 语言：en / zh / ja / ko / de / fr（订阅框六种）；非法值入库前已归一为 en。
CREATE INDEX IF NOT EXISTS idx_chinabite_subscribers_created
  ON chinabite_subscribers (created_at);
