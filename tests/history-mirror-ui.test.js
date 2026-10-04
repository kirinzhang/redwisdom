const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const chat = fs.readFileSync(path.resolve(__dirname, '../chat.html'), 'utf8');

test('chat renders a source-backed history mirror after the generated answer', () => {
    assert.match(chat, /addHistoryMirror\(contentElement, retrieval\.historyMirror, retrieval\.classificationLabel\)/);
    assert.match(chat, /parsed\.redwisdom/);
    assert.match(chat, /dataset\.historyMirror = 'true'/);
    assert.match(chat, /党史镜鉴/);
    assert.match(chat, /可迁移方法/);
    assert.match(chat, /查看类比边界/);
    assert.match(chat, /阅读《.*》原文/);
    assert.match(chat, /核对党史来源/);
});

test('server-side retrieval loads the problem taxonomy for classification and no-analogy blocking', () => {
    const context = fs.readFileSync(path.resolve(__dirname, '../api/chat-context.mjs'), 'utf8');
    assert.match(context, /data\/history-problem-types\.json/);
    assert.match(context, /problemTypes: sources\.historyProblemTypes/);
    assert.match(context, /noAnalogyCues: sources\.noAnalogyCues/);
});

test('chat page no longer downloads the full-text index or history library', () => {
    assert.doesNotMatch(chat, /search-index\.json/);
    assert.doesNotMatch(chat, /history-cases\.json/);
});
