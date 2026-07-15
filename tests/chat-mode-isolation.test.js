const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const chatHtml = fs.readFileSync(path.resolve(__dirname, '../chat.html'), 'utf8');

test('direct and guided chat use separate message panels and session state', () => {
    assert.match(chatHtml, /id="directMessages"/);
    assert.match(chatHtml, /id="guidedMessages"/);
    assert.match(chatHtml, /const chatSessions = \{/);
    assert.match(chatHtml, /direct:\s*\{\s*conversationHistory:/);
    assert.match(chatHtml, /guided:\s*\{\s*conversationHistory:/);
    assert.match(chatHtml, /getModeMessages\(mode\)\.appendChild/);
    assert.doesNotMatch(chatHtml, /let conversationHistory\s*=/);
});

test('streaming answer remains pinned to its request mode and can continue after truncation', () => {
    assert.match(chatHtml, /const requestMode =/);
    assert.match(chatHtml, /updateAssistantMessage\(fullResponse, contentElement, requestMode\)/);
    assert.match(chatHtml, /finishReason === 'length'/);
    assert.match(chatHtml, /addContinueAnswerAction\(contentElement, requestMode\)/);
});
