// 客户端非敏感配置。
// 不要在浏览器端填写 API Key；OPENROUTER_API_KEY 应放在 Vercel 环境变量或本地 .env.local。
const CONFIG = {
    // Vercel Serverless Function API 路由
    WORKER_URL: '/api/chat',

    // 仅保留兼容字段；不要在客户端使用或填写密钥
    OPENROUTER_API_KEY: ''
};
