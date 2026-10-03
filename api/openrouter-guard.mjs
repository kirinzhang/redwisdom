// 问道接口的请求守卫：只接受对话内容，系统提示词一律由服务端生成。

const ALLOWED_ROLES = new Set(['user', 'assistant']);
const ALLOWED_MODES = new Set(['direct', 'guided']);
const ALLOWED_LOCALES = new Set(['zh-CN', 'en']);
export const MAX_MESSAGES = 12;
export const MAX_CONTENT_LENGTH = 6000;
export const MAX_TOTAL_LENGTH = 30000;
export const MAX_OUTPUT_TOKENS = 4096;
const OUTPUT_TOKENS_BY_MODE = { direct: 2400, guided: 3600 };

// 返回服务端可信的请求描述：{ mode, locale, dialogue, maxTokens }
export function sanitizeChatRequest(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw validationError('请求体无效');
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        throw validationError('messages 不能为空');
    }

    const mode = ALLOWED_MODES.has(body.mode) ? body.mode : 'direct';
    const locale = ALLOWED_LOCALES.has(body.locale) ? body.locale : 'zh-CN';

    // 系统消息和未知角色直接丢弃：浏览器不能改写教练的系统提示词。
    let dialogue = body.messages
        .filter((message) => message && ALLOWED_ROLES.has(message.role))
        .map((message) => ({
            role: message.role,
            content: String(message.content || '').slice(0, MAX_CONTENT_LENGTH),
        }))
        .filter((message) => message.content.trim().length > 0)
        .slice(-MAX_MESSAGES);

    while (dialogue.length > 1 && dialogue.reduce((sum, message) => sum + message.content.length, 0) > MAX_TOTAL_LENGTH) {
        dialogue = dialogue.slice(1);
    }
    while (dialogue.length && dialogue[0].role !== 'user') dialogue = dialogue.slice(1);

    if (dialogue.length === 0 || dialogue[dialogue.length - 1].role !== 'user') {
        throw validationError('最后一条消息必须是用户提问');
    }

    return { mode, locale, dialogue, maxTokens: OUTPUT_TOKENS_BY_MODE[mode] };
}

// 根据服务商生成最终发往模型的请求体。
export function buildProviderRequest(provider, messages, maxTokens) {
    const request = {
        model: provider === 'openrouter' ? 'deepseek/deepseek-v4-pro' : 'deepseek-v4-pro',
        messages,
        stream: true,
        max_tokens: Math.min(MAX_OUTPUT_TOKENS, maxTokens || OUTPUT_TOKENS_BY_MODE.direct),
    };
    if (provider === 'deepseek') {
        request.thinking = { type: 'enabled' };
        request.reasoning_effort = 'high';
    } else {
        request.temperature = 0.7;
        request.reasoning = { effort: 'high' };
    }
    return request;
}

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}
