import assert from 'node:assert/strict';
import test from 'node:test';

import {
    sanitizeChatRequest,
    sanitizeOpenRouterRequest,
} from '../api/openrouter-guard.mjs';

test('sanitizeOpenRouterRequest keeps allowed model and trims long conversation history', () => {
    const body = sanitizeOpenRouterRequest({
        model: 'deepseek-v4-pro',
        messages: Array.from({ length: 20 }, (_, index) => ({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `message-${index}`,
        })),
        stream: true,
        temperature: 1.4,
        max_tokens: 2000,
    });

    assert.equal(body.model, 'deepseek/deepseek-v4-pro');
    assert.equal(body.messages.length, 12);
    assert.equal(body.messages[0].content, 'message-8');
    assert.equal(body.temperature, 0.9);
    assert.equal(body.max_tokens, 2000);
    assert.equal(body.stream, true);
    assert.deepEqual(body.reasoning, { effort: 'high' });
});

test('sanitizeOpenRouterRequest preserves system context when dialogue is long', () => {
    const body = sanitizeOpenRouterRequest({
        model: 'deepseek-v4-pro',
        messages: [
            { role: 'system', content: 'method contract' },
            { role: 'system', content: 'history cases' },
            ...Array.from({ length: 20 }, (_, index) => ({
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `dialogue-${index}`,
            })),
        ],
        max_tokens: 9000,
    });

    assert.equal(body.messages.length, 12);
    assert.equal(body.messages[0].content, 'method contract');
    assert.equal(body.messages[1].content, 'history cases');
    assert.equal(body.messages[2].content, 'dialogue-10');
    assert.equal(body.max_tokens, 4096);
});

test('sanitizeChatRequest configures direct DeepSeek V4 Pro thinking mode', () => {
    const body = sanitizeChatRequest({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
    }, 'deepseek');

    assert.equal(body.model, 'deepseek-v4-pro');
    assert.deepEqual(body.thinking, { type: 'enabled' });
    assert.equal(body.reasoning_effort, 'high');
    assert.equal(body.temperature, undefined);
});

test('sanitizeOpenRouterRequest rejects non-whitelisted models', () => {
    assert.throws(
        () => sanitizeOpenRouterRequest({
            model: 'openai/gpt-5',
            messages: [{ role: 'user', content: 'hello' }],
        }),
        /不支持的模型/
    );
});

test('sanitizeOpenRouterRequest rejects empty messages', () => {
    assert.throws(
        () => sanitizeOpenRouterRequest({
            model: 'deepseek-v4-pro',
            messages: [],
        }),
        /messages 不能为空/
    );
});
