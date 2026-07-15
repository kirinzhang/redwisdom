const assert = require('node:assert/strict');
const test = require('node:test');

const {
    createReadingProgressStore,
    summarizeReadingProgressArchive,
} = require('../js/reading-progress-store.js');

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

test('reading progress store records the latest article visit and progress percent', () => {
    let now = 1700000000000;
    const store = createReadingProgressStore(createMemoryStorage(), () => now);

    const created = store.upsertProgress({
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        progressPercent: 12,
        lastPosition: 240,
    });
    now += 1000;
    const updated = store.upsertProgress({
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        progressPercent: 55,
        lastPosition: 1200,
    });

    assert.equal(updated.id, created.id);
    assert.equal(updated.progressPercent, 55);
    assert.equal(updated.lastPosition, 1200);
    assert.equal(store.getProgressForArticle('016-实践论.md').articleTitle, '实践论');
    assert.equal(store.listProgress()[0].progressPercent, 55);
});

test('reading progress store toggles bookmarks without losing progress', () => {
    const store = createReadingProgressStore(createMemoryStorage(), () => 1700000000000);
    store.upsertProgress({
        articleId: '017-矛盾论.md',
        articleTitle: '矛盾论',
        progressPercent: 20,
        lastPosition: 300,
    });

    const bookmarked = store.toggleBookmark({
        articleId: '017-矛盾论.md',
        articleTitle: '矛盾论',
    });
    const unbookmarked = store.toggleBookmark({
        articleId: '017-矛盾论.md',
        articleTitle: '矛盾论',
    });

    assert.equal(bookmarked.bookmarked, true);
    assert.equal(bookmarked.progressPercent, 20);
    assert.equal(unbookmarked.bookmarked, false);
    assert.equal(store.listBookmarks().length, 0);
});

test('reading progress store saves and deletes article highlights', () => {
    let now = 1700000000000;
    const store = createReadingProgressStore(createMemoryStorage(), () => now);

    const highlight = store.addHighlight({
        articleId: '006-反对本本主义.md',
        articleTitle: '反对本本主义',
        selectedText: '没有调查，没有发言权。',
        note: '这是做判断前的纪律。',
    });
    now += 1000;
    store.addHighlight({
        articleId: '017-矛盾论.md',
        articleTitle: '矛盾论',
        selectedText: '研究任何过程。',
    });

    assert.equal(store.listHighlights().length, 2);
    assert.equal(store.listHighlightsForArticle('006-反对本本主义.md')[0].note, '这是做判断前的纪律。');

    store.deleteHighlight(highlight.id);

    assert.equal(store.listHighlightsForArticle('006-反对本本主义.md').length, 0);
});

test('summarizeReadingProgressArchive counts recent reading, bookmarks, and highlights', () => {
    const summary = summarizeReadingProgressArchive({
        progress: [
            { articleId: '016-实践论.md', bookmarked: true, updatedAt: '2026-06-29T00:00:00.000Z' },
            { articleId: '017-矛盾论.md', bookmarked: false, updatedAt: '2026-06-29T01:00:00.000Z' },
        ],
        highlights: [
            { id: 'highlight-1', articleId: '016-实践论.md', updatedAt: '2026-06-29T02:00:00.000Z' },
        ],
    });

    assert.equal(summary.totalReadArticles, 2);
    assert.equal(summary.totalBookmarks, 1);
    assert.equal(summary.totalHighlights, 1);
    assert.equal(summary.recentProgress[0].articleId, '017-矛盾论.md');
    assert.equal(summary.recentHighlights[0].id, 'highlight-1');
});
