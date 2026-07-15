const assert = require('node:assert/strict');
const test = require('node:test');

const {
    createConversationStore,
    summarizeConversationArchive,
} = require('../js/conversation-store.js');

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

test('conversation store records a question and assistant answer as a private local conversation', () => {
    let now = 1700000000000;
    const store = createConversationStore(createMemoryStorage(), () => now);

    const conversation = store.createConversation({
        userMessage: '我总是拖延写方案，应该怎么用实践论处理？',
        problemCaseId: 'problem-1',
        source: 'chat',
    });
    now += 1000;
    const updated = store.appendMessage(conversation.id, {
        role: 'assistant',
        content: '先把事实列出来，再做一个今天能完成的小实验。',
        methodologyTags: ['实践检验', '调查研究'],
    });

    assert.equal(conversation.title, '我总是拖延写方案，应该怎么用实践论处理？');
    assert.equal(conversation.problemCaseId, 'problem-1');
    assert.equal(updated.messages.length, 2);
    assert.equal(updated.messages[1].role, 'assistant');
    assert.deepEqual(updated.methodologyTags, ['实践检验', '调查研究']);
    assert.equal(store.listConversations()[0].messages[0].content, '我总是拖延写方案，应该怎么用实践论处理？');
});

test('conversation summaries are sorted by latest update and omit full message bodies', () => {
    let now = 1700000000000;
    const store = createConversationStore(createMemoryStorage(), () => now);
    const first = store.createConversation({ userMessage: '第一个问题' });
    now += 1000;
    store.appendMessage(first.id, { role: 'assistant', content: '第一个回答' });
    now += 1000;
    const second = store.createConversation({ userMessage: '第二个问题' });

    const summaries = store.listConversationSummaries();

    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].id, second.id);
    assert.equal(summaries[0].title, '第二个问题');
    assert.equal(summaries[0].messageCount, 1);
    assert.equal(Object.hasOwn(summaries[0], 'messages'), false);
});

test('summarizeConversationArchive counts conversations and methodology tags', () => {
    const summary = summarizeConversationArchive([
        {
            methodologyTags: ['实践检验', '调查研究'],
            messages: [{ role: 'user' }, { role: 'assistant' }],
        },
        {
            methodologyTags: ['调查研究'],
            messages: [{ role: 'user' }],
        },
    ]);

    assert.equal(summary.total, 2);
    assert.equal(summary.totalMessages, 3);
    assert.deepEqual(summary.topMethodologyTags, [
        ['调查研究', 2],
        ['实践检验', 1],
    ]);
});
