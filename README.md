## 开发模式 DEV MODE + 街头海报 UI 重做 — 2026-11-26（蓝图 v2.6，见 02 §12.16–12.17）

- **开发模式（默认开启）：** `app.js` 顶部一处集中配置 `DEV_MODE = true` + `PAYWALL` 对象（正式版免费/收费规则，只作记录）。DEV_MODE 下解码无限次（不扣次数）、12 张饮食卡全开、Kit $6.99 内容全开预览、奖励广告不挡路（广告区隐藏）、订阅框不挡功能；页面顶部有“DEV · 开发模式”角标。付费逻辑没删，只绕过（绕过处都标 `// PAYWALL`）。**最终交付时把 `DEV_MODE` 设 false，免费/收费权限按蓝图恢复**（免费 3 次/天、好友链接 6 次、广告 +3 上限 5 次/天、Kit 预览每区 1 个样本）。价格 $6.99 不改，订阅代码结构不改。
- **UI 推倒重来（街头海报风，替代 v2.5 IG 风）：** 深墨底 + 辣椒红主色 + 亮黄撞色，全站只 2 个主色；Hero 全幅图 + 40px 超粗大字“CAN I EAT THIS?”；解码器是黄色主角区块（大输入框 + 大红按钮）；故事菜全幅横滑大图卡（300px）；城市大图网格；13 张小卡片改成大区块（Hero / 解码 / 故事 / 城市 / 饮食卡 / Kit）；App 模式保留（480px 居中、底部导航 4 项），顶栏/底栏按新风格重做。菜品数据、价格、订阅逻辑、sitemap 133 条全不动。
- **验证：** `/tmp/chinabite-v26-test.cjs` 56 项全过（含 DOM 桩冒烟：DEV_MODE 下连解 10 次全成功、消耗 0 次；DEV_MODE=false 对照：第 4 次解码被挡住、used=3，证明付费恢复路径可用）；本地 http.server 首页 + 26 个文件/图片全部 200。真机渲染未实测。

## 渲染 / Banner / 图片 / Webapp / App 准备 — 2026-11-26 16:12 CST

- **渲染修了**：故事菜 emoji 占位 → 9 张真图；城市西安/重庆/桂林加氛围图（其余 7 城保留暖色块，无空白灰框）；Hero 加竖版图（220px 裁切条，不占首屏）；修了 flex 文本溢出（`.story>span{min-width:0}`）；修了 `<a><button>` 嵌套无效 HTML（改成 `.btn-link`）；首屏仍轻（mascot 5.6KB，banner 29.1KB、Hero 27.9KB、菜图/城图各 ≤30KB）。
- **Banner**：`assets/china-bite-banner-1200x630.webp`（1200×630，29.1KB，Bun + “Discover China, One Bite at a Time.”），og:image / twitter:image 已指真图（+ width/height），占位 `og-image.svg` 已删。
- **Webapp**：主站 `manifest.webmanifest`（China Bite、standalone、theme #c05f33、icons 192/512/288），head 已接 manifest + mobile-web-app-capable + apple-mobile-web-app-capable；Dashboard 两个 manifest 也补了 192/512 图标。512 图标由 288 放大，略软。
- **验证**：`/tmp/chinabite-v23-test.js` 24 项全过；本地 http.server 首页/manifest/7 个新图全部 200；`node --check` 通过。真机渲染未实测。

## App 准备清单（只准备，不打包 — 2026-11-26）

- **路线**：Capacitor 包现有 web 站，别重写。先验证 web（10+ 笔真实 $6.99 订单后再动 App）。
- **账号费用**：Apple Developer $99/年；Google Play $25 一次。首年 $124，之后 $99/年。
- **IAP 规则**：App 内解锁必须用 StoreKit / Play Billing，**不能用 Stripe 链接**（Apple Guideline 3.1.1，会被拒）。App 价建议 $8.99（web $6.99；15% 佣金下 $8.99 净 $7.64，30% 下净 $6.29；web Stripe 净约 $6.78）。
- **佣金**：标准 30%；Apple 小企业计划 / Google 首 $100 万 15%。
- **原生功能（避 Apple 4.2 裸壳拒绝）**：离线饮食卡、相机扫菜单（OCR → verdict）、推送、原生导航；光套个壳会被拒。
- **Google Play**：2023-11-13 后建的个人账号需 12 人、14 天封闭测试才能上生产。
- **顺序**：先验证 web → 再 iOS → 再 Android。
- **未做**：没打包 App、没上架、没接 Stripe、没接 IAP。

## 吉祥物改名 Bun — 2026-11-26 16:01 CST

- 只改名，不改形象：吉祥物名字改成 **Bun（包子）**。落款中文“包子 Bun”，英文“Bun”。形象仍是饺子图（`assets/china-bite-mascot-dumpling-288.webp`），不重画。改到的落款处：订阅确认模板（`subscribe.js`）、Dashboard Worker `MASCOT_SIGNOFF`、Dashboard 前端模板。菜品“饺子”不动。蓝图 v2.2（§12.12）。部署 8b7ed07c（2026-11-26 16:02）。

## 订阅 Subscribe — 2026-11-26

- **前端**：首页底部 `#subscribe`（Find us 之后、footer 之前），slide 风格短句 + 饺子吉祥物（56px，订阅框 + 成功态各 1 处）。邮箱 + 语言选择（en/zh/ja/ko/de/fr，6 种），文案按所选语言切换；隐私行“Only China Bite updates. No marketing. Unsubscribe anytime.”（各语言版同义）。成功显示确认 + 饺子吉祥物；重复订阅显示“已经订过了”。
- **接口**：`POST /api/subscribe`，逻辑在 `subscribe.js`（Worker ESM 模块）。开发站是纯静态 Pages、没有 Worker，前端 `app.js` 直接 fetch Dashboard Worker `https://china-bite-dashboard.cc-chemate.workers.dev/api/subscribe`（子域名 cc-chemate 已实测）。
- **状态（实测，不编造）**：Dashboard Worker `china-bite-dashboard` 在账号上**不存在**（API 查过，404 code 10007），`/api/subscribe` 未上线。前端 fetch 失败时如实提示“还没接通，先存在本机了”，邮箱进本机 `localStorage` 待同步队列 `chinabite_subscribe_pending_v1`，不假装已订阅。合入路径写在 `subscribe.js` 底部注释：wrangler.toml 加 D1 绑定 `CHINABITE_DB` → 建表 → 把 `handleSubscribe` 拷进 Dashboard `src/index.js`（fetch 要改成 `fetch(request, env)`）→ `npx wrangler deploy`。**Dashboard 目录本次没动。**
- **去重**：`email_norm = trim + lower(email)`，同一邮箱只订一次（大小写/前后空格变体同算）；新订阅 201，已订阅 200 + `already_subscribed`（不覆盖首次语言）；邮箱错/空/非法 JSON 400；非 POST 405；非法语言归一为 en。D1 模式下 `UNIQUE(email_norm)` 冲突也按已订阅返回。
- **D1 未接**：独立表 `chinabite_subscribers`（不混 chinavisacheck），建表 SQL 在 `migrations/0001_chinabite_subscribers.sql`；`wrangler.toml` 里无 D1 绑定，`subscribe.js` 接上 `env.CHINABITE_DB` 后自动走 D1，否则内存兜底（模块级 Map，跨请求去重；Worker 重启清零）。
- **Resend 未接**：确认邮件只做模板，中英文各一版（`subscribeConfirmTemplate`，包子 Bun 名义，先确认订阅再给链接；ja/ko/de/fr 暂用英文版，lang 仍按所选存）。`resend: {connected:false, sent:false}`，待接 Resend 后发送，未发送。
- **验证**：`/tmp/chinabite-subscribe-test.mjs` **36 项全过**（正常 201、邮箱错 400×3、重复去重 200、语言跟随 ja/zh、非法语言归一 en、GET 405、非法 JSON 400、SQL 独立表 + UNIQUE、前端订阅框 + 6 语言 + 饺子吉祥物 + 无营销文案、0 处 Youyou/panda、node --check app.js/data.js/subscribe.js 通过）。测试中修过 1 个真 bug：内存兜底最初每请求新建 Map，跨请求去重失效；已改为模块级 Map。
- **部署**：2026-11-26 15:48 CST，项目 `chinabite`，部署 ID `af93d3df-a527-4257-908c-860b782295aa`（production，6 个文件新上传，12 个文件在包内）；随后为同步 README 又部署一次，最终部署 ID `7434eff8-1e17-442f-9b3d-45004973e87b`（production）。验证（最终部署后）：`https://chinabite.chinavisacheck.com` 200（63,090B，含订阅框 `#subscribe`、邮箱输入、无营销文案、饺子吉祥物 6 处、0 处 Youyou/panda），sitemap 200、133 条 `<loc>`，`subscribe.js` 线上 200，线上 `app.js` 含 Dashboard Worker `/api/subscribe` 地址；Dashboard Worker 地址本身 curl 返回 404（Worker 未部署，与前述状态一致，/api/subscribe 未上线）。

## 饺子吉祥物换上网站 — 2026-11-26 15:39 CST

- **新形象**：原创卡通饺子吉祥物（笑脸饺子 + 陶土红筷子），不是 Youyou 熊猫。原图 1600×1600、126KB，PIL 压到 288×288 WebP，**5,626B**（比熊猫 288 版 14KB 还小），文件 `assets/china-bite-mascot-dumpling-288.webp`。
- **换的位置**：Header（56px，替代熊猫 logo）、favicon、apple-touch-icon；解码结果页顶部小号 32px（`.mascot-mini`，`app.js` renderResult）；饮食卡区顶部小号 32px（`index.html` #dietSection）。alt 统一“China Bite mascot — a cheerful dumpling holding chopsticks”，旧 alt（ink plate and chopsticks / panda）已修掉。
- **删的文件**：熊猫 logo `assets/china-bite-logo-panda-288.webp`、水墨 logo + 原图 1600px 饺子 + 各 `.json` sidecar，部署包现只剩 10 个文件。注意：Pages Direct Upload 的旧文件直链仍返回 200（新部署 b8f8ff45 预览地址也一样，cf-cache MISS，非缓存）——Pages 按内容寻址保留历史文件，删文件只能去掉页面引用，无法从项目资产库清除；页面上已 0 处 panda 引用。
- **验证**：`/tmp/chinabite-mascot-test.js` 12 项全过（0 处 panda、alt 正确、favicon/apple-touch-icon/Header 均为新吉祥物、32px 点缀在结果页+饮食卡、文件 ≤10KB、旧文件已删）；`node --check` app.js + data.js 通过。
- **部署**：2026-11-26 15:39 CST，项目 `chinabite`，部署 ID `b8f8ff45-1136-4bcb-b9cf-f82c0e829c08`（production，5 个文件新上传）。验证：`https://chinabite.chinavisacheck.com` 200（61,657B，mascot 引用 4 处、panda 0 处、alt 饺子 2 处），新吉祥物 200（5,626B），sitemap 200，`app.js` 线上含 mascot 1 处、panda 0 处。

## 补地方菜缺失 — 2026-11-26 13:24 CST

- **原因**：100 道里没有过桥米线、桂林米粉等地方菜，昆明、桂林、深圳主打偏通用（凉粉、豆花、素菜类）。
- **核对**：候选 10 道里已有 4 道重复不补——重庆小面、兰州拉面（=兰州牛肉面）、热干面、扬州炒饭；新补 6 道：过桥米线、桂林米粉、潮汕牛肉丸、西安凉皮、沙县扁肉、柳州螺蛳粉；另补 4 道地方菜凑够 10 道：南京鸭血粉丝汤、成都钟水饺、广州云吞面、杭州东坡肉。总数 100→**110 道**。
- **字段**：每道 4 字段一致，辣度 0–3、flag、参考价 ¥+≈$（汇率 7.1，2026-11-26，仅参考价），原因一句话 ≤15 字。
- **城市主打更新**：昆明主打换成过桥米线、桂林主打换成桂林米粉、深圳主打换成潮汕牛肉丸（各 1 句具体注意点）；场景句同步改了。
- **同步**：sitemap 123→**133 条**，llms.txt 菜品 110 道 + 城市主打更新，JSON-LD Recipe 100→110（graph 共 114 项），index.html Kit 文案 100→110 道，Kit 免费预览仍每区恰好 1 个样本不变。
- **Dashboard**：城市 3→10 城同步（src/data.js、data.js 由开发站重新生成），统计 110 / 8 / 12 / 10，sitemap 133 条；本地验证通过，**未部署 Worker**。
- **验证**：node --check 通过；JSON-LD 解析通过；110 道 id 唯一；城市主打全在菜品里；Dashboard 数据与开发站完全一致；/api/stats 110 道 / 10 城 / sitemap 133。
- **部署**：2026-11-26 13:26 CST，项目 `chinabite`，部署 ID `f44fe15b-fba2-4b92-88e9-c5c64f050f0f`（production，6 个文件新上传）。验证：`https://chinabite.chinavisacheck.com` 200（61,427B，含过桥米线、110 dishes），sitemap 200、133 条 `<loc>`，data.js 200（110 道菜），`https://chinabite-5qq.pages.dev` 200。

## 城市扩到 10 城 — 2026-11-26 13:19 CST

- **10 城**：上海、北京、成都、西安、广州、深圳、杭州、重庆、昆明、桂林（阳朔一带）。之前 3 城（上海/北京/成都），每城 3 家示例。
- **每城**：1 句“你”代入场景 + 3 道必吃菜（只从 100 道里选，外国游客能接受的当地代表菜；太辣、太生、内脏、太重口的不主推）+ 每道 1 句具体注意点（辣度/花生/虾/猪肉/趁热/排队/过敏先说）+ 1 句总注意点（回民街看绿牌、重庆火锅牛油辣、广州早茶按位收费等）+ 1 句交通（地铁为主，站名真实）+ 3 家示例（只写类型 + 区域，标“地址待核实”，不编店名/地址/电话/评分）。
- **同步**：data.js 城市 3→10；sitemap 118→123 条（城市页 5→10）；llms.txt 新增 Cities (10) 一节；JSON-LD 新增 ItemList 10 城；Kit 免费预览仍每区恰好 1 个样本不变。
- **缺口（诚实记录）**：100 道里没有过桥米线、桂林米粉等地方菜，昆明、桂林、深圳的主打菜偏通用；下一步补地方菜进 100 道后再主推。
- **部署**：2026-11-26 13:21 CST，项目 `chinabite`，部署 ID `0018151c-3e32-4f7a-99e7-b15448647de8`（production）。验证：`https://chinabite.chinavisacheck.com` 200，线上 data.js 100 道、10 城，sitemap 123 条。

## 手机体验检查 + 改进 — 2026-11-26 13:17 CST

- **检查方法**：本地文件 + Node DOM 桩测试（`/tmp/chinabite-mobile-test.js`，35 项），线上 curl 验证。**真机渲染未实测**，需 Oliver 手机打开确认。
- **发现并修了 7 个问题**：
  1. **首屏太高，输入框不一定在首屏内**：Hero logo 72px + 重复的英文行占地方。修：logo 72→56px，h1 32px，痛点句 18px，删掉与 pain-en 重复的 muted 英文行；Hero 加“一键直达解码器”按钮（开始查菜 ↓），任何手机一 tap 就到输入框。
  2. **Logo 严重超大**：1600×1600、333KB 的图只显示 72×72，占首屏流量 74%。修：PIL 缩到 288×288 WebP，14KB（-96%），favicon / apple-touch-icon / 头像 3 处引用全换，旧 333KB 文件已删。
  3. **次要文字太小**：.small 13px、.muted 14px、故事卡英文/说明 14px、菜名英文 14px、表头/badge 13px。修：全部提到 15px（表头/badge 14px），正文保持 16px；iOS 输入框已是 16px，不会点输入就放大。
  4. **真 bug：“点评搜这道菜”点完看不到内容**：它只 scrollIntoView 到 `#meituanSection`，但那是个默认收起的 `<details>`，用户只看到一行标题。修：app.js 里先 `s.open = true` 再滚动。
  5. **横向溢出风险**：分享链接 `<code>` 长 URL 无断行、QR 表格无滚动保护、body 无 overflow-x 保护。修：`code{word-break:break-all}`、`#qrTable{overflow-x:auto}`、`body{overflow-x:hidden}`、`img{max-width:100%}`。
  6. **触摸目标**：菜名按钮无 min-height、checkbox/radio 只有默认 16px。修：.dish 加 min-height 44px，checkbox/radio 加到 20×20px（按钮/输入框/chip 本来就已是 44/48px，合格）。
  7. **全屏浮层关不掉的风险**：点单 slip / 饮食卡浮层的关闭按钮在内容最下方，内容长时要滑到底才看得到。修：关闭按钮 `position:sticky;bottom:12px;width:100%`，一直贴在底部。
- **检查通过、未改的**：解码流程（麻婆豆腐 + 素食 → Avoid，含成分/过敏/辣度/价格 ¥28 ≈$3.94/给服务员大字句/3 个下一步按钮/Add to list/Share）；故事菜 9 张卡点按即解码；Kit 预览 + 美团区 2 个折叠区默认收起；100 道菜、8 档案、sitemap 118 条；页面总重首屏约 450KB → 约 130KB（logo 333KB→14KB 后）。
- **部署**：2026-11-26 13:17 CST，项目 `chinabite`，部署 ID `80cae2d9-266f-47ee-b724-d16261c793bc`（production，5 个文件新上传）。验证：`https://chinabite.chinavisacheck.com` 200（56,151B，含“开始查菜”、panda-288 引用 3 处、0 处“出发前/48 小时”），新 logo 200（14,336B），sitemap 200、118 条，`https://chinabite-5qq.pages.dev` 200。

## 拿掉“出发前 48 小时”时间线 — 2026-11-26 13:12 CST

- **原因**：用户要求不需要强调行前了。刚加的 `#ready48` 时间线整个拿掉：导语“你出发前要做的 3 件事”+ 3 步卡片（Alipay / 酒店中文地址卡 / 离线翻译）全部删除，styles.css 里只服务它的 `.timeline` / `.step` / `.step .num` / `.step .zh` 样式一并清理，无空区、无死链接。
- **保留**：Hero 第二人称痛点句、解码器 placeholder（“你菜单上看到的第一个菜名”）、解码结果 verdict 在上 + 3 个下一步按钮（app.js 生成的 `.next-steps`）、每城 3 道故事菜（成都/广州/上海，各一句“你”代入场景）、mobile-first 单列 480px。
- **验证**：`node --check` JS_OK；`#ready48` / “出发前” / “48 小时” / “Before you fly” 全站 0 处残留；data.js 仍 100 道，sitemap 仍 118 条。
- **部署**：2026-11-26 13:12 CST，项目 `chinabite`，部署 ID `b89eb651-c342-4f03-be52-14d64b680744`（production，3 个文件新上传）。验证：`https://chinabite.chinavisacheck.com` 200（56,236B，含担担面，0 处“出发前/Before you fly/ready48”），`https://chinabite-5qq.pages.dev` 200，sitemap 200、118 条 `<loc>`。

## 扩菜到 100 道 — 2026-11-26 13:02 CST

- **新增 44 道，全部取自蓝本 03 §3.3 候选清单，未编生僻菜**：素食 10（麻婆豆腐无肉版、干煸四季豆、蒜蓉西兰花、清炒时蔬、素炒三丝、凉拌木耳、番茄蛋花汤、紫菜蛋花汤、罗汉斋、香菇青菜）+ 清真 8（羊肉串、烤包子、手抓饭、大盘鸡、清真牛肉面、羊肉汤、孜然羊肉、馕）+ 江浙 10（红烧肉、生煎包、葱油拌面、腌笃鲜、响油鳝糊、糖醋小排、狮子头、鸡头米、松鼠桂鱼、蟹粉小笼）+ 火锅/烧烤 8（清汤火锅、番茄火锅、菌汤火锅、烤羊肉串、烤茄子、烤生蚝、烤玉米、烤红薯）+ 甜品 8（豆花、杨枝甘露、双皮奶、姜撞奶、凉粉、冰粉、豆浆、酸梅汤）。
- **字段**：每道仍 4 字段（主料、禁忌 flag、辣度 0–3、参考价 ¥ + ≈$，汇率 7.1，日期 2026-11-26，标参考价）。原因一句话 ≤15 字，slide 风格不变。
- **诚实处理**：素食菜多数标 lard/stock → 素食档案判“先问”（猪油/肉汤/蚝油风险），只有凉拌木耳等干净素菜直接判可吃；清真菜只写清真店做法（看绿牌），肉菜在清真档案下判“先问”；蟹粉小笼、烤生蚝用 shrimp flag 触发贝类过敏判 Avoid（hidden 写明是蟹/生蚝）；鳝糊用 fish flag，素食判 Avoid。价格均为参考估算，未对照真实菜单。
- **同步更新**：data.js 56 → 100 道；sitemap.xml 74 → **118 条**（1 首页 + 100 菜 + 12 禁忌 + 5 城）；index.html JSON-LD Recipe 56 → **100**（graph 共 103 项）；llms.txt 菜单 56 → 100 道；Kit 免费预览仍每区恰好 1 个样本（1 菜 + 1 卡 + 1 城）不变。
- **本地验证**（`/tmp/chinabite-test3.js`）：**27 项全部通过**，包括 100 道、id 唯一、分类 10/8/10/8/8、note 全部 ≤15 字、辣度 0–3、价格 ¥6–88；抽查 8 道解码正确（凉拌木耳+素食→可吃、麻婆豆腐无肉版+素食→先问、羊肉串+清真→先问、烤生蚝+虾蟹过敏→Avoid、冰粉+花生过敏→Avoid、响油鳝糊+素食→Avoid、馕+清真→可吃、双皮奶+全素→Avoid）；JSON-LD 解析通过，sitemap XML 解析通过；全站 0 处残留“56”。
- **部署**：2026-11-26 13:02 CST，项目 `chinabite`，部署 ID `07827a0c-8bd1-4706-a538-2464d286a7ec`（production），6 个文件新上传。验证：`https://chinabite.chinavisacheck.com` 200（51,879B），sitemap 200、118 条 `<loc>`，data.js 200，`https://chinabite-5qq.pages.dev` 200；线上首页含新菜名（蟹粉小笼、杨枝甘露、清汤火锅），JSON-LD Recipe 100 道已在线。

# China Bite — Web Validation Build (Day 0–2)

## 域名变更 — 2026-11-26 12:35 CST

- **新主域名：`https://chinabite.chinavisacheck.com`**（免费子域名方案）
- **旧域名：`https://eat.chinavisacheck.com`** — 仍保留，指向同一 Pages 项目，不删除
- 站内 canonical / sitemap（74 条）/ llms.txt / JSON-LD / og:url 已全部换成新域名；独立域名以后再说
- 重新部署 2026-11-26 12:37 CST：部署 ID `bbdad8c6-0f8e-4b59-a9c5-b606a1ac493d`（production），`https://eat.chinavisacheck.com` 200 且 canonical 已是新域名，`https://eatchina.pages.dev` 200
- **卡点 — chinabite 还没通（522）**：DNS CNAME `chinabite` → `eatchina.pages.dev`（proxied，ID `08ee21227fef4692e86d1d6a24f61469`）已建好，但 Pages 自定义域名加不上：API `POST /pages/projects/eatchina/domains` 5 次都报 400 `8000015 invalid TLD`（`domain` 和 `hostname` 两种字段都试过）。这是 Cloudflare 已知的 API bug（社区帖：API 拒掉有效域名，Dashboard 里加同一个域名却能成功）。需走 Dashboard：Workers & Pages → eatchina → Custom domains → 加 `chinabite.chinavisacheck.com`（浏览器操作）
- **旧域名 eat 未删**：按要求，chinabite 验证 200 之后才能删 eat 的 Pages 自定义域名和 DNS CNAME。目前 eat 仍正常 200，是唯一可用的主域名，不要先删

## Pages 项目改名 — 2026-11-26 12:54 CST（已完成）

- **新项目：`chinabite`**（ID `a234414a-9982-4447-8df9-50a12a20f7b8`），2026-11-26 12:54 CST 新建并部署 11 个文件，部署 ID `cfccdb3b-7e99-48b5-b2c3-28e11ed661ce`（production，deploy stage success）
- **注意：`chinabite.pages.dev` 已被别的账号占用**（返回一个 Next.js 站，不是我们的），所以新项目的子域名是 **`https://chinabite-5qq.pages.dev`**（200，含 China Bite）。以后部署都用项目名 `chinabite`，备用地址是 `chinabite-5qq.pages.dev`，不要再用 `chinabite.pages.dev`
- **自定义域名已迁移**：`chinabite.chinavisacheck.com` 先从旧项目 `eatchina` 删掉，再 API 加到新项目 `chinabite` —— 这次 API **没有**报 `8000015`（先试加时只报 `8000018 already added`，因为域名还挂在旧项目上；删掉旧的之后立即加上，status initializing，verification active）。DNS CNAME `chinabite`（ID `ff58523d61bdc812cd0a5c21d1f45849`）已从 `eatchina.pages.dev` 改成 `chinabite-5qq.pages.dev`（proxied）
- **验证（迁移后）**：`https://chinabite.chinavisacheck.com` 200（36,528B，含 China Bite，首页 0 处 eatchina），sitemap.xml 200（74 条 `<loc>`），robots.txt / llms.txt / 熊猫 logo 全部 200；切域名瞬间有两次 522，第三次起稳定 200
- **旧项目 `eatchina` 已删除**（DELETE 后再查返回 404 `8000007`）：`https://eatchina.pages.dev` 现返回 530。域名记录里域名状态显示 `pending` 但 verification `active`，属 API 状态滞后，网站本身已正常服务
- **blake3 说明**：系统 python3 没有 blake3，部署用 `/tmp/cf-venv`（`python3 -m venv /tmp/cf-venv && /tmp/cf-venv/bin/pip install blake3`），`/tmp` 是临时的，下次部署前 venv 不在了需重建

Static site, no build step, no dependencies. Deploy as-is to Cloudflare Pages.
Source: Blueprint v1.1 (`~/workspace/your_files/china-bite-blueprint/02-BLUEPRINT.md`),
competitor/GitHub appendix §5–§6, promotion plan, ad sources.

## Files

| File | What it is |
|---|---|
| `index.html` | Single page: decoder, QR ordering, diet cards, demo ads, Kit, referral |
| `styles.css` | Mobile-first CSS, max-width 760px, no external fonts or assets |
| `data.js` | 100 dishes, 8 diet profiles, 12 diet cards, 8 QR buttons, 3 sample cities |
| `app.js` | Decoder, free-count, order list, slip, share, referral, demo ads |
| `README.md` | This file |

## What is implemented

1. **20 dishes** (Blueprint §4.1 first batch), each with main ingredients, hidden risks,
   spice 0–3, reference price ¥ + ≈$ (rate 7.1, dated 2026-11-26).
   Prices are reference estimates, not verified against any restaurant menu.
2. **Decoder**: pick 1 of 8 diet profiles first, then type a Chinese dish name.
   Returns Can eat / Ask first / Avoid + reason + hidden risk + spice + price +
   a big Chinese sentence to show the waiter. Unknown dish → “Not in our list yet”,
   and the query is saved to localStorage only (never uploaded).
3. **Free limit**: 3 decodes/day; 6/day when opened via a friend's `?ref=` link.
   4th decode shows the paywall. Count resets daily (localStorage, per device).
4. **QR ordering (§6.1)**: Route A button table (8 buttons: 加入购物车/选规格/提交订单/
   去支付/桌号/备注/加菜/取消, Chinese + English + note). Route B big order slip
   (table number / people editable, order list synced, Alipay or cash at counter,
   fullscreen overlay). Order list (add from any decode result, shareable).
   Payment pre-check list (4 items, saved locally).
5. **12 diet cards**: vegetarian, vegan, halal, peanut, shellfish, egg, dairy,
   gluten, tree nut, sesame, soy, no spicy — 3 lines of big Chinese each,
   fullscreen view, share via Web Share API / clipboard fallback.
6. **Share & referral**: dish result, diet card and order list are shareable with
   the user's `?ref=XXXXXX` link (generated once, stored in localStorage).
   **Honest limitation: invites are a placeholder in this build.** Sharing does
   NOT count as an invite, and the page says so. Real invite counting (friend
   opens the link and completes a first decode) needs a server (D1) — not built,
   not claimed.
7. **Rewarded ads (DEMO ONLY)**: free version, watch a 5-second demo ad → +3 decodes,
   repeatable, cumulative, max 5 ads/day (+15). Ad is a labelled placeholder
   (“AD EXAMPLE · 广告示例”), auto-returns to the decoder after the countdown.
   Paid preview toggle hides all ads and gives unlimited decodes (preview only).
   **No real AdMob / AdSense / AppLovin / Pangle is connected. No real revenue.**
   Planned real sources (Blueprint §7.1 / `05-AD-SOURCES.md`): AppLovin MAX +
   Pangle Global (app), AdSense Offerwall (web), affiliate cards as fallback.
8. **Kit**: $6.99, 90 days, no ads. Button is `mailto:hello@chinavisacheck.com`
   (“notify me at launch”). **No Stripe, no checkout, no payment is taken.**

## Verification — done 2026-11-26 (local)

Run: `node --check data.js && node --check app.js` → **JS_OK**.
Served locally with `python3 -m http.server 8137` → index/app.js/data.js/styles.css all **HTTP 200**.
Logic test (`/tmp/chinabite-test.js`, Node with a minimal DOM stub — **not a real browser**):
26 checks, **all PASS**, including:

- 20 dishes, 12 cards (3 lines each), 8 profiles, 8 QR buttons
- 麻婆豆腐 + vegetarian profile → **Avoid**, mentions pork, ¥28 ≈$3.94
- 炸酱面 + vegetarian → **Avoid** (contains minced pork)
- Unknown dish （佛跳墙） → “Not in our list yet”, query recorded locally, **not charged**
- Paywall appears on the 4th decode of the day
- Demo ad: overlay opens, skip appears after 5 s, completing it grants **+3** bonus,
  ads watched 1/5, remaining becomes 3 of 6
- QR table contains 加入购物车 / Submit order; order slip contains “请帮我用你们的手机下单”
- Referral code generated (6 chars); invite count labelled as placeholder
- No real Stripe/AdMob/AdSense integration (only a code comment naming them)
- No external scripts or stylesheets; no `100vw`; viewport meta present;
  layout max-width 760px, single column under 560px (no horizontal overflow by design)

## NOT verified — do not claim these

- **No real browser test.** No headless browser was available in this environment;
  the logic test used a Node DOM stub. Console errors and real mobile rendering
  were not observed in a browser. Open the deployed page on a real phone and check.
- **No real phone / restaurant test.** QR Routes A/B, the big order slip, diet-card
  readability in restaurant light, and a waiter understanding the slip have **not**
  been tested in a real restaurant (Blueprint §5/§6 checklists still open).
- **No horizontal-overflow check in a browser.** By design only (max-width + 1-column
  mobile grid); not measured on a device.
- **Prices are estimates**, not checked against restaurant menus. Verify before launch.
- **Referral invites are not verified** (see §6 above). Sharing ≠ invite in this build.
- **Demo ads earn no money.** Real ad networks are not connected.
- **No payment flow.** Kit unlock is a mailto link only.

## Deploy (Cloudflare Pages + chinabite.chinavisacheck.com)

1. Push this folder to a Git repo (do **not** push to the chinavisacheck repo),
   or drag-drop the folder in the Cloudflare Pages dashboard.
2. Cloudflare Pages → Create project → connect the repo (or direct upload).
   Build command: **none**. Build output directory: **`.`** (the folder root).
   No Node, no build step, no environment variables.
3. The project gets a `*.pages.dev` URL first — open it on a phone and run the
   “NOT verified” checks above before pointing a custom domain at it.
4. Custom domain: Pages → Custom domains → add `chinabite.chinavisacheck.com`.
   In Cloudflare DNS for chinavisacheck.com, add a CNAME `eat` → the Pages
   `*.pages.dev` hostname (Pages will show the exact target). Wait for DNS,
   then open `https://chinabite.chinavisacheck.com` and re-run the decoder checks.
5. Validation gate (Blueprint): 2 weeks live, **10+ real $6.99 orders** before
   an independent domain (`chinabitecheck.com`) or any App packaging. Real Stripe
   and real ads are later steps — not in this build.

## 文案风格：slide 式（2026-11-26 改完）

规则：每段 ≤2 行，每行 ≤20 汉字（英文 ≤12 词）；结论先行，每屏第一句就是结论，
再给 3 个要点；标签 / 列表代替段落；只留餐厅 10 秒内要看的信息。功能未动，
只改文案。核查：20 道菜 `note` 全部 ≤15 字，12 张卡每行 ≤20 字，8 条 QR 备注
全部 ≤12 词，`node --check` 通过，本地 http.server 4 个文件全部 HTTP 200。

改了哪些文案：

- **index.html**：标题、说明、按钮、空状态、付费墙全部压短。例：首屏改为
  “Can I eat this? / 10 seconds. No Chinese needed.”；免费次数改为
  “Left today: 3 of 3 / Free: 3/day. Friend's link: 6/day. Ad: +3 each, max 5/day.”；
  扫码区改为 “80%+ restaurants: scan, order, pay. / Pay first. Then they cook.”；
  饮食卡改为 “Tap to show big. No talking needed. / Works offline.”；
  广告区改为 “Watch 5s. Get +3. / Max 5/day. +15 total.”；
  Kit 改为 “100 dishes. 12 cards. 10 cities. / 90 days. No ads.”；
  删掉验证版说明、长段解释、重复提示。
- **data.js · 20 道菜 `note`（原因）**：全部改成一句话 ≤15 字。例：麻婆豆腐
  “经典版必有猪肉末”、宫保鸡丁 “花生是主角，别点”、鱼香肉丝 “有猪肉，没鱼”、
  火锅 “清汤可，牛油否”、麻辣烫 “汤是关键，选清汤”。`hidden` 也压成短语，
  例 “猪肉末。或有猪油、肉汤。”；QR 备注压成 ≤12 词，例 “Pay now. Then they cook.”。
- **data.js · 12 张饮食卡**：每张 3 行短句。例：素食 “我是素食者。/ 不吃肉、鱼、海鲜。/
  不用猪油、肉汤。”；花生 “花生严重过敏。/ 不要花生、花生油。/ 不用做过花生的锅。”。
- **app.js · 提示语**：结论模板压短。例：素食遇肉 “Meat. + 原因”、清真遇肉
  “Meat. Ask: halal? Look for 清真。”、花生 “Peanuts. Don't order.”；
  结果标签改为 Inside / Hidden / Spice / Price / Show waiter；
  未收录改为 “20 dishes here. Not this one. / Saved on this device.”；
  付费墙改为 “Watch a 5s ad: +3. / Or get Kit: $6.99, 90 days.”；
  提示、空状态、计数、广告提示全部压成一句话。
- **未改**：解码逻辑、免费次数、扫码 A/B 路、点餐清单、分享推荐、激励广告占位、
  Kit mailto、价格、辣度、flags。 waiter 问句保留原句（给服务员看，要完整）。

## SEO / AEO / 社媒搜索（2026-11-26 植入）

### SEO

- `index.html` head：完整 meta（title、description、keywords、robots）、
  canonical `https://chinabite.chinavisacheck.com/`、hreflang en/zh/ja/ko/de/fr + x-default。
- 每道菜独立可分享 URL（hash 路由）：`#/dish/<id>`，如 `#/dish/mapo-tofu`。
  打开即显示该菜解码结果（只读，不扣次数）；`#/diet/<id>` 打开对应饮食卡。
  解码后 URL 自动变成本菜链接（`history.replaceState`，不刷新）。
- `sitemap.xml`：38 条（首页 + 20 菜 + 12 禁忌 + 5 城市：上海/北京/成都/西安/广州）。
- `robots.txt`：允许所有，指向 sitemap。

### AEO（答案引擎优化）

- JSON-LD（`@graph`，已用 `json.loads` 验证合法）：WebSite 1 + FAQPage 1（9 问，
  能不能吃、扫码打不开、素食/清真/花生过敏、辣度、价格、支付、免费吗，
  每条答案一句话，结论先行）+ HowTo 1（扫码点餐 3 步）+ Recipe 20
  （每道菜：名称、主料、辣度、参考价）。
- `llms.txt`：China Bite 是什么、20 道菜清单、12 张卡、使用方法、链接。

### 社媒搜索

- Open Graph + Twitter Card：og:title/description/image/type website、
  twitter:card summary_large_image。og:image 用占位图 `og-image.svg`（1200×630）。
- 每道菜分享时，页面 title + description + og:title/description 自动变成该菜的
  verdict，如 “Mapo Tofu — Avoid | China Bite”。
- 分享文案带 `?ref=` 和 `#/dish/<id>` 链接，统一 hashtag `#ChinaBite`。
- 页面新增一节 “Find us · 搜我们”：IG / TikTok / X 搜菜名可找到 verdict 卡。

### 验证（2026-11-26，本地）

- `node --check data.js && node --check app.js` → **JS_OK**（中途修过一次：
  首次 edit 误删了 `function shareText` 签名行，已补回并重新验证通过）。
- `python3 -m http.server 8139`：index.html、app.js、data.js、styles.css、
  sitemap.xml、robots.txt、llms.txt、og-image.svg 全部 **HTTP 200**；
  served HTML 含 1 个 JSON-LD 块。
- JSON-LD：`json.loads` 通过；WebSite 1、FAQPage 1（9 问）、HowTo 1（3 步）、Recipe 20。
- sitemap.xml：XML 解析通过，38 条 URL。

### 未做（部署后做）

- **真实 OG 图片**：现在是占位 SVG，需换成真实菜品照片（1200×630）。
- **GSC 提交**：部署后在 Google Search Console 提交 sitemap，逐条请求索引。
- **索引请求**：74 条 URL 需在 GSC 里请求编入索引，hash 路由 `#/dish/` 不会被
  Google 当作独立页面收录——真正按菜分页（`/dish/mapo-tofu`）是后续步骤。
- **多语言页面**：hreflang 已写，但 zh/ja/ko/de/fr 版页面尚未建，先做英文版。
- **真浏览器测试**：同前，未在真机浏览器上实测 hash 路由和动态 meta。

## 第二阶段 Day 3–8（2026-11-26 完成）

### 新增

1. **扩菜 20 → 56 道**：川菜 12（水煮牛肉、水煮鱼、毛血旺、回锅肉、辣子鸡、
   夫妻肺片、口水鸡、酸菜鱼、干锅牛蛙、麻辣香锅、钵钵鸡、凉拌黄瓜）+
   粤菜 12（白切鸡、烧鹅、叉烧包、虾饺、肠粉、艇仔粥、及第粥、萝卜糕、
   马拉糕、流沙包、腐乳通菜、豉汁凤爪）+ 北方面食 12（打卤面、刀削面、
   油泼面、担担面、重庆小面、热干面、牛肉面、羊肉泡馍、肉夹馍、煎饼、
   葱油饼、锅贴）。每道仍 4 字段：主料、禁忌、辣度 0–3、参考价 ¥ + ≈$
   （汇率 7.1，日期 2026-11-26，标参考价）。原因一句话 ≤15 字，slide 风格不变。
   新肉类 flag（牛蛙 frog、鹅 goose、羊 lamb）已加入解码的 meat 判断，
   否则素食档案会误判为可吃。
2. **Kit 免费预览页**：index.html 新增折叠区 `#kitPreview`（`<details>`，
   默认收起）：每个 Section 恰好 1 个免费样本（1 道菜完整版麻婆豆腐 +
   1 张卡完整版花生过敏 + 1 城清单样本上海），其余锁住（56 道菜 · 12 张卡 ·
   10 城 — Kit only），带 $6.99 按钮（仍为 mailto 通知我，**不接真实支付**）。
3. **10 城清单样本**：先做上海、北京、成都 3 城，每城 3 家示例，
   只写类型 + 区域（如“素食馆示例 · 静安寺一带”），**不编造具体店名、
   地址和电话**，每家都标“地址待核实”。其余 7 城在 Kit 里。
4. **SEO 同步**：sitemap.xml 38 → **74 条**（1 首页 + 56 菜 + 12 禁忌 + 5 城）；
   llms.txt 菜单 20 → 56 道；JSON-LD Recipe 20 → **56**（graph 共 59 项）。

### 验证（2026-11-26，本地）

- `node --check data.js && node --check app.js` → **JS_OK**。
- 新测试 `/tmp/chinabite-test2.js`（Node + 最小 DOM 桩，**不是真浏览器**）：
  **23 项全部通过**，包括：56 道菜、id 唯一、12 卡、8 档案、8 按钮、
  3 城各 3 家且都标“地址待核实”、原因全部 ≤15 字、Kit 预览区存在且
  “Rest is locked”、Kit 仍为 mailto 无 Stripe、sitemap 74 条、
  JSON-LD Recipe 56、llms.txt 56 道。
- 抽查 5 道新菜解码正确：麻婆豆腐 + 素食 → Avoid；宫保鸡丁 + 花生过敏 →
  Avoid；鱼香肉丝（无档案）→ 含“没鱼”；水煮牛肉 + 不吃辣 → Avoid（辣 3/3）；
  叉烧包 + 素食 → Avoid（猪肉）。另查凉拌黄瓜 + 素食 → 可吃。
- 本地 http.server：8 个文件全部 **HTTP 200**；JSON-LD `json.loads` 通过
  （graph 59 项，Recipe 56）；sitemap.xml 解析通过。
- 首次测试跑出 2 个测试桩问题（非应用 bug，已修测试桩重跑通过）：
  城市渲染断言未读子节点、桩缺 `classList.toggle`。

### 未验证（第二阶段新增）

- **价格未对照真实菜单**：36 道新菜的价格均为参考估算，未对照任何
  真实餐厅菜单核对，上线前需抽查。
- **餐厅地址未核实**：3 城 9 家全是“类型 + 区域”示例，无真实店名、
  地址、电话，上线前必须逐家核实或删除。
- **未真机测试**：同前。Kit 预览折叠区、城市列表在真机上的渲染未实测。
- **剩余 44 道菜已做完（见顶部“扩菜到 100 道”一节）**：素食 10 + 清真 8 + 江浙 10 + 火锅/烧烤 8 +
  甜品 8，菜品总数 100 道。

## 美团 / 点评结合 + 外卖（2026-11-26）

研究来源：英文 + 中文指南检索（travelhubchina、chinaneighbor、wanderinchina、chinavisit、waytochinatravel、trip.com、livelearnchina、todaychinese、traveltoeast、gochinatravel、chinasurvivalkit、shenzhendecoded、journeytochina、rutzgo），2026-11-26。**未做真机实测**，以下均为公开指南说法，标“未验证”的不要当作事实。

### 开发版已做

1. **新折叠区 `#meituanSection`（index.html，默认收起，slide 风格，每段 ≤2 行）：**
   点评 = 选店（评分、照片、人均、必吃榜），美团 = 拿货（外卖到酒店）；不用 +86 能做的事（看榜、看图、看价、离线保存）vs 要登录/+86 的事（下单、排队取号、买团购券）；英文只到按钮一级，店名菜名评论还是中文；小程序路最稳（微信/支付宝，不用另注册，微信可整页翻译）；读榜方法（5 分制、人均、看实拍照片、必吃榜、团购券先看规则、桌上二维码开的是餐厅自己的小程序）；外卖何时用、最佳路径（支付宝小程序 → 淘宝闪购，其次美团外卖小程序）、地址必须中文、骑手电话打不通的解法（前台备注大字句 + 联系电话填前台）、大堂自取。
2. **解码结果新增 2 行 + 1 个按钮（app.js `renderResult`）：**
   “Dianping: search ‘麻婆豆腐’ to see photos, score, price.” + “Delivery? Copy the dish name. Search it in Meituan Waimai. Hotel card is below.” + “Copy dish name · 复制菜名”按钮（剪贴板，失败时弹窗显示中文菜名）。**不做真实跳转链接，不调 API。**
3. **酒店地址卡（index.html + app.js）：** 酒店中文名 + 房号两个输入框，本机 localStorage 保存；“Copy hotel card · 复制地址卡”生成中文文本（含“请放在前台，不要打电话，发信息即可。谢谢！”）。**不做真实下单，不写配送费和时间。**
4. **3 城清单每家加一行（app.js 城市渲染）：** “Dianping: search the shop name to see its score. No score copied here. 点评评分参考：去点评搜店名看分。”**不编造评分和店名。**
5. **JSON-LD FAQ 9 → 11 问：** 新增“美团/点评怎么找吃的？”和“能不能外卖送到酒店？”两问，一句话答案，结论先行。

### 未做

- **真实 API 对接：** 美团/点评无公开 API 可接，吃店库不在计划内，China Bite 只做“解码 + 告诉你去哪看”。
- **真实店库：** 3 城 9 家仍是“类型 + 区域”示例，无真实店名、地址、电话、评分。
- **真机扫码/外卖实测：** 小程序排队取号、团购券核销、外卖下单到酒店前台，均未在真实餐厅/酒店实测；配送费、时间、团购折扣幅度各来源说法不一，产品里不写数字。
- **外国卡直绑、实名门槛、短信到达率：** 各来源说法冲突，蓝本 03 §7 已标“未验证”。

## 部署状态 — 2026-11-26 12:32 CST（已上线 ✅，China Bite 全改名版 + 熊猫 Logo）

- **已上线**：`https://chinabite.chinavisacheck.com`（200，首页含 China Bite，
  口号 “Discover China, One Bite at a Time.”，sitemap 74 条， served 首页
  0 处 EatChina/eatchina）。备用地址 `https://eatchina.pages.dev`（200，
  与本地 index.html 字节一致 35631B）。最新部署 ID
  `a79a83da-765f-4965-8c40-c51f4b4595fa`（2026-11-26 12:32 CST，
  从新路径 `~/workspace/china-bite-dev/` 直接上传，11 个文件；
  上一次部署：`d6b7f24f-f4a8-4393-9db6-cd7b3016e604` 12:31）。
  部署 URL：`https://a79a83da.eatchina.pages.dev`（200）。
- **Logo**：熊猫版是当前站点头像，`assets/media-generation-china-bite-logo-panda-0-89cb3ebc-7f30-4942-a14d-404c8edee0fd.webp`
  线上 200（333544B，与本地一致；favicon + apple-touch-icon + 首页 72×72
  圆形头像，3 处引用）。水墨版也随本次上传并线上 200（296256B），目前
  页面未引用。注意：header img 的 alt 文本仍写 “ink plate and chopsticks”，
  与实际熊猫图不符，待改文案时顺手修正。
- **验证**：线上文件已逐项比对本地源码——index.html（除 Cloudflare 邮件
  混淆改写两处 mailto 外一致）、app.js、data.js、styles.css、llms.txt、
  sitemap.xml、robots.txt、og-image.svg、新 Logo 全部一致；
  `window.CHINABITE_DATA`、推荐码 `CB` 前缀、localStorage 迁移代码均已在线上。
- **怎么上的**：旧的只读 OAuth 连接权限不够（Pages/Zone 均 403），改用
  custom.cloudflare 全权限 API Token（Secure Vault，Bearer Header）后成功。
  流程：建 Pages 项目 `eatchina`（ID e4affc45-e43e-460c-8ad1-7f375e22b39b）
  → Direct Upload（upload-token → 上传 9 文件 → upsert-hashes → 创建部署）
  → Pages 加自定义域名 `chinabite.chinavisacheck.com` → DNS 手动加一条 CNAME
  `eat` → `eatchina.pages.dev`（proxied，ID 63997c23b388dbad2c92aeeee8b0c50c，
  主站其他 DNS/Worker 未动）。域名约 2 分钟后变 active，3 次 curl 均为 200。
  部署脚本：`~/workspace/custom-connectors/custom.cloudflare/bin/pages_deploy.py`。
  注意：该脚本依赖 blake3 模块，系统 python3（3.12）里没有；2026-11-26
  部署时用 `/tmp/cf-venv/bin/python`（venv 里 pip 装了 blake3）跑的。
  /tmp 是临时的，下次部署前如 venv 不在了需重建（`python3 -m venv /tmp/cf-venv && /tmp/cf-venv/bin/pip install blake3`）。
- **注意**：Cloudflare 的邮件地址混淆把页面里的两个 mailto 链接重写成了
  `/cdn-cgi/l/email-protection#...`，并注入 email-decode.min.js。真浏览器里
  JS 会解码还原，mailto 仍可用。如需原样显示，可在 Cloudflare 关掉
  Scrape Shield 的 Email Address Obfuscation。
- **旧卡点已解决**：GitHub 建库 403 不再挡路（本次走直接上传，未用 GitHub；
  如需 Git 关联，仍需 Oliver 手动建空仓库 `chematecc/chinabite`）。
- **未验证**：真机浏览器点击解码（麻婆豆腐+素食= Avoid）未在部署后的线上
  站实测；部署的 data.js/app.js 与本地验证过的版本字节大小一致
  （22376B / 19935B），本地 Node 测试 26 项曾全部通过。
- **下一步**：真机打开 `https://chinabite.chinavisacheck.com` 验一遍（首页、
  解码、扫码区、Kit 预览、美团区）；去 GSC 提交 sitemap（74 条），逐条请求索引。
  验证门槛不变：上线 2 周、**10+ 笔真实 $6.99 订单**后，才考虑独立域名或 App 包装。

## 部署步骤（同前，更新数字）

1. 同上：推到独立 Git 仓库（不要推到 chinavisacheck 仓库）或直接上传
   Cloudflare Pages。构建命令：无；输出目录：`.`。
2. 先拿 `*.pages.dev` 地址，在真机上跑“未验证”检查（尤其 Kit 预览、
   城市列表、56 道菜解码），确认无控制台错误、无横向溢出。
3. 自定义域名 `chinabite.chinavisacheck.com`（CNAME `eat` → Pages 主机名），
   再跑一遍解码检查。
4. GSC 提交新 sitemap（74 条），逐条请求索引。
5. 验证门槛不变：上线 2 周、**10+ 笔真实 $6.99 订单**后，才考虑独立域名
   或 App 包装。真实 Stripe 和真实广告是后续步骤，不在本次构建内。

## 品牌更名 — 2026-11-26（China Bite）

- **旧名 EatChina → 新名 China Bite**，口号：Discover China, One Bite at a Time.（历史注记：本节保留旧名一次，仅作更名记录。）
- 首页 hero：China Bite 🥢 + 口号 + “Can I eat this? / 10 seconds. No Chinese needed.”（保留）。
- 对外显示处已全改：title、description、og/twitter、JSON-LD（WebSite / FAQPage / Recipe 的 name）、llms.txt、分享文案、hashtag 统一为 #ChinaBite。
- **Logo**：水墨版 `assets/media-generation-china-bite-logo-ink-0-beca229c-8d82-4b63-82d2-46c8c4030f7e.webp`（盘子 + 筷子），已用作站点头像（header img 72×72 圆形）与 favicon（`link rel=icon` + apple-touch-icon）。旧 logo（筷子夹饺子）已删除。og-image 仍为占位 `og-image.svg`，未换。

## 命名全面更改 — 2026-11-26（China Bite / chinabite）

- 文件夹：`~/workspace/eatchina-dev/` → `~/workspace/china-bite-dev/`；Dashboard → `~/workspace/china-bite-dashboard/`，Worker 名改为 `china-bite-dashboard`；蓝本 → `~/workspace/your_files/china-bite-blueprint/`（符号链接，指向 goal 文件夹）。旧路径各留一个 README 说明已搬家。
- 代码内全部改名：localStorage key `chinabite_state_v1` / `chinabite_hotel_v1`（首次读取旧 key 后迁移，迁移代码见 app.js，可在以后删除）；全局变量 `window.CHINABITE_DATA`；推荐码改为 `CB` 前缀；module=`chinabite`；拟议独立域名改为 `chinabitecheck.com`。
- **刻意不动**：域名 `chinabite.chinavisacheck.com`、mailto `hello@chinavisacheck.com`。Pages 项目名已于 2026-11-26 12:54 改为 `chinabite`（见顶部“Pages 项目改名”一节；备用地址现为 `https://chinabite-5qq.pages.dev`，旧项目 `eatchina` 已删除）。原型 artifact 的 slug 改名待定。
- **线上已重新部署**：2026-11-26 12:31 CST，China Bite 更名版 + 水墨 Logo 已上线（部署 ID `d6b7f24f-f4a8-4393-9db6-cd7b3016e604`）。以后改动仍需用 `pages_deploy.py` 从新路径 `~/workspace/china-bite-dev/` 重新上传。

## 版面改进 — 2026-11-26 13:10 CST（Blondie 打法：时间线 + 故事菜 + 第二人称代入）

- **Hero**：熊猫 logo + China Bite + 口号不变；痛点改成第二人称场景句“你刚坐下，服务员递来一张全是中文的菜单，扫码也看不懂。”+“3 秒，告诉你这道菜能不能吃。”；免费计数卡从 header 移进解码器顶部，首屏可见输入框 + 3 次免费计数。
- **解码结果（app.js renderResult）**：verdict 大字在最上，依次 Why（一句话 ≤15 字）、Inside、Hidden、Spice、Watch（过敏 flag）、Price ¥+≈$、Show waiter；结果下面 3 个下一步按钮：点评搜这道菜（复制菜名 + 跳美团区）/ 扫码怎么点（跳 QR 区）/ 饮食卡给服务员看（跳饮食卡区）。
- **出发前 48 小时时间线（#ready48，解码器后、折叠区上方）**：3 步卡片，全用“你”开头：你先绑好 Alipay / 你保存酒店中文地址卡 / 你下好离线翻译；导语“你出发前要做的 3 件事，落地第一顿饭前就用得上。”
- **每城 3 道故事菜（#storyDishes）**：成都担担面/麻婆豆腐/回锅肉、广州烧鹅/虾饺/肠粉、上海生煎包/蟹粉小笼/红烧肉，每道一句“你”代入的真实场景（例：你在成都早上，街边小店，老板现拌，你站着吃完就走；你中午去买烧鹅，要排队，斩半只带走；你早上排队买生煎，咬开先喝汤，小心烫），只写符合常识的场景，不编店名/地址/价格外细节；卡片点按即解码该菜；无菜品图，用暖色块 + emoji 占位（assets 里只有 logo，没有编图片路径）。
- **Mobile-first**：main max-width 760px → 480px 单列，按钮/芯片 min-height 44px、输入框 48px，字 16px+，卡片留白加大（padding 20px，margin 20px），圆角 20px；暖色块渐变（#fdf6ec 等），无空白灰框；文案无“高效/智能/一站式”。
- **未改**：data.js 100 道菜、sitemap 118 条、localStorage key（chinabite_state_v1 / chinabite_hotel_v1）、Kit 免费每区恰好 1 个样本。
- **本地验证**（/tmp/chinabite-layout-test.js，Node DOM 桩，非真浏览器）：30 项全部通过，包括 hero/placeholder/时间线/故事卡第二人称、解码结果顺序与 3 个下一步按钮、故事菜可解码。
- **部署**：2026-11-26 13:11 CST，项目 `chinabite`，部署 ID `f32ef77c-72de-435a-9827-1b13f9870727`（production）。验证：`https://chinabite.chinavisacheck.com` 200（56,928B），新版面文案 7 处全在；`https://chinabite-5qq.pages.dev` 200；sitemap 118 条。注：“点评搜这道菜”按钮文案在 app.js 里由 JS 渲染，静态 HTML 里查不到，线上 app.js 已验证含该文案（4 处匹配）。
