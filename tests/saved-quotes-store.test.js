const assert = require('node:assert/strict');
const test = require('node:test');

const {
    createSavedQuotesStore,
    summarizeSavedQuotesArchive,
} = require('../js/saved-quotes-store.js');

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}

test('saved quotes store saves one favorite per quote id and keeps source metadata', () => {
    const storage = createMemoryStorage();
    const store = createSavedQuotesStore(storage, () => Date.parse('2026-06-29T00:00:00.000Z'));

    const saved = store.saveQuote({
        id: 1,
        content: '没有调查就没有发言权。',
        source: '反对本本主义',
        date: '一九三〇年五月',
        category: '调查研究',
        methodTags: ['调查研究', '实事求是'],
        articleTitle: '反对本本主义',
        articleHref: 'reading.html#006.md',
    });
    store.saveQuote({
        id: 1,
        content: '没有调查就没有发言权。',
        source: '反对本本主义',
        methodTags: ['调查研究'],
    });

    assert.equal(saved.id, 'quote-1');
    assert.equal(saved.quoteId, '1');
    assert.equal(saved.source, '反对本本主义');
    assert.deepEqual(saved.methodologyTags, ['调查研究', '实事求是']);
    assert.equal(store.listSavedQuotes().length, 1);
});

test('saved quotes store toggles favorites and reports saved state', () => {
    const storage = createMemoryStorage();
    const store = createSavedQuotesStore(storage, () => Date.parse('2026-06-29T00:00:00.000Z'));
    const quote = { id: 'abc', content: '实践出真知。', source: '实践论' };

    assert.equal(store.isQuoteSaved(quote.id), false);
    const first = store.toggleQuote(quote);
    assert.equal(first.saved, true);
    assert.equal(store.isQuoteSaved(quote.id), true);

    const second = store.toggleQuote(quote);
    assert.equal(second.saved, false);
    assert.equal(store.isQuoteSaved(quote.id), false);
    assert.equal(store.listSavedQuotes().length, 0);
});

test('summarizeSavedQuotesArchive counts saved quotes and top methodology tags', () => {
    const summary = summarizeSavedQuotesArchive([
        { methodologyTags: ['调查研究', '实事求是'], updatedAt: '2026-06-29T00:00:00.000Z' },
        { methodologyTags: ['调查研究'], updatedAt: '2026-06-29T01:00:00.000Z' },
    ]);

    assert.equal(summary.total, 2);
    assert.deepEqual(summary.topMethodologyTags, [['调查研究', 2], ['实事求是', 1]]);
    assert.equal(summary.recentSavedQuotes[0].updatedAt, '2026-06-29T01:00:00.000Z');
});
