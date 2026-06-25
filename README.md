# Red Wisdom Cards（红色智慧卡片）

**Don't worry, be fighting.**

遇事不决读毛选。这个项目现在是一个「毛选 / 毛泽东思想 BibleChat 风格」MVP：保留红色、宣纸、毛选阅读的视觉气质，同时把抽卡、原文阅读和现实问题咨询连成一个轻量 Web 应用。

## 核心功能

### 1. 智慧卡片 - 随机抽取语录
- **仪式感抽卡**: 首页支持抽卡、翻牌、重新抽取，卡面采用红色背面和宣纸正面。
- **行动入口**: 抽到语录后，可以带着这句话进入「问道毛选」，也可以跳转到阅读页继续读原文。
- **语录数据**: `data/quotes.json` 收录 181 条精选语录，并由 `data.js` 提供给首页使用。

### 2. 问道毛选 - Skill-first 原文支撑咨询
- **毛选方法论 Skills**: 先从 `data/mao-skills.json` 选择 2-3 个方法论 skill，例如抓主要矛盾、调查研究、实践检验、群众路线。
- **原文出处支撑**: 再从 `data/search-index.json` 检索毛选原文段落，回答附带引用卡片和“读原文”入口。
- **现实问题咨询**: 面向焦虑、工作推进、被批评、行动迟滞、学习计划等现实问题，输出安慰、分析和下一步行动。
- **基于 DeepSeek / OpenRouter**: 通过 `/api/chat` 的 Vercel Serverless Function 代理调用模型。

### 3. 阅读毛选 - 目录与原文阅读
- **五卷目录**: `data/catalog.json` 按卷组织 229 条目录记录。
- **全文阅读**: `data/articles/` 提供毛选文章 Markdown，阅读页支持目录导航、文章切换和来源提示。
- **检索索引**: `data/search-index.json` 包含 2119 个原文检索 chunks，用于咨询页引用支撑。

## 技术栈

| 类型 | 技术 |
| --- | --- |
| 前端 | HTML5 + Tailwind CSS + Vanilla JS |
| 抽卡与阅读 | 静态页面 + JSON/Markdown 数据 |
| 检索 | `retrieval.js` 客户端 skill 选择与原文片段排序 |
| AI 代理 | Vercel Serverless Function：`api/chat.js` |
| 模型服务 | OpenRouter / DeepSeek |
| 部署 | Vercel |

## Vercel 部署

1. Fork 本仓库到 GitHub。
2. 在 Vercel 中导入仓库。
3. 在 Environment Variables 中添加 `OPENROUTER_API_KEY`。
4. 部署后访问站点，`/api/chat` 会使用服务端环境变量代理 OpenRouter。

## 本地运行

```bash
python3 -m http.server 8080
```

本地静态服务器可以验证首页、阅读页、skill 选择和原文检索。`/api/chat` 需要 Vercel Serverless 环境或自行配置兼容的本地 API 代理。

## 项目结构

```text
redwisdom/
├── index.html                    # 首页：智慧卡片抽取
├── chat.html                     # 问道毛选：Skill-first 咨询页
├── reading.html                  # 阅读毛选：目录与文章阅读
├── script.js                     # 首页抽卡与行动入口逻辑
├── retrieval.js                  # skill 选择、原文检索排序、阅读链接生成
├── api/
│   └── chat.js                   # Vercel Serverless Function，代理 OpenRouter
├── data.js                       # 首页语录数据注入
├── data/
│   ├── quotes.json               # 181 条精选语录
│   ├── mao-skills.json           # 毛选方法论 skills
│   ├── catalog.json              # 5 卷 229 条目录记录
│   ├── search-index.json         # 2119 个原文检索 chunks
│   └── articles/                 # 毛选文章 Markdown
├── scripts/
│   ├── validate-mao-skills.mjs   # skill 数据校验
│   ├── verify-search-index.mjs   # 检索索引校验
│   ├── smoke-retrieval.mjs       # 检索逻辑 smoke test
│   └── smoke-api-prompt.mjs      # API prompt 构造 smoke test
├── assets/                       # 头像、卡面、favicon、OG 图等资源
├── style.css                     # 全局视觉样式
├── vercel.json                   # Vercel 配置
└── CNAME                         # 自定义域名配置
```

## 校验脚本

```bash
node scripts/validate-mao-skills.mjs
node scripts/verify-search-index.mjs
node scripts/smoke-retrieval.mjs
node scripts/smoke-api-prompt.mjs
```

这些脚本用于确认方法论 skill 数据、原文索引、检索排序和 `/api/chat` 的 prompt 组装仍然符合当前 MVP。

## 当前版本

### MaoXuan BibleChat MVP
- 首页保留红色智慧卡片的仪式感抽取。
- 咨询页采用「先选方法论 skill，再检索原文，再调用模型」的回答链路。
- 阅读页提供五卷目录、文章阅读和从引用卡片回到原文的入口。
- 服务端 API 由 Vercel Serverless Function 读取 `OPENROUTER_API_KEY` 并代理 OpenRouter。

---

*Powered by Vercel, OpenRouter & Mao Selected Works.*
