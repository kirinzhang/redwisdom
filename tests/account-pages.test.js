const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function readPage(fileName) {
    return fs.readFileSync(path.join(rootDir, fileName), 'utf8');
}

test('login page presents full learning archive sync capability', () => {
    const page = readPage('login.html');

    assert.match(page, /js\/cloud-sync\.js/);
    assert.match(page, /本机学习档案/);
    assert.match(page, /完整学习档案云端同步/);
    assert.match(page, /REDWISDOM_CONFIG_READY/);
    assert.match(page, /subscribeToAuthChanges/);
    assert.match(page, /id="syncNowBtn"/);
    assert.match(page, /getSafeReturnTo/);
    assert.match(page, /stopSignedInSync/);
    assert.match(page, /Google 登录尚未启用/);
    assert.match(page, /SUPABASE_GOOGLE_AUTH_ENABLED/);
    assert.doesNotMatch(page, /账户系统预览/);
    assert.doesNotMatch(page, /后续接入问答历史、阅读笔记和高亮/);
    assert.doesNotMatch(page, /同步实践记录/);
});

test('account-aware pages wait for public runtime auth configuration', () => {
    assert.match(readPage('me.html'), /REDWISDOM_CONFIG_READY/);
    assert.match(readPage('practice.html'), /REDWISDOM_CONFIG_READY/);
    assert.match(readPage('config.js'), /\/api\/public-config/);
    assert.match(readPage('js/auto-sync-bootstrap.js'), /subscribeToAuthChanges/);
    assert.match(readPage('js/auto-sync-bootstrap.js'), /stopAutoSync/);
});

test('profile page uses the shared full archive summary helper', () => {
    const page = readPage('me.html');

    assert.match(page, /summarizeArchive/);
    assert.match(page, /js\/saved-answers-store\.js/);
    assert.match(page, /收藏回答/);
    assert.match(page, /savedAnswerList/);
    assert.match(page, /完整学习档案云端同步/);
    assert.doesNotMatch(page, /实践任务云端同步/);
});

test('chat page can save assistant answers to the learning archive', () => {
    const page = readPage('chat.html');

    assert.match(page, /js\/saved-answers-store\.js/);
    assert.match(page, /addAnswerSaveAction/);
    assert.match(page, /chat\.saveAnswer/);
});
