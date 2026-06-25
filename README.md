# Red Wisdom Cards (红色智慧卡片)

**Don't worry, be fighting.**
遇事不决读毛选，治愈你 90% 的焦虑。

本项目是一个基于 Web 的互动应用，通过随机抽取毛泽东语录和 AI 智能对话，为用户提供精神力量和战略思维。

🌐 **在线访问**: [redwisdom.pages.dev](https://redwisdom.pages.dev)

## ✨ 核心功能 (Features)

### 1. 🎴 智慧卡片 - 随机抽取语录
- **仪式感交互**: 抽卡 → 翻牌 → 揭晓，沉浸式体验
- **精美卡面**: 红底卡背配宣纸质感正面，配有毛主席素描画像
- **一键保存**: 支持将抽到的语录保存为精美图片分享

### 2. 💬 问道毛选 - AI 智能对话
- **毛主席思维方式**: 辩证法、实践论、群众路线、调查研究
- **毛主席说话风格**: 通俗比喻、短句有力、善用反问
- **引经据典**: 每次回答都引用毛选原文并标注出处
- **基于 DeepSeek 模型**: 通过 OpenRouter API 调用

### 3. 📚 阅读毛选 - 全文在线阅读
- 毛泽东选集全 5 卷 228 篇
- 包含《矛盾论》《实践论》《论持久战》等经典著作
- 左侧目录导航，支持按卷展开
- 上下篇文章快速切换

## 🛠 技术栈 (Tech Stack)

| 类型 | 技术 |
|------|------|
| 前端框架 | HTML5 + Tailwind CSS + Vanilla JS |
| AI 对话 | OpenRouter API (DeepSeek) |
| 后端代理 | Cloudflare Pages Functions |
| 部署平台 | Cloudflare Pages |
| 数据格式 | JSON + Markdown |

## 🚀 部署指南 (Deployment)

### 方式一：Cloudflare Pages（推荐）

1. Fork 本仓库到你的 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
3. 创建 Pages 项目，连接你的 GitHub 仓库
4. 在 **Settings → Environment variables** 中添加：
   - `OPENROUTER_API_KEY`: 你的 OpenRouter API Key
5. 部署完成后即可访问

### 方式二：本地运行

```bash
# 克隆项目
git clone https://github.com/kirinzhang/redwisdom.git
cd redwisdom

# 创建配置文件
cp config.example.js config.js
# 编辑 config.js，填入你的 API Key

# 启动本地服务器
python3 -m http.server 8080
# 访问 http://localhost:8080
```

## 📁 项目结构

```
redwisdom/
├── index.html          # 首页 - 智慧卡片
├── chat.html           # AI 对话页面
├── reading.html        # 毛选阅读页面
├── config.js           # API 配置（不上传）
├── script.js           # 卡片交互逻辑
├── style.css           # 自定义样式
├── data.js             # 语录数据
├── data/
│   ├── quotes.json     # 181条精选语录
│   ├── catalog.json    # 文章目录
│   └── articles/       # 231篇毛选文章 (Markdown)
├── assets/             # 图片资源
└── functions/
    └── api/
        └── chat.js     # Cloudflare Pages Function (API 代理)
```

## 📝 更新日志 (Change Log)

### V2.0 - AI 对话功能
- **[新增] 问道毛选**: 基于毛选的 AI 智能对话，模拟毛主席思维和说话风格
- **[新增] Cloudflare 部署**: 支持 Pages Functions 作为 API 代理
- **[新增] SEO 优化**: 添加完整的 meta 标签和 Open Graph 支持
- **[优化] 项目结构**: 清理重复文件，规范目录组织

### V1.1 - 仪式感与细节优化
- **[优化] 交互流程重构**: "抽一张 → 翻牌 → 再抽一次"的线性流程
- **[优化] 字体调整**: 英文标题采用 Cinzel 字体提升庄重感
- **[修复] 本地运行支持**: 通过内联数据方案解决 CORS 问题

### V1.0 - 基础版本
- 核心随机抽卡逻辑
- CSS 3D 翻牌效果
- 基础 UI 设计
- html2canvas 卡片截图保存

---

*Powered by Cloudflare Pages & OpenRouter*
