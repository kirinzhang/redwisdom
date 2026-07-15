const CONFIG = {
    // 本地开发服务器和 Vercel 均提供同源 API 路由。
    WORKER_URL: '/api/chat',

    // 生产环境不需要填写，从 Cloudflare 环境变量读取
    OPENROUTER_API_KEY: '',

    // 使用的模型
    MODEL: 'deepseek-v4-pro',

    // OpenRouter API 地址
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',

    // Supabase 账户系统配置。未填写时网站保持本机私密模式。
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    SUPABASE_GOOGLE_AUTH_ENABLED: false,

    // 部署平台也可在 config.js 之前注入 window.REDWISDOM_CONFIG 覆盖公开运行时配置。
    ...(globalThis.REDWISDOM_CONFIG || {})
};

globalThis.REDWISDOM_CONFIG_READY = loadPublicRuntimeConfig();

async function loadPublicRuntimeConfig() {
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) return CONFIG;
    if (!/^https?:$/.test(globalThis.location?.protocol || '')) return CONFIG;

    try {
        const response = await fetch('/api/public-config', {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) return CONFIG;
        const runtimeConfig = await response.json();
        CONFIG.SUPABASE_URL = String(runtimeConfig.SUPABASE_URL || '').trim();
        CONFIG.SUPABASE_ANON_KEY = String(runtimeConfig.SUPABASE_ANON_KEY || '').trim();
        CONFIG.SUPABASE_GOOGLE_AUTH_ENABLED = runtimeConfig.SUPABASE_GOOGLE_AUTH_ENABLED === true;
    } catch (error) {
        console.warn('无法加载账户运行时配置，将继续使用本机私密模式。');
    }
    return CONFIG;
}
