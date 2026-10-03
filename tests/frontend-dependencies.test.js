const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter((name) => name.endsWith('.html'));

test('pages use the prebuilt Tailwind stylesheet instead of the runtime CDN', () => {
    const css = fs.readFileSync(path.join(root, 'assets/tailwind.css'), 'utf8');
    for (const custom of ['bg-warm-rice', 'text-china-red', 'border-dark-beige', 'font-mao', 'text-ink-black']) {
        assert.ok(css.includes(custom), `assets/tailwind.css contains ${custom}`);
    }
    for (const page of pages) {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        assert.doesNotMatch(html, /cdn\.tailwindcss\.com/, `${page} does not load the Tailwind play CDN`);
        assert.doesNotMatch(html, /tailwind\.config\s*=/, `${page} has no runtime Tailwind config`);
    }
});

test('third-party scripts are pinned to exact versions', () => {
    for (const page of pages) {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        for (const [, src] of html.matchAll(/<script[^>]+src="(https:\/\/[^"]+)"/g)) {
            assert.match(src, /@\d+\.\d+\.\d+/, `${page} pins ${src}`);
        }
    }
});

test('the Huaihai article title is corrected everywhere and old links still resolve', () => {
    const catalog = fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8');
    assert.doesNotMatch(catalog, /淮海战役的的/);
    assert.ok(fs.existsSync(path.join(root, 'data/articles/131-关于淮海战役的作战方针.md')));
    const reading = fs.readFileSync(path.join(root, 'reading.html'), 'utf8');
    assert.match(reading, /'131-关于淮海战役的的作战方针\.md': '131-关于淮海战役的作战方针\.md'/);
});
