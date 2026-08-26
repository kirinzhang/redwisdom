# Red Wisdom Cards (红色智慧卡片)

**Don't worry, be fighting.**
遇事不决读毛选，把问题带回事实、调查、矛盾分析、行动和复盘。

Red Wisdom 是一个以《毛泽东选集》为核心内容和方法论来源的学习与实践工具网站。

- 不登录时：开放、普惠的毛选阅读与智慧卡片网站。
- 登录后目标形态：持续用毛选方法训练用户分析现实问题、制定行动、完成复盘的个人实践系统。

当前版本已经围绕“问题案例”打通抽卡、阅读、问道、行动和复盘。首页保持简洁抽卡体验；用户可以把长期现实困难记录到「我的问题」，在同一条时间线中积累事实、问答、笔记、行动和结果。核心页面支持移动端导航与 PWA 安装。账户系统使用 Supabase Google 登录；配置完成后会在首次登录时合并本机档案，并持续同步，未配置时自动保持本机私密模式。

🌐 **在线访问**: [redwisdom.xyz](https://redwisdom.xyz)

## 核心功能

### 1. 智慧卡片

- 抽卡、翻牌、再抽一次的仪式感交互。
- 卡片正面保持简洁，只展示语录和出处，不在卡面加入滚动区域。
- 抽卡结果可在卡片外直接进入完整出处，或把语录作为上下文带到问道页。
- 首页不放训练面板，让抽卡成为第一屏唯一主体验。

### 2. 问道毛选

- AI 定位为「经过毛选方法论蒸馏的实践教练」。
- 提供「直接解惑」和「逐步分析」两种模式；后者一次只追问一个环节，再综合已有问题材料。
- 回答围绕事实、调查、矛盾分析、行动和复盘展开。
- 输出结构包含：问题复述、问题类型、毛选方法、分析步骤、行动建议、今日实践、复盘问题。
- 发送问题时会检索带段落锚点的原文、精选语录、文章导读和历史案例，要求 AI 标明文章及定位。
- 历史类比必须同时说明相似点、差异和适用边界，不能把历史结果当作现实预测。
- 问答会保存为本机私密历史，并在我的档案页展示最近记录。
- AI 回答可以收藏到本机学习档案，也可以继续保存为实践任务。
- API 代理限制模型白名单、消息数量、内容长度和输出 token，降低公开代理滥用风险。

### 3. 阅读毛选

- 毛泽东选集全 5 卷文章在线阅读。
- 当前收录 229 篇文章和 2656 个可检索正文块，支持全文搜索并直达段落锚点。
- 支持按卷目录浏览。
- 阅读页提供按问题学习的主题路径，并把《实践论》《矛盾论》《论持久战》《反对本本主义》《为人民服务》等热门文章重点推荐。
- 党史时间线页提供 1921 年至今的大事汇总、路线之争决策点、党代会速查，事件可直达对应毛选原文。
- 「毛选思维 · 现代问题」栏目：把毛选思维用在职场打压、精神内耗、迷茫拖延等现代常见困惑上，每个案例附原文引文、思维拆解、行动清单与适用边界。
- 核心文章提供导读：解决的问题、背景、核心观点、应用场景、阅读问题和推荐实践。
- 阅读正文支持字号调节，并把字号偏好保存在本机浏览器。
- 每篇文章支持保存一条本机阅读笔记，并在我的档案页展示最近笔记。
- 支持本机阅读进度、文章收藏和原文摘录。
- 当前正文为项目整理的在线文本，并非出版社官方电子版；严肃引用应以人民出版社纸质版本复核。

### 4. 问题、实践与档案

- 「我的问题」统一保存现实问题、事实与判断、主要矛盾、待调查事项、可用力量和下一步行动。
- 问答、阅读笔记和实践可以关联同一个问题，并在问题时间线中按类型筛选。
- 复盘记录预期、实际、证据、认识修正和下一步，也可以把问题标记为已解决。
- 阅读导读和 AI 回答都可以保存为实践任务。
- 我的档案页训练面板会根据本机档案推荐下一步：先复盘已完成实践，再继续今日实践、阅读或问道；进入实践页后会定位到对应记录。
- 实践页支持手动记录现实问题、主要矛盾、缺少的调查、可用力量、今日行动、复盘标准、实际结果、复盘总结和下一步行动。
- 实践页会展示已保存的主要矛盾、缺少的调查、可用力量和复盘标准，避免从分析向导或 AI 生成实践后丢失方法论上下文。
- 实践页会为每条记录生成复盘提示，引导用户对照预期、核对事实、检查矛盾并确定下一步。
- 我的档案页展示实践数量、复盘状态和常用方法论标签，并把完整本机档案转成下一步训练建议。
- 抽卡、阅读、问道、实践、我的核心页面在移动端提供固定底部导航。
- 当前数据保存在本机浏览器 localStorage 中。
- 登录页接入 Google OAuth；配置 Supabase 并执行数据库 schema 后，首次登录会自动迁移本机档案，之后持续双向合并同步。
- 我的档案页支持导出本机实践、问答历史、AI 回答收藏、阅读笔记、阅读进度、文章收藏、原文摘录和语录收藏，便于迁移和备份。

## 技术栈

| 类型 | 技术 |
|------|------|
| 前端 | HTML5 + Tailwind CSS + Vanilla JS |
| AI 对话 | DeepSeek API V4 Pro（OpenRouter 作为回退） |
| API 代理 | Vercel Serverless Function |
| 账户系统 | Supabase Auth (Google OAuth，配置后启用) |
| 数据库 | Supabase Postgres + Row Level Security |
| 部署平台 | Vercel |
| 数据格式 | JSON + Markdown |
| 离线能力 | Web App Manifest + Service Worker |
| 测试 | Node.js built-in test runner |

## 本地运行

```bash
git clone https://github.com/kirinzhang/redwisdom.git
cd redwisdom

npm run dev
# 访问 http://127.0.0.1:4173
```

本地开发服务器会读取仓库根目录的 `.env`，并提供与 Vercel 一致的 `/api/chat` 路由。本地不会注册 PWA Service Worker，避免开发服务器停止后仍显示缓存页面。

AI 对话优先直连 DeepSeek V4 Pro：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

未配置 DeepSeek Key 时，可以使用 `OPENROUTER_API_KEY` 回退到 OpenRouter 上的 `deepseek/deepseek-v4-pro`。部署到 Vercel 时，需要在项目环境变量中单独配置密钥；本机 `.env` 不会上传。

账户系统需要在 `config.js` 中填写 Supabase 项目配置：

```js
SUPABASE_URL: 'https://your-project.supabase.co',
SUPABASE_ANON_KEY: 'your-anon-key'
```

Vercel 生产环境推荐直接配置以下公开环境变量，前端会通过 `/api/public-config` 在运行时读取，无需把值写入仓库：

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_GOOGLE_AUTH_ENABLED=false
```

只允许公开的 Supabase URL、Publishable Key 和 Provider 状态通过该接口返回；DeepSeek、OpenRouter 等服务端密钥不会暴露。Google Provider 配置完成后，把 `SUPABASE_GOOGLE_AUTH_ENABLED` 改为 `true`，并重新部署。

还需要在 Supabase Authentication 中启用 Google Provider。Google Cloud OAuth 客户端的 Authorized redirect URI 是 Supabase Auth 回调：

```text
https://你的项目引用.supabase.co/auth/v1/callback
```

同时在 Supabase URL Configuration 的 Redirect URLs 中加入网站登录页：

```text
https://你的域名/login.html
https://redwisdom.xyz/login.html
http://127.0.0.1:4173/login.html
```

数据库表和 RLS 策略见 `docs/database/supabase-schema.sql`。

## 测试

```bash
node --test tests/*.test.js tests/*.test.mjs
node --check script.js
node --check js/analysis-guide.js
node --check js/auth-utils.js
node --check js/cloud-sync.js
node --check js/conversation-store.js
node --check js/quote-utils.js
node --check js/ai-methodology.js
node --check js/reading-notes-store.js
node --check js/reading-progress-store.js
node --check js/reading-guides.js
node --check js/saved-quotes-store.js
node --check js/saved-answers-store.js
node --check js/practice-store.js
node --check js/practice-review-prompts.js
node --check api/openrouter-guard.mjs
node --check api/chat.js
```

## 项目结构

```text
redwisdom/
├── index.html                  # 首页 - 智慧卡片
├── chat.html                   # 问道毛选 - AI 实践教练
├── reading.html                # 毛选阅读页
├── timeline.html               # 党史时间线与大事汇总
├── modern.html                 # 毛选思维 · 现代问题栏目
├── problems.html               # 现实问题工作台与时间线
├── practice.html               # 实践任务与复盘
├── me.html                     # 个人学习档案预览
├── login.html                  # 登录与账户状态
├── config.js                   # 前端 API 配置
├── script.js                   # 卡片交互逻辑
├── style.css                   # 首页卡片样式
├── js/
│   ├── ai-methodology.js       # AI 方法论 prompt 和 payload
│   ├── analysis-guide.js       # 毛选方法分析向导
│   ├── ai-context.js           # 本地毛选语录/导读上下文检索
│   ├── auth-utils.js           # Supabase 登录状态工具
│   ├── cloud-sync.js           # 学习档案云同步、拉取和合并
│   ├── auto-sync.js            # 首次迁移与持续同步调度
│   ├── conversation-store.js   # 本机私密问答历史
│   ├── problem-case-store.js   # 问题案例与复盘时间线
│   ├── guided-coach.js         # 逐步分析状态机
│   ├── full-text-search.js     # 原文全文检索
│   ├── history-case-retrieval.js # 历史案例检索与边界提示
│   ├── practice-store.js       # 本机私密实践存储
│   ├── practice-review-prompts.js # 实践复盘提示生成器
│   ├── quote-utils.js          # 语录归一化和展示规则
│   ├── reading-notes-store.js  # 本机私密阅读笔记
│   ├── reading-progress-store.js # 本机阅读进度、收藏和摘录
│   ├── saved-quotes-store.js   # 本机私密语录收藏
│   ├── saved-answers-store.js  # 本机私密 AI 回答收藏
│   ├── timeline-data.js        # 党史时间线数据（事件、决策点、党代会）
│   ├── timeline.js             # 党史时间线页渲染与筛选
│   ├── modern-cases.js         # 现代问题案例数据（场景、原文依据、行动清单）
│   ├── modern.js               # 现代问题栏目渲染与筛选
│   └── reading-guides.js       # 阅读导读和主题路径
├── api/
│   ├── chat.js                 # Vercel API 代理
│   ├── chat-provider.mjs       # DeepSeek/OpenRouter 服务选择
│   └── openrouter-guard.mjs    # AI 请求白名单和长度守卫
├── data/
│   ├── quotes.json             # 精选语录
│   ├── catalog.json            # 文章目录
│   ├── search-index.json       # 带段落锚点的全文检索索引
│   ├── history-cases.json      # 历史问题案例库
│   ├── text-edition.json       # 文本版本与来源说明
│   └── articles/               # 毛选文章 Markdown
├── tests/                      # Node 测试
├── docs/database/
│   └── supabase-schema.sql     # Supabase 表结构与 RLS
├── docs/product/
│   └── redwisdom-requirements.md
└── assets/                     # 图片资源
```

## 产品路线

### 阶段 1：游客态增强

- 修复抽卡翻牌错误。
- 卡片回到简洁卡面，只保留语录、出处和时间。
- 阅读页增加热门文章推荐、更多问题路径、核心文章导读和字号调节。
- AI 从角色扮演升级为毛选方法论实践教练。
- API 代理加入基础请求守卫。

### 阶段 2：账户与保存

- 当前过渡版：使用 localStorage 保存实践和复盘，验证产品闭环。
- 当前已支持：登录页、Supabase 配置检测、Google OAuth 调用骨架。
- 当前已支持：本机问答历史、本机 AI 回答收藏、本机阅读笔记、本机阅读进度、本机文章收藏、本机原文摘录、本机语录收藏、本机实践记录导出。
- 当前已支持：实践、问答、消息、阅读笔记、阅读进度、文章收藏、原文摘录、语录收藏、AI 回答收藏同步到 Supabase 的前端映射、从 Supabase 拉取并按更新时间合并恢复到本机，以及 `profiles` / `practices` / `conversations` / `messages` / `reading_notes` / `reading_progress` / `highlights` / `saved_quotes` / `saved_answers` RLS schema。
- 后续增强：真实 Supabase 项目配置、线上 OAuth 回调验证、线上云端上传/恢复端到端验证。

### 阶段 3：实践闭环

- 当前已支持：从问答、文章导读生成本机实践任务。
- 当前已支持：从毛选方法分析向导生成结构化提问和本机实践任务。
- 当前已支持：实践页手动创建和展示主要矛盾、缺少的调查、可用力量、复盘标准，并提供对照预期、核对事实、检查矛盾、确定下一步的复盘提示。
- 当前已支持：我的档案页训练面板基于本机档案推荐复盘、继续实践、继续阅读或继续问道，并可跳转定位到对应实践记录。
- 当前已支持：登录后学习档案上传到云端、从云端合并恢复。
- 后续增强：真实云端环境端到端验证、跨设备恢复验证。

### 阶段 4：多语言

- 中文原文优先。
- 当前已支持：问道页、阅读页和实践页语言偏好、中文/英文基础界面文案，阅读页核心导读与主题路径英文版，阅读字号调节，实践页英文复盘提示，AI 回答语言约束。
- 后续增强：全站英文界面、多语言路由和更多文章导读。
- 术语表。
- 中英对照阅读。
- 多语言 AI 问答。

## 需求文档

完整产品需求见：

[docs/product/redwisdom-requirements.md](docs/product/redwisdom-requirements.md)

---

*Powered by Vercel & DeepSeek*
