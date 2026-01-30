// API 配置文件
// 请复制此文件并重命名为 config.js

const CONFIG = {
    // Pages Functions API 路由（部署到 Cloudflare Pages 后使用）
    // 留空会自动使用相对路径 /api/chat
    WORKER_URL: '/api/chat',

    // 本地开发时使用的 OpenRouter API Key
    // 部署到 Cloudflare Pages 后，API Key 从环境变量读取，此项可留空
    OPENROUTER_API_KEY: '',

    // 使用的模型
    MODEL: 'deepseek/deepseek-chat',

    // OpenRouter API 地址（本地开发时使用）
    API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};
