const assert = require('node:assert/strict');
const test = require('node:test');

const {
    createSavedAnswersStore,
    summarizeSavedAnswersArchive,
} = require('../js/saved-answers-store.js');

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

test('saved answers store saves one answer per answer id and keeps context metadata', () => {
    let tick = Date.parse('2026-06-29T00:00:00.000Z');
    const store = createSavedAnswersStore(createMemoryStorage(), () => tick);

    const saved = store.saveAnswer({
        answerId: 'conversation-1-answer-1',
        conversationId: 'conversation-1',
        userMessage: '我总是拖延。',
        assistantMessage: '先回到事实，列出今天能做的一步。',
        methodologyTags: ['调查研究', '实践检验'],
    });
    tick += 60_000;
    const updated = store.saveAnswer({
        answerId: 'conversation-1-answer-1',
        conversationId: 'conversation-1',
        userMessage: '我总是拖延。',
        assistantMessage: '先回到事实，今天完成第一段。',
        methodologyTags: ['实践检验'],
    });

    assert.equal(saved.id, 'answer-conversation-1-answer-1');
    assert.equal(updated.id, saved.id);
    assert.equal(updated.conversationId, 'conversation-1');
    assert.equal(updated.title, '我总是拖延。');
    assert.equal(updated.assistantMessage, '先回到事实，今天完成第一段。');
    assert.deepEqual(updated.methodologyTags, ['实践检验']);
    assert.equal(store.listSavedAnswers().length, 1);
});

test('saved answers store toggles saved state by answer id', () => {
    const store = createSavedAnswersStore(createMemoryStorage(), () => Date.parse('2026-06-29T00:00:00.000Z'));

    const first = store.toggleAnswer({
        answerId: 'answer-1',
        userMessage: '怎么做？',
        assistantMessage: '先调查。',
    });
    const second = store.toggleAnswer({
        answerId: 'answer-1',
        userMessage: '怎么做？',
        assistantMessage: '先调查。',
    });

    assert.equal(first.saved, true);
    assert.equal(first.answer.answerId, 'answer-1');
    assert.equal(second.saved, false);
    assert.equal(store.isAnswerSaved('answer-1'), false);
});

test('summarizeSavedAnswersArchive counts saved answers and top methodology tags', () => {
    const summary = summarizeSavedAnswersArchive([
        {
            id: 'answer-1',
            methodologyTags: ['调查研究', '实践检验'],
            updatedAt: '2026-06-29T01:00:00.000Z',
        },
        {
            id: 'answer-2',
            methodologyTags: ['调查研究'],
            updatedAt: '2026-06-29T02:00:00.000Z',
        },
    ]);

    assert.equal(summary.total, 2);
    assert.deepEqual(summary.recentSavedAnswers.map(answer => answer.id), ['answer-2', 'answer-1']);
    assert.deepEqual(summary.topMethodologyTags, [['调查研究', 2], ['实践检验', 1]]);
});
