const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildChatPayload,
    createPracticeCoachSystemPrompt,
} = require('../js/ai-methodology.js');

test('system prompt positions the assistant as a Mao-selected-works practice coach', () => {
    const prompt = createPracticeCoachSystemPrompt();

    assert.match(prompt, /毛选方法论蒸馏/);
    assert.match(prompt, /实践教练/);
    assert.match(prompt, /不要把语录当作神秘答案/);
    assert.match(prompt, /事实、调查、矛盾分析、行动和复盘/);
    assert.match(prompt, /相似条件、关键差异和可迁移方法/);
});

test('buildChatPayload forces method-guided answers and preserves conversation history', () => {
    const payload = buildChatPayload({
        model: 'deepseek-v4-pro',
        contextMessage: {
            role: 'system',
            content: '可参考的毛选上下文：\n- 《反对本本主义》：没有调查，没有发言权。',
        },
        localeMessage: {
            role: 'system',
            content: 'Answer in English. Keep Chinese article titles unchanged.',
        },
        conversationHistory: [
            {
                role: 'user',
                content: '我工作遇到阻力，不知道怎么办。',
            },
        ],
    });

    assert.equal(payload.model, 'deepseek-v4-pro');
    assert.equal(payload.stream, true);
    assert.equal(payload.temperature, 0.7);
    assert.equal(payload.max_tokens, 2400);
    assert.equal(payload.messages[0].role, 'system');
    assert.match(payload.messages[0].content, /直接解惑/);
    assert.match(payload.messages[0].content, /可执行步骤/);
    assert.equal(payload.messages[1].role, 'system');
    assert.match(payload.messages[1].content, /反对本本主义/);
    assert.equal(payload.messages[2].role, 'system');
    assert.match(payload.messages[2].content, /Answer in English/);
    assert.deepEqual(payload.messages[3], {
        role: 'user',
        content: '我工作遇到阻力，不知道怎么办。',
    });
});

test('guided mode tells the model to synthesize completed intake without repeating questions', () => {
    const payload = buildChatPayload({
        model: 'deepseek-v4-pro',
        mode: 'guided',
        conversationHistory: [{ role: 'user', content: '现实问题：项目延期' }],
    });
    assert.match(payload.messages[0].content, /已经完成逐步梳理/);
    assert.match(payload.messages[0].content, /不要重复追问/);
    assert.match(payload.messages[0].content, /党史类比/);
    assert.equal(payload.max_tokens, 3600);
});
