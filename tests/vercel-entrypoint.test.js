const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const entrypoint = fs.readFileSync(path.resolve(__dirname, '../api/chat.js'), 'utf8');

test('Vercel entrypoint dynamically imports ESM chat core after CommonJS compilation', () => {
    assert.match(entrypoint, /await import\('\.\/chat-core\.mjs'\)/);
    assert.doesNotMatch(entrypoint, /^import\s+\{\s*handleChatRequest/m);
});
