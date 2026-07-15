const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const chat = fs.readFileSync(path.resolve(__dirname, '../chat.html'), 'utf8');

test('chat renders a source-backed history mirror after the generated answer', () => {
    assert.match(chat, /addHistoryMirror\(contentElement, contextBundle\.historyCases, contextBundle\.classification\)/);
    assert.match(chat, /dataset\.historyMirror = 'true'/);
    assert.match(chat, /党史镜鉴/);
    assert.match(chat, /可迁移方法/);
    assert.match(chat, /查看类比边界/);
    assert.match(chat, /阅读《.*》原文/);
    assert.match(chat, /核对党史来源/);
});

test('chat loads the problem taxonomy for classification and no-analogy blocking', () => {
    assert.match(chat, /data\/history-problem-types\.json/);
    assert.match(chat, /problemTypes: sources\.historyProblemTypes/);
    assert.match(chat, /noAnalogyCues: sources\.noAnalogyCues/);
});
