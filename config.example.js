// API 配置文件
// 请复制此文件并重命名为 config.js，然后填入你的配置
const CONFIG = {
    // Cloudflare Worker 代理地址
    // 部署 Worker 后填入，格式: https://redwisdom-api.你的账号.workers.dev
    WORKER_URL: '',

    // 如果不使用 Worker，可以直接填入 OpenRouter API Key（不推荐，会暴露 Key）
    OPENROUTER_API_KEY: '',

    // 使用的模型
    MODEL: 'deepseek/deepseek-chat',

    // OpenRouter API 地址（使用 Worker 时不需要）
    API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};
