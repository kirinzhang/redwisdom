const ALLOWED_MODELS = new Set([
    'deepseek-v4-pro',
    'deepseek/deepseek-v4-pro',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-chat-v3-0324',
]);

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MESSAGES = 12;
const MAX_CONTENT_LENGTH = 6000;
const MAX_OUTPUT_TOKENS = 4096;

export function sanitizeChatRequest(body, provider = 'deepseek') {
    if (!body || typeof body !== 'object') {
        throw validationError('请求体无效');
    }

    if (!ALLOWED_MODELS.has(body.model)) {
        throw validationError('不支持的模型');
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        throw validationError('messages 不能为空');
    }

    const normalizedMessages = body.messages
        .filter((message) => message && ALLOWED_ROLES.has(message.role))
        .map((message) => ({
            role: message.role,
            content: String(message.content || '').slice(0, MAX_CONTENT_LENGTH),
        }))
        .filter((message) => message.content.trim().length > 0);

    const systemMessages = normalizedMessages
        .filter((message) => message.role === 'system')
        .slice(0, 4);
    const dialogueMessages = normalizedMessages
        .filter((message) => message.role !== 'system')
        .slice(-(MAX_MESSAGES - systemMessages.length));
    const messages = [...systemMessages, ...dialogueMessages];

    if (messages.length === 0) {
        throw validationError('messages 不能为空');
    }

    const request = {
        model: provider === 'openrouter' ? 'deepseek/deepseek-v4-pro' : 'deepseek-v4-pro',
        messages,
        stream: body.stream !== false,
        max_tokens: clampNumber(body.max_tokens, 512, MAX_OUTPUT_TOKENS, 2400),
    };

    if (provider === 'deepseek') {
        request.thinking = { type: 'enabled' };
        request.reasoning_effort = 'high';
    } else {
        request.temperature = clampNumber(body.temperature, 0.2, 0.9, 0.7);
        request.reasoning = { effort: 'high' };
    }

    return request;
}

export function sanitizeOpenRouterRequest(body) {
    return sanitizeChatRequest(body, 'openrouter');
}

function clampNumber(value, min, max, fallback) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, value));
}

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}
