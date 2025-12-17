# Red Wisdom Cards (红色智慧卡片)

**Don't worry, be fighting.**
遇事不决读毛选，治愈你 90% 的焦虑。

本项目是一个基于 Web 的互动应用，旨在通过随机抽取的毛泽东语录，为用户提供精神力量和战略思维，缓解当下的焦虑情绪。

## ✨ 核心功能 (Features)

1.  **仪式感交互流程 (Ritual Interaction)**:
    -   **初始状态**: 仅展示庄重的标题和“抽一张”按钮，引导用户专注当下。
    -   **沉浸式发牌**: 点击后，一张红色的卡片发至屏幕中央。
    -   **惊喜揭晓**: 点击卡片，通过流畅的 3D 翻转动画展示语录。
    -   **无限重试**: 阅读完毕后，可点击“再抽一次”重新开始。

2.  **视觉美学 (Aesthetics)**:
    -   **复古质感**: 采用“中国红”纹理卡背与“暖米色宣纸”卡面。
    -   **庄重排版**: 英文标题采用 **Cinzel** 字体，突显肃穆感；中文采用书法与宋体结合。
    -   **素描画像**: 极简风格的毛主席画像。

3.  **实用工具**:
    -   **保存卡片**: 支持将当前抽到的语录生成为精美图片，保存到本地用于分享。

4.  **离线运行**:
    -   无需后端服务器，双击 `index.html` 即可直接运行（解决了本地跨域限制）。

## 🛠 技术栈 (Tech Stack)

-   **Structure**: HTML5
-   **Style**: Tailwind CSS (CDN) + Custom CSS (3D Transforms)
-   **Logic**: Vanilla JavaScript
-   **Data**: JSON-based quote database (embedded via `data.js`)
-   **Assets**: SVG Icons & Texture Images

## 🚀 如何运行 (How to Run)

1.  克隆或下载本项目到本地。
2.  直接双击打开文件夹中的 `index.html` 文件即可体验。
3.  无需安装 Node.js 或启动任何 Web 服务器。

## 📝 更新日志 (Change Log)

### V1.1 - 仪式感与细节优化
-   **[优化] 交互流程重构**: 即使改为“抽一张 -> 翻牌 -> 再抽一次”的线性流程，增强互动的仪式感。
-   **[优化] 字体调整**: 将首页英文标题 `Don't worry, be fighting` 的字体更换为 `Cinzel`，提升庄重感。
-   **[修复] 本地运行支持**: 通过内联数据方案（`data.js`），解决了浏览器本地文件访问的 CORS 跨域问题。

### V1.0 - 基础版本
-   完成核心随机抽卡逻辑。
-   实现 CSS 3D 翻牌效果。
-   完成基础 UI 设计（红底卡背、宣纸卡面）。
-   集成 `html2canvas` 实现卡片截图保存功能。

---
*Created by Antigravity*
