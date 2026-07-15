import { buildProviderHeaders, resolveChatProvider } from './chat-provider.mjs';
import { sanitizeChatRequest } from './openrouter-guard.mjs';

export async function handleChatRequest(req, res, env = process.env) {
    const provider = resolveChatProvider(env);
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({
            status: 'ok',
            message: 'Chat API 正常工作',
            hasApiKey: !!provider,
            provider: provider?.name || null,
            model: provider?.model || null,
        });
    }

    if (req.method !== 'POST') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    if (!provider) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({
            error: '服务器未配置 API Key，请设置 DEEPSEEK_API_KEY（推荐）或 OPENROUTER_API_KEY',
        });
    }

    try {
        const requestBody = sanitizeChatRequest(req.body, provider.name);
        const response = await fetch(provider.endpoint, {
            method: 'POST',
            headers: buildProviderHeaders(provider),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const message = await readProviderError(response);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(response.status).json({ error: message });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Redwisdom-Provider', provider.name);
        res.setHeader('X-Redwisdom-Model', provider.model);

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
}

async function readProviderError(response) {
    try {
        const payload = await response.json();
        if (typeof payload?.error === 'string') return payload.error;
        if (payload?.error?.message) return payload.error.message;
        if (payload?.message) return payload.message;
    } catch (error) {
        // Fall through to the status-based message.
    }
    return `模型服务返回错误 ${response.status}`;
}
