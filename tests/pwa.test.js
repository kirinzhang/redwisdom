const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

test('web app manifest exposes install metadata and core shortcuts', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './index.html');
    assert.ok(manifest.icons.length > 0);
    assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === './reading.html'));
});

test('service worker avoids caching chat API requests and provides navigation fallback', () => {
    const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(worker, /pathname\.startsWith\('\/api\/'\)/);
    assert.match(worker, /request\.mode === 'navigate'/);
    assert.match(worker, /caches\.match\('\.\/index\.html'\)/);
});
