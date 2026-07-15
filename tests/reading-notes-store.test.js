const assert = require('node:assert/strict');
const test = require('node:test');

const {
    createReadingNotesStore,
    summarizeReadingNotesArchive,
} = require('../js/reading-notes-store.js');

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

test('reading notes store upserts one note per article and keeps the latest content', () => {
    let now = 1700000000000;
    const store = createReadingNotesStore(createMemoryStorage(), () => now);

    const created = store.upsertNote({
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        content: '认识要回到实践中检验。',
    });
    now += 1000;
    const updated = store.upsertNote({
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        content: '先行动，再用结果修正认识。',
    });

    assert.equal(created.articleTitle, '实践论');
    assert.equal(updated.id, created.id);
    assert.equal(updated.content, '先行动，再用结果修正认识。');
    assert.equal(store.listNotes().length, 1);
    assert.equal(store.getNoteForArticle('016-实践论.md').content, '先行动，再用结果修正认识。');
});

test('reading notes summaries are sorted by update time', () => {
    let now = 1700000000000;
    const store = createReadingNotesStore(createMemoryStorage(), () => now);
    store.upsertNote({
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        content: '第一条笔记',
    });
    now += 1000;
    store.upsertNote({
        articleId: '017-矛盾论.md',
        articleTitle: '矛盾论',
        content: '第二条笔记',
    });

    const notes = store.listNotes();
    const summary = summarizeReadingNotesArchive(notes);

    assert.equal(notes[0].articleTitle, '矛盾论');
    assert.equal(summary.total, 2);
    assert.equal(summary.recentNotes[0].articleTitle, '矛盾论');
});

test('reading notes store deletes a note by article id', () => {
    const store = createReadingNotesStore(createMemoryStorage(), () => 1700000000000);
    store.upsertNote({
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        content: '待删除',
    });

    store.deleteNoteForArticle('016-实践论.md');

    assert.equal(store.listNotes().length, 0);
    assert.equal(store.getNoteForArticle('016-实践论.md'), null);
});
