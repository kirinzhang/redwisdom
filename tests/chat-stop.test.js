const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function readPage(fileName) {
    return fs.readFileSync(path.join(rootDir, fileName), 'utf8');
}

test('chat page supports user-initiated stop during generation', () => {
    const chat = readPage('chat.html');

    // 发送按钮在生成中切换为「停止」且保持可点击
    assert.match(chat, /sendBtnLabel\.textContent = window\.RedWisdomI18n\.translate\(currentLocale, busy \? 'chat\.stop' : 'chat\.send'\)/);
    assert.match(chat, /sendBtn\.classList\.toggle\('stop-mode', busy\)/);
    assert.match(chat, /sendBtn\.disabled = false;/);
    assert.match(chat, /#sendBtn\.stop-mode/);

    // 点击生成中的按钮 = 中止
    assert.match(chat, /if \(isGenerating\) \{\s*stopGeneration\(\);/);
    assert.match(chat, /function stopGeneration\(\)/);
    assert.match(chat, /stoppedByUser = true;/);
    assert.match(chat, /activeAbortController = abortController;/);
    assert.match(chat, /signal: abortController\.signal/);

    // 用户停止时保留已生成的部分回答，而不是整段删除
    assert.match(chat, /回答被手动停止，尚未回答完/);
    assert.match(chat, /appendStoppedNotice/);
    assert.match(chat, /addContinueAnswerAction\(contentElement, requestMode\)/);

    // 尚未生成内容就停止时，问题放回输入框
    assert.match(chat, /chat\.error\.stopped/);
});

test('chat input does not send while an IME composition is active', () => {
    const chat = readPage('chat.html');
    assert.match(chat, /e\.isComposing \|\| e\.keyCode === 229/);
    // 生成中 Enter 不触发停止，防止误触
    assert.match(chat, /if \(!isGenerating\) sendBtn\.click\(\)/);
});

test('stop wording is provided in both locales', () => {
    const i18n = readPage('js/i18n.js');
    assert.match(i18n, /'chat\.stop': '停止'/);
    assert.match(i18n, /'chat\.stop': 'Stop'/);
    assert.match(i18n, /'chat\.stoppedNotice': '已手动停止/);
    assert.match(i18n, /'chat\.error\.stopped': '已停止。你的问题已放回输入框/);
});
