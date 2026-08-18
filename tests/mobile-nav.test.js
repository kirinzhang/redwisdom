const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

const pages = [
    ['index.html', 'home'],
    ['reading.html', 'reading'],
    ['chat.html', 'chat'],
    ['practice.html', 'practice'],
    ['me.html', 'me'],
    ['timeline.html', 'reading'],
];

const navTargets = [
    ['home', 'index.html'],
    ['reading', 'reading.html'],
    ['chat', 'chat.html'],
    ['practice', 'practice.html'],
    ['me', 'me.html'],
];

function readPage(fileName) {
    return fs.readFileSync(path.join(rootDir, fileName), 'utf8');
}

test('core pages expose a consistent mobile bottom navigation', () => {
    for (const [fileName, activeItem] of pages) {
        const page = readPage(fileName);

        assert.match(page, /class="[^"]*mobile-bottom-nav/, `${fileName} has mobile bottom nav`);
        assert.match(page, /aria-label="移动端主导航"/, `${fileName} labels mobile nav`);

        for (const [item, href] of navTargets) {
            assert.match(page, new RegExp(`data-mobile-nav-item="${item}"[^>]+href="${href}"`), `${fileName} links ${href}`);
        }

        const currentMatches = page.match(/aria-current="page"/g) || [];
        assert.equal(currentMatches.length, 1, `${fileName} marks exactly one active mobile tab`);
        assert.match(
            page,
            new RegExp(`data-mobile-nav-item="${activeItem}"[^>]+aria-current="page"`),
            `${fileName} marks ${activeItem} as active`
        );
    }
});

test('chat input reserves mobile space above the bottom navigation', () => {
    const page = readPage('chat.html');

    assert.match(page, /id="chatInputBar"/);
    assert.match(page, /id="chatInputBar"[^>]+pb-24/);
});
