// API 配置文件（生产环境）
// API Key 从 Cloudflare 环境变量读取，此处留空
const CONFIG = {
    // Pages Functions API 路由
    WORKER_URL: '/api/chat',

    // 生产环境不需要填写，从 Cloudflare 环境变量读取
    OPENROUTER_API_KEY: '',

    // 使用的模型
    MODEL: 'deepseek/deepseek-chat',

    // OpenRouter API 地址
    API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};
