// 问道接口限流：按访问者 IP 计每分钟、每天的次数，可选全站每日总量上限。
// 配置了 Upstash Redis（UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）时跨实例共享计数；
// 未配置时退回单个函数实例内的内存计数，只能挡住连续刷接口，不能替代持久存储。

const memoryStore = new Map();

function toInt(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getClientIp(req) {
    const headers = req.headers || {};
    const forwarded = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || String(headers['x-real-ip'] || '').trim() || req.socket?.remoteAddress || 'unknown';
}

export function readLimits(env = {}) {
    return {
        perMinute: toInt(env.CHAT_LIMIT_PER_MINUTE, 6),
        perDay: toInt(env.CHAT_LIMIT_PER_DAY, 60),
        globalPerDay: toInt(env.CHAT_GLOBAL_LIMIT_PER_DAY, 0),
    };
}

function memoryHit(key, ttlSeconds, nowMs) {
    if (memoryStore.size > 5000) {
        for (const [k, entry] of memoryStore) if (entry.expires <= nowMs) memoryStore.delete(k);
    }
    const entry = memoryStore.get(key);
    if (!entry || entry.expires <= nowMs) {
        memoryStore.set(key, { count: 1, expires: nowMs + ttlSeconds * 1000 });
        return 1;
    }
    entry.count += 1;
    return entry.count;
}

async function upstashHit(env, fetchImpl, key, ttlSeconds) {
    const response = await fetchImpl(`${env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(ttlSeconds), 'NX']]),
    });
    if (!response.ok) throw new Error(`Upstash ${response.status}`);
    const payload = await response.json();
    return Number(payload?.[0]?.result) || 0;
}

export function createRateLimiter(env = {}, { now = () => Date.now(), fetchImpl = globalThis.fetch } = {}) {
    const limits = readLimits(env);
    const useUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

    async function hit(key, ttlSeconds, nowMs) {
        if (useUpstash) return upstashHit(env, fetchImpl, key, ttlSeconds);
        return memoryHit(key, ttlSeconds, nowMs);
    }

    async function check(ip) {
        const nowMs = now();
        const minuteSlot = Math.floor(nowMs / 60000);
        const day = new Date(nowMs).toISOString().slice(0, 10);
        const secondsToMidnight = Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86400000 - nowMs) / 1000);
        try {
            if (limits.perMinute) {
                const count = await hit(`rw:chat:m:${ip}:${minuteSlot}`, 70, nowMs);
                if (count > limits.perMinute) return { ok: false, reason: 'minute', retryAfter: 60 - Math.floor((nowMs % 60000) / 1000) };
            }
            if (limits.perDay) {
                const count = await hit(`rw:chat:d:${ip}:${day}`, 90000, nowMs);
                if (count > limits.perDay) return { ok: false, reason: 'day', retryAfter: secondsToMidnight };
            }
            if (limits.globalPerDay) {
                const count = await hit(`rw:chat:g:${day}`, 90000, nowMs);
                if (count > limits.globalPerDay) return { ok: false, reason: 'global', retryAfter: secondsToMidnight };
            }
        } catch (error) {
            // 计数服务故障时放行，避免限流组件拖垮问道；故障会记录在函数日志里。
            console.error('rate limit store unavailable:', error.message);
        }
        return { ok: true };
    }

    return { check, limits, store: useUpstash ? 'upstash' : 'memory' };
}

export function rateLimitMessage(reason) {
    if (reason === 'minute') return '提问太频繁了，请一分钟后再试。';
    if (reason === 'day') return '今天的提问次数已经用完，明天再来。先把今天的行动做起来，再带着结果来复盘。';
    return '今天问道的人太多，额度已经用完，请明天再试。';
}

export function resetMemoryRateLimits() {
    memoryStore.clear();
}
