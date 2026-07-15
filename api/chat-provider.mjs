export const DEEPSEEK_V4_MODEL = 'deepseek-v4-pro';
export const OPENROUTER_V4_MODEL = 'deepseek/deepseek-v4-pro';

export function resolveChatProvider(env = {}) {
    const deepseekKey = String(env.DEEPSEEK_API_KEY || '').trim();
    if (deepseekKey) {
        return {
            name: 'deepseek',
            model: DEEPSEEK_V4_MODEL,
            endpoint: 'https://api.deepseek.com/chat/completions',
            apiKey: deepseekKey,
        };
    }

    const openRouterKey = String(env.OPENROUTER_API_KEY || '').trim();
    if (openRouterKey) {
        return {
            name: 'openrouter',
            model: OPENROUTER_V4_MODEL,
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            apiKey: openRouterKey,
        };
    }

    return null;
}

export function buildProviderHeaders(provider) {
    const headers = {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
    };
    if (provider.name === 'openrouter') {
        headers['HTTP-Referer'] = 'https://redwisdom.xyz';
        headers['X-Title'] = 'Red Wisdom Chat';
    }
    return headers;
}
