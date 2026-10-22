// Cloudflare Worker 入口：静态页面由 Workers 静态资源直接提供，只有 /api/* 进入这里。
// 与 Vercel 函数（api/chat.js、api/public-config.js）行为一致：
//   GET  /api/chat           健康检查
//   POST /api/chat           问道（服务端组装提示词与检索，流式转发模型回答）
//   GET  /api/public-config  浏览器端需要的 Supabase 公开配置

import { CONTEXT_DATA_FILES, buildContextSources, buildServerMessages } from '../api/chat-context-core.mjs';
import { buildProviderHeaders, resolveChatProvider } from '../api/chat-provider.mjs';
import { buildProviderRequest, sanitizeChatRequest } from '../api/openrouter-guard.mjs';
import { createRateLimiter, rateLimitMessage } from '../api/rate-limit.mjs';
import { isAllowedOriginHost } from '../api/origin.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const encoder = new TextEncoder();

function json(status, payload, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

// 检索数据从同一个 Worker 的静态资源读取，并缓存在实例内存中（首个请求解析一次）。
let sourcesPromise = null;
function loadSources(env, requestUrl) {
    if (!sourcesPromise) {
        const entries = Object.entries(CONTEXT_DATA_FILES);
        sourcesPromise = Promise.all(entries.map(async ([key, file]) => {
            const response = await env.ASSETS.fetch(new Request(new URL(`/${file}`, requestUrl)));
            if (!response.ok) throw new Error(`${file}: ${response.status}`);
            return [key, await response.json()];
        })).then((pairs) => buildContextSources(Object.fromEntries(pairs)));
        sourcesPromise.catch(() => { sourcesPromise = null; });
    }
    return sourcesPromise;
}

let limiter = null;
let limiterEnv = null;
function getLimiter(env) {
    if (!limiter || limiterEnv !== env) {
        limiter = createRateLimiter(env);
        limiterEnv = env;
    }
    return limiter;
}

function clientIp(request) {
    return request.headers.get('cf-connecting-ip')
        || String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
        || 'unknown';
}

async function readProviderError(response) {
    try {
        const payload = await response.json();
        if (typeof payload?.error === 'string') return payload.error;
        if (payload?.error?.message) return payload.error.message;
        if (payload?.message) return payload.message;
    } catch (error) {
        // 按状态码给出通用提示
    }
    return `模型服务返回错误 ${response.status}`;
}

export async function handleChat(request, env, deps = {}) {
    const provider = resolveChatProvider(env);
    const fetchImpl = deps.fetchImpl || fetch;

    if (request.method === 'GET') {
        return json(200, { status: 'ok', message: 'Chat API 正常工作', hasApiKey: !!provider });
    }
    if (request.method !== 'POST') {
        return json(405, { error: '仅支持 POST 请求' }, { Allow: 'GET, POST' });
    }
    if (!isAllowedOriginHost(request.headers.get('origin'), new URL(request.url).host, env)) {
        return json(403, { error: '不允许从其他网站调用问道接口' });
    }
    if (!provider) {
        return json(500, { error: '服务器未配置 API Key，请设置 DEEPSEEK_API_KEY（推荐）或 OPENROUTER_API_KEY' });
    }

    let input;
    try {
        input = sanitizeChatRequest(await request.json());
    } catch (error) {
        return json(error.statusCode || 400, { error: error.statusCode ? error.message : '请求体无效' });
    }

    const rate = await (deps.limiter || getLimiter(env)).check(clientIp(request));
    if (!rate.ok) {
        return json(429, { error: rateLimitMessage(rate.reason) }, { 'Retry-After': String(rate.retryAfter) });
    }

    let upstream;
    let retrieval;
    try {
        const sources = deps.sources || await loadSources(env, request.url);
        const built = buildServerMessages(input, sources);
        retrieval = built.retrieval;
        upstream = await fetchImpl(provider.endpoint, {
            method: 'POST',
            headers: buildProviderHeaders(provider),
            body: JSON.stringify(buildProviderRequest(provider.name, built.messages, input.maxTokens)),
            signal: request.signal,
        });
    } catch (error) {
        return json(error.statusCode || 500, { error: error.message });
    }
    if (!upstream.ok) {
        return json(upstream.status, { error: await readProviderError(upstream) });
    }

    // 第一条事件告诉前端本次检索到的党史案例，随后原样转发模型的 SSE 流。
    // 访客中止或关闭页面时，流被取消，同时取消对模型服务的读取，避免继续计费。
    const first = `data: ${JSON.stringify({ redwisdom: { historyMirror: retrieval.historyMirror, classificationLabel: retrieval.classificationLabel } })}\n\n`;
    const reader = upstream.body.getReader();
    const body = new ReadableStream({
        start(controller) { controller.enqueue(encoder.encode(first)); },
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                if (done) controller.close();
                else controller.enqueue(value);
            } catch (error) {
                controller.error(error);
            }
        },
        cancel(reason) { return reader.cancel(reason); },
    });
    return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Redwisdom-Provider': provider.name },
    });
}

export function handlePublicConfig(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS' } });
    if (request.method !== 'GET') return json(405, { error: '仅支持 GET 请求' }, { Allow: 'GET, OPTIONS' });
    const supabaseUrl = String(env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || '').trim();
    return json(200, {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_ANON_KEY: supabaseAnonKey,
        SUPABASE_GOOGLE_AUTH_ENABLED: String(env.SUPABASE_GOOGLE_AUTH_ENABLED || '').toLowerCase() === 'true',
        authConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    }, { 'Cache-Control': 'no-store' });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/api/chat') return handleChat(request, env);
        if (url.pathname === '/api/public-config') return handlePublicConfig(request, env);
        if (url.pathname.startsWith('/api/')) return json(404, { error: '接口不存在' });
        return env.ASSETS.fetch(request);
    },
};
