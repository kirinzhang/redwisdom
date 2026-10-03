import { buildProviderHeaders, resolveChatProvider } from './chat-provider.mjs';
import { buildProviderRequest, sanitizeChatRequest } from './openrouter-guard.mjs';
import { createRateLimiter, getClientIp, rateLimitMessage } from './rate-limit.mjs';

let limiter = null;
let limiterEnv = null;

function getLimiter(env) {
    if (!limiter || limiterEnv !== env) {
        limiter = createRateLimiter(env);
        limiterEnv = env;
    }
    return limiter;
}

// 只接受本站页面发起的浏览器请求。没有 Origin 头的请求（例如服务器间调用）交给限流处理。
export function isAllowedOrigin(req, env = {}) {
    const origin = req.headers?.origin;
    if (!origin) return true;
    let originHost;
    try {
        originHost = new URL(origin).host;
    } catch (error) {
        return false;
    }
    const allowed = new Set(String(env.CHAT_ALLOWED_ORIGINS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => { try { return new URL(item).host; } catch (error) { return item; } }));
    const requestHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
    if (requestHost) allowed.add(String(requestHost).split(',')[0].trim());
    return allowed.has(originHost);
}

function sendJson(res, status, payload, extraHeaders = {}) {
    res.setHeader('Content-Type', 'application/json');
    for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
    return res.status(status).json(payload);
}

export async function handleChatRequest(req, res, env = process.env, deps = {}) {
    const provider = resolveChatProvider(env);
    const fetchImpl = deps.fetchImpl || globalThis.fetch;
    const buildMessages = deps.buildMessages || (async (input) => (await import('./chat-context.mjs')).buildServerMessages(input));

    if (req.method === 'GET') {
        return sendJson(res, 200, { status: 'ok', message: 'Chat API 正常工作', hasApiKey: !!provider });
    }
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: '仅支持 POST 请求' }, { Allow: 'GET, POST' });
    }
    if (!isAllowedOrigin(req, env)) {
        return sendJson(res, 403, { error: '不允许从其他网站调用问道接口' });
    }
    if (!provider) {
        return sendJson(res, 500, { error: '服务器未配置 API Key，请设置 DEEPSEEK_API_KEY（推荐）或 OPENROUTER_API_KEY' });
    }

    let input;
    try {
        input = sanitizeChatRequest(req.body);
    } catch (error) {
        return sendJson(res, error.statusCode || 400, { error: error.message });
    }

    const rate = await (deps.limiter || getLimiter(env)).check(getClientIp(req));
    if (!rate.ok) {
        return sendJson(res, 429, { error: rateLimitMessage(rate.reason) }, { 'Retry-After': String(rate.retryAfter) });
    }

    // 用户中止或关闭页面时，同步中止对模型服务的请求，避免继续计费。
    const upstream = new AbortController();
    const abortUpstream = () => upstream.abort();
    req.on?.('aborted', abortUpstream);
    res.on?.('close', () => { if (!res.writableEnded) abortUpstream(); });

    try {
        const { messages, retrieval } = await buildMessages(input);
        const response = await fetchImpl(provider.endpoint, {
            method: 'POST',
            headers: buildProviderHeaders(provider),
            body: JSON.stringify(buildProviderRequest(provider.name, messages, input.maxTokens)),
            signal: upstream.signal,
        });

        if (!response.ok) {
            return sendJson(res, response.status, { error: await readProviderError(response) });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Redwisdom-Provider', provider.name);
        // 第一条事件告诉前端本次检索到的党史案例，用于展示“党史镜鉴”。
        res.write(`data: ${JSON.stringify({ redwisdom: { historyMirror: retrieval.historyMirror, classificationLabel: retrieval.classificationLabel } })}\n\n`);

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
    } catch (error) {
        if (upstream.signal.aborted) {
            if (!res.writableEnded) res.end();
            return undefined;
        }
        if (res.headersSent) {
            res.end();
            return undefined;
        }
        return sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return undefined;
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
