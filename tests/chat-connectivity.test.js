const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'config.js'), 'utf8');

function loadConfig(hostname, override = undefined) {
    const context = { location: { hostname }, REDWISDOM_CONFIG: override };
    vm.runInNewContext(`${configSource}\nglobalThis.__testedConfig = CONFIG;`, context);
    return context.__testedConfig;
}

test('local preview and production both use the same-origin chat API', () => {
    assert.equal(loadConfig('127.0.0.1').WORKER_URL, '/api/chat');
    assert.equal(loadConfig('localhost').WORKER_URL, '/api/chat');
    assert.equal(loadConfig('redwisdom.xyz').WORKER_URL, '/api/chat');
    assert.equal(loadConfig('localhost').MODEL, 'deepseek-v4-pro');
});

test('runtime config can override the default chat proxy', () => {
    assert.equal(loadConfig('127.0.0.1', { WORKER_URL: '/api/chat' }).WORKER_URL, '/api/chat');
});

test('chat page reports network and server errors with actionable messages', () => {
    const chat = fs.readFileSync(path.join(root, 'chat.html'), 'utf8');
    assert.match(chat, /readApiErrorMessage\(response\)/);
    assert.match(chat, /chat\.error\.network/);
    assert.match(chat, /chat\.error\.timeout/);
    assert.match(chat, /chat\.waiting\.start/);
    assert.match(chat, /chat\.waiting\.sources/);
    assert.match(chat, /signal: abortController\.signal/);
    assert.match(chat, /response\.body\?\.getReader/);
    assert.match(chat, /const responseText = await response\.text\(\)/);
    assert.match(chat, /typeof payload\?\.error === 'string'/);
});

test('local preview unregisters PWA caches that could mask a stopped server', () => {
    const bootstrap = fs.readFileSync(path.join(root, 'js/register-pwa.js'), 'utf8');
    assert.match(bootstrap, /isLocalPreview/);
    assert.match(bootstrap, /registration\.unregister\(\)/);
    assert.match(bootstrap, /key\.startsWith\('redwisdom-'\)/);
});
