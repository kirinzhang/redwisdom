// 问道接口的来源校验：只接受本站页面发起的浏览器请求。
// 没有 Origin 头的请求（例如服务器间调用）交给限流处理。
// CHAT_ALLOWED_ORIGINS 可额外放行其他域名（逗号分隔），例如预览地址。
export function isAllowedOriginHost(origin, requestHost, env = {}) {
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
    if (requestHost) allowed.add(String(requestHost).split(',')[0].trim());
    return allowed.has(originHost);
}
