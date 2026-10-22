# 从 Vercel 迁移到 Cloudflare

本站已经可以整体部署在 Cloudflare Workers 上：静态页面由 Workers 静态资源直接提供，问道等接口（`/api/*`）由 `worker/index.mjs` 处理。迁移期间 Vercel 的部署不受影响，可以两边并行，确认无误后再切域名、关 Vercel。

## Vercel 上原有的东西，迁到哪里

| Vercel 上 | 本项目用途 | Cloudflare 上 |
|---|---|---|
| 静态托管 | 所有 HTML / JS / 数据文件 | Workers 静态资源（`wrangler.jsonc` 的 `assets`，不发布的文件列在 `.assetsignore`） |
| Serverless 函数 `api/chat.js` | 问道：服务端组装提示词、检索毛选原文与党史案例、流式转发模型回答 | `worker/index.mjs` 的 `/api/chat` |
| Serverless 函数 `api/public-config.js` | 给浏览器 Supabase 公开配置 | `worker/index.mjs` 的 `/api/public-config` |
| 环境变量 | 见下表 | Worker 的「变量和机密」 |
| 域名 `redwisdom.xyz`（A 记录指向 Vercel） | 正式站 | Worker 自定义域 |
| 每个 PR 的预览部署 | 预览改动 | Workers Builds 的非生产分支预览地址 |
| 定时任务、Vercel KV / Postgres / Blob、Analytics | 本项目都没有使用 | 无需迁移 |

另外：`www.redwisdom.xyz` 目前是 CNAME 到 `kirinzhang.github.io`（GitHub Pages，只有静态页面，问道接口在那里不可用）。迁移时建议一并改到 Cloudflare。

## 需要从 Vercel 抄过来的变量

在 Vercel 项目的 Settings → Environment Variables 里逐个查看并复制到 Cloudflare：

| 变量 | 类型 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 机密 | 问道使用的模型（推荐） |
| `OPENROUTER_API_KEY` | 机密 | 备用模型服务，未配置 DeepSeek 时使用 |
| `SUPABASE_URL` | 变量 | 登录与云同步 |
| `SUPABASE_ANON_KEY` | 变量 | Supabase 公开匿名密钥 |
| `SUPABASE_GOOGLE_AUTH_ENABLED` | 变量 | `true` 时显示 Google 登录 |
| `CHAT_ALLOWED_ORIGINS` | 变量（可选） | 额外允许调用问道的域名，逗号分隔；同域名无需设置 |
| `CHAT_LIMIT_PER_MINUTE` / `CHAT_LIMIT_PER_DAY` / `CHAT_GLOBAL_LIMIT_PER_DAY` | 变量（可选） | 限流，默认每分钟 6 次、每天 60 次 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 机密（可选） | 跨实例共享限流计数 |

## 费用：选 Workers Free 还是 Workers Paid（$5/月）

- 静态页面请求在两种方案下都免费、不限量。
- 问道每次请求要在服务端检索 4MB 的毛选全文索引：实测每次约 20ms CPU，每个实例的第一次请求（解析索引）约 70–100ms CPU。
- Workers Free 每次请求只有 10ms CPU，问道会经常报错（错误码 1102）；**Workers Paid（$5/月）** 每次请求可用 30 秒 CPU，并含每月 1000 万次请求，足够本站使用。
- 结论：开通 Workers Paid，月费从 Vercel Pro 的 $20 降到 $5。若暂时不需要问道，也可以先用 Free。

## 迁移步骤

1. **注册 Cloudflare 并添加站点**：Cloudflare 控制台 → Add a domain → 输入 `redwisdom.xyz` → 选 Free 方案。Cloudflare 会扫描现有 DNS 记录，核对一遍（目前只有根域名 A 记录和 `www` 的 CNAME）。
2. **改域名服务器**：到 GoDaddy（当前 NS 为 `ns21/ns22.domaincontrol.com`）把域名服务器改成 Cloudflare 给出的两个地址，等待生效（通常几分钟到几小时）。生效前网站仍由 Vercel 提供，不会中断。
3. **创建 Worker 并连接 GitHub**：Workers & Pages → Create → Import a repository → 选 `kirinzhang/redwisdom`，生产分支 `main`。构建命令留空，部署命令保持 `npx wrangler deploy`。项目名用 `redwisdom`（与 `wrangler.jsonc` 一致）。
4. **填变量和机密**：Worker → Settings → Variables and Secrets，按上表添加（API Key 选 Secret 类型）。
5. **（推荐）开通 Workers Paid**：Workers & Pages → Plans → Workers Paid。
6. **在临时地址上验收**：打开 `https://redwisdom.<你的子域>.workers.dev`，检查首页抽卡、阅读、党史沙盘地图、长征沙盘、问道（能流式回答）、登录。访问 `/api/chat` 应返回 `{"status":"ok", "hasApiKey": true}`。
   - 如果要在临时地址上测试登录，在 Supabase → Authentication → URL Configuration 的 Redirect URLs 里临时加上这个地址。
7. **绑定正式域名**：Worker → Settings → Domains & Routes → Add → Custom domain，添加 `redwisdom.xyz` 和 `www.redwisdom.xyz`。Cloudflare 会自动替换原来指向 Vercel、GitHub Pages 的记录并签发证书。
   - 可选：在 Rules → Redirect Rules 里把 `www.redwisdom.xyz` 301 跳转到 `redwisdom.xyz`。
8. **停用 GitHub Pages**：仓库 Settings → Pages → 取消发布（之后可以删除仓库里的 `CNAME` 文件）。
9. **观察几天后关闭 Vercel**：确认正式站流量正常后，在 Vercel 删除项目或降级为 Hobby，然后取消 Pro 订阅。仓库里的 `vercel.json`、`api/chat.js`、`api/public-config.js` 可以在那之后删除（本地开发服务器仍在用 `api/chat-core.mjs`）。

## 本地预览与手动部署（可选）

```bash
npm install            # 安装 wrangler
npx wrangler dev       # 本地以 Workers 方式运行，机密写在 .dev.vars（已加入 .gitignore）
npx wrangler deploy    # 手动部署到 Cloudflare
```

日常开发仍可用 `npm run dev`（Node 本地服务器，读取 `.env`）。
