import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { handleChat } from '../worker/index.mjs';
import { buildEnglishSources, buildServerMessages } from '../api/chat-context-core.mjs';
import { resetMemoryRateLimits } from '../api/rate-limit.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const LangSwitch = require('../js/lang-switch.js');
const AIContextEn = require('../js/ai-context-en.js');
const QuoteUtils = require('../js/quote-utils.js');

const catalog = readJson('data/en/catalog.json');
const zhCatalog = readJson('data/catalog.json');
const quotes = readJson('data/en/quotes.json');
const search = readJson('data/en/search-index.json');
const entries = Object.values(catalog.volumes).flat();

function memoryStorage(initial = {}) {
    const data = { ...initial };
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

test('language comes from the URL first, then the stored choice, then Chinese', () => {
    const key = LangSwitch.STORAGE_KEY;
    const storage = memoryStorage();
    assert.equal(LangSwitch.resolveLocale('?lang=en', storage, key), 'en');
    assert.equal(storage.data[key], 'en', 'the URL choice is remembered');
    assert.equal(LangSwitch.resolveLocale('', storage, key), 'en');
    assert.equal(LangSwitch.resolveLocale('?lang=zh', storage, key), 'zh-CN');
    assert.equal(LangSwitch.resolveLocale('', memoryStorage(), key), 'zh-CN');
    assert.equal(LangSwitch.resolveLocale('', { getItem() { throw new Error('blocked'); } }, key), 'zh-CN');
});

test('only cards, reading and Ask have an English page', () => {
    for (const page of ['/', '/index.html', '/reading.html', '/chat.html']) assert.ok(LangSwitch.supportsEnglish(page), page);
    for (const page of ['/practice.html', '/timeline.html', '/campaign.html', '/me.html']) assert.ok(!LangSwitch.supportsEnglish(page), page);
    assert.equal(LangSwitch.switchUrl('https://redwisdom.xyz/reading.html?article=a.md#x', 'en'), 'https://redwisdom.xyz/reading.html?article=a.md&lang=en#x');
    assert.equal(LangSwitch.switchUrl('https://redwisdom.xyz/chat.html?lang=en', 'zh-CN'), 'https://redwisdom.xyz/chat.html?lang=zh');
});

test('each English page loads the switch early and shows it in the top right', () => {
    for (const page of LangSwitch.ENGLISH_PAGES) {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        const head = html.slice(0, html.indexOf('</head>'));
        assert.match(head, /<script src="js\/lang-switch\.js"><\/script>/, `${page} loads lang-switch in <head>`);
        assert.match(html, /data-lang-switch/, `${page} has the switch`);
        assert.ok(!html.includes('id="localeSelect"') && !html.includes('id="readingLocaleSelect"'), `${page} drops the old language menu`);
    }
    const chat = fs.readFileSync(path.join(root, 'chat.html'), 'utf8');
    for (const link of ['practice', 'problems', 'me', 'login']) assert.match(chat, new RegExp(`href="${link}\\.html"[^>]*data-zh-only`), `${link} is hidden in English`);
});

test('the English edition carries all five volumes of the FLP translation', () => {
    assert.deepEqual(Object.values(catalog.volumes).map((v) => v.length), [17, 40, 31, 70, 70]);
    assert.equal(entries.length, 228);
    const files = new Set(fs.readdirSync(path.join(root, 'data/en/articles')));
    const zhFiles = new Set(Object.values(zhCatalog.volumes).flat().map((a) => a.filename));
    for (const entry of entries) {
        assert.ok(files.has(entry.filename), `${entry.filename} exists`);
        assert.match(entry.source, /^https:\/\/www\.marxists\.org\/reference\/archive\/mao\/selected-works\//);
        assert.ok(zhFiles.has(entry.zh), `${entry.filename} maps to a Chinese article`);
    }
    assert.equal(new Set(entries.map((e) => e.zh)).size, 228, 'the mapping is one to one');
    const byTitle = Object.fromEntries(entries.map((e) => [e.title, e.zh]));
    assert.equal(byTitle['On Contradiction'], '017-矛盾论.md');
    assert.equal(byTitle['On Practice'], '016-实践论.md');
    assert.equal(byTitle['Serve the People'], '076-为人民服务.md');
    const practice = fs.readFileSync(path.join(root, 'data/en/articles/015-on-practice.md'), 'utf8');
    assert.match(practice, /^# On Practice\n\n\*July 1937\*\n/);
    assert.equal(practice.match(/^July 1937$/gm), null, 'the date is not repeated under the subtitle');
    const contradiction = fs.readFileSync(path.join(root, 'data/en/articles/016-on-contradiction.md'), 'utf8');
    assert.match(contradiction, /\n## Notes\n\n\[1\] V\. I\. Lenin/);
    assert.equal(readJson('data/en/text-edition.json').source, 'https://www.marxists.org/reference/archive/mao/selected-works/index.htm');
});

test('English cards are short, verbatim and link back to the passage', () => {
    const cards = QuoteUtils.normalizeEnglishQuotes(quotes, catalog);
    assert.ok(cards.length >= 55, `${cards.length} cards`);
    const files = new Set(entries.map((e) => e.filename));
    const records = new Map(search.records.map((r) => [`${r.articleId}#${r.anchor}`, r]));
    const squash = (t) => String(t).replace(/[^a-z0-9]/gi, '').toLowerCase();
    for (const card of cards) {
        assert.ok(card.content.length <= 260, card.content);
        assert.doesNotMatch(card.content, /imperialis|reactionar|running dogs|army|enemy/i);
        assert.match(card.articleHref, /^reading\.html\?lang=en(&article=|$)/);
        const raw = quotes.quotes.find((q) => q.content === card.content);
        if (raw.articleFilename) assert.ok(files.has(raw.articleFilename));
        if (raw.anchor) {
            const record = records.get(`${raw.articleFilename}#${raw.anchor}`);
            assert.ok(record && squash(record.text).includes(squash(raw.content.split('\n')[0]).slice(0, 60)), `${raw.id} anchor holds the quote`);
        }
    }
    assert.ok(cards.filter((c) => c.articleHref.includes('&anchor=')).length >= cards.length / 2, 'most cards jump to the exact paragraph');
});

test('English retrieval maps everyday problems to the method texts', () => {
    const passages = search.records;
    const ask = (q) => AIContextEn.findRelevantPassages({ userMessage: q, passages, limit: 4 }).map((p) => p.articleId);
    assert.ok(ask('I have too many projects and cannot decide which to focus on first').some((id) => /contradiction|methods-of-work|methods-of-leadership/.test(id)));
    assert.ok(ask('My plan keeps failing and I want to give up').some((id) => /protracted|foolish-old-man/.test(id)));
    assert.ok(ask('I make decisions without checking the facts').some((id) => /reform-our-study|investigation|rectify/.test(id)));
    assert.deepEqual(ask(''), []);
    const context = AIContextEn.buildContextMessage(AIContextEn.findRelevantPassages({ userMessage: 'principal contradiction', passages }));
    assert.equal(context.role, 'system');
    assert.match(context.content, /Foreign Languages Press/);
    assert.match(context.content, /locator: reading\.html\?lang=en&article=/);
});

test('an English question is answered from the English edition only', () => {
    const sources = { en: buildEnglishSources({ search }) };
    const { messages, retrieval } = buildServerMessages({ mode: 'direct', locale: 'en', dialogue: [{ role: 'user', content: 'Our team keeps arguing. Which conflict should I deal with first?' }] }, sources);
    assert.equal(messages.at(-1).role, 'user');
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    assert.match(system, /Answer in English/);
    assert.match(system, /verbatim|quote/i);
    assert.doesNotMatch(system, /党史镜鉴/);
    assert.ok(retrieval.passages.length > 0);
    assert.deepEqual(retrieval.historyMirror, []);
});

test('the Worker loads the English index for English questions', async () => {
    resetMemoryRateLimits();
    const ASSETS = {
        requested: [],
        async fetch(request) {
            const url = new URL(request.url);
            this.requested.push(url.pathname);
            const file = path.join(root, decodeURIComponent(url.pathname));
            if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
            return new Response(fs.readFileSync(file));
        },
    };
    let sent = null;
    const fetchImpl = async (url, init) => {
        sent = JSON.parse(init.body);
        return new Response('data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
    };
    const request = new Request('https://redwisdom.xyz/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://redwisdom.xyz', 'cf-connecting-ip': '9.9.9.9' },
        body: JSON.stringify({ mode: 'direct', locale: 'en', messages: [{ role: 'user', content: 'How do I learn from my mistakes?' }] }),
    });
    const res = await handleChat(request, { ASSETS, DEEPSEEK_API_KEY: 'k' }, { fetchImpl });
    assert.equal(res.status, 200);
    await res.text();
    assert.deepEqual(ASSETS.requested, ['/data/en/search-index.json']);
    assert.ok(sent.messages.some((m) => m.role === 'system' && /Selected Works of Mao Tse-tung \(English translation/.test(m.content)));
});

test('English card sources never sit on top of the quote', () => {
    const cards = QuoteUtils.normalizeEnglishQuotes(quotes, catalog);
    const inscription = cards.find((c) => c.content.startsWith('Production by the masses'));
    assert.equal(inscription.date, 'November 24, 1943', 'a date at the end of an inscription source moves to the date line');
    assert.doesNotMatch(inscription.source, /1943$/);
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.match(css, /html\[data-locale="en"\] \.quote-meta \{ position: static;/, 'the English source line is laid out below the quote');
    assert.match(css, /\.home-lang-switch \{ position: fixed;/);
    const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    assert.match(script, /quoteUtils\.fitQuoteText\(content, text\)/, 'long quotes shrink to fit the card');
});

test('fitQuoteText shrinks the quote until the card no longer overflows', () => {
    const text = { style: { fontSize: '' }, ownerDocument: { defaultView: { getComputedStyle: () => ({ fontSize: '24px' }) } } };
    const container = { clientHeight: 300, get scrollHeight() { const size = parseFloat(text.style.fontSize) || 24; return size * 16; } };
    const size = QuoteUtils.fitQuoteText(container, text);
    assert.ok(size <= 18.75 && size > 18, `ends at ${size}px`);
    const tiny = { clientHeight: 10, scrollHeight: 999 };
    assert.equal(QuoteUtils.fitQuoteText(tiny, { style: {}, ownerDocument: text.ownerDocument }), 13, 'stops at the minimum size');
});

test('English pages load their own reading fonts only in English mode', () => {
    assert.match(LangSwitch.EN_FONT_URL, /^https:\/\/fonts\.googleapis\.com\/css2\?family=EB\+Garamond.*Source\+Serif\+4/);
    const source = fs.readFileSync(path.join(root, 'js/lang-switch.js'), 'utf8');
    assert.match(source, /if \(pageLocale === 'en' && win\.document\.head\) injectEnglishFonts/);
});
