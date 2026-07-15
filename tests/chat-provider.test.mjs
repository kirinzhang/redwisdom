import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildProviderHeaders,
    resolveChatProvider,
} from '../api/chat-provider.mjs';

test('DeepSeek key selects direct V4 Pro before the OpenRouter fallback', () => {
    const provider = resolveChatProvider({
        DEEPSEEK_API_KEY: 'ds-secret',
        OPENROUTER_API_KEY: 'or-secret',
    });
    assert.equal(provider.name, 'deepseek');
    assert.equal(provider.model, 'deepseek-v4-pro');
    assert.equal(provider.endpoint, 'https://api.deepseek.com/chat/completions');
    assert.equal(buildProviderHeaders(provider).Authorization, 'Bearer ds-secret');
});

test('OpenRouter remains a V4 Pro fallback when no DeepSeek key exists', () => {
    const provider = resolveChatProvider({ OPENROUTER_API_KEY: 'or-secret' });
    assert.equal(provider.name, 'openrouter');
    assert.equal(provider.model, 'deepseek/deepseek-v4-pro');
});

test('provider resolution returns null without a server-side key', () => {
    assert.equal(resolveChatProvider({}), null);
});
