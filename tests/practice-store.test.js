const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildPracticeDraftFromGuide,
    buildPracticeDraftFromQuote,
    createPracticeStore,
    summarizePracticeArchive,
} = require('../js/practice-store.js');

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

test('practice store creates a draft task and keeps it private in storage', () => {
    const store = createPracticeStore(createMemoryStorage(), () => 1700000000000);

    const practice = store.createPractice({
        title: '用实践论处理拖延',
        problemCaseId: 'problem-1',
        realProblem: '我总是拖延写方案。',
        sourceType: 'quote',
        sourceTitle: '实践论',
        relatedQuote: '实践是检验真理的唯一标准。',
        actionPlan: '今天写出方案第一段。',
    });

    assert.equal(practice.status, 'draft');
    assert.equal(practice.title, '用实践论处理拖延');
    assert.equal(practice.problemCaseId, 'problem-1');
    assert.equal(practice.createdAt, '2023-11-14T22:13:20.000Z');
    assert.equal(store.listPractices().length, 1);
    assert.equal(store.listPractices()[0].realProblem, '我总是拖延写方案。');
});

test('practice store updates status and reflection without losing source fields', () => {
    const store = createPracticeStore(createMemoryStorage(), () => 1700000000000);
    const practice = store.createPractice({
        title: '调查研究一次用户反馈',
        realProblem: '我不知道用户为什么流失。',
        sourceType: 'reading',
        sourceTitle: '反对本本主义',
        actionPlan: '今天访谈一个流失用户。',
    });

    const updated = store.updatePractice(practice.id, {
        status: 'reviewed',
        actualResult: '完成一次访谈，发现价格不是主要原因。',
        reflection: '之前判断太主观，缺少事实。',
        nextAction: '再访谈两个用户验证。',
    });

    assert.equal(updated.sourceTitle, '反对本本主义');
    assert.equal(updated.status, 'reviewed');
    assert.equal(updated.reflection, '之前判断太主观，缺少事实。');
    assert.equal(store.listPractices()[0].nextAction, '再访谈两个用户验证。');
});

test('summarizePracticeArchive counts statuses and methodology tags', () => {
    const summary = summarizePracticeArchive([
        {
            status: 'draft',
            methodologyTags: ['调查研究', '实事求是'],
        },
        {
            status: 'reviewed',
            methodologyTags: ['调查研究', '实践检验'],
        },
    ]);

    assert.deepEqual(summary.statusCounts, {
        draft: 1,
        reviewed: 1,
    });
    assert.deepEqual(summary.topMethodologyTags, [
        ['调查研究', 2],
        ['实事求是', 1],
        ['实践检验', 1],
    ]);
});

test('practice drafts can be built from quote and reading guide sources', () => {
    const quoteDraft = buildPracticeDraftFromQuote({
        content: '没有调查就没有发言权。',
        source: '反对本本主义',
        methodTags: ['调查研究', '实事求是'],
    });
    const guideDraft = buildPracticeDraftFromGuide('实践论', {
        problem: '如何把认识建立在实践上，并用实践检验判断。',
        practice: '选择一个正在拖延的问题，写下一个今天能完成的小实验，并记录结果。',
    });

    assert.equal(quoteDraft.sourceType, 'quote');
    assert.equal(quoteDraft.sourceTitle, '反对本本主义');
    assert.equal(quoteDraft.relatedQuote, '没有调查就没有发言权。');
    assert.deepEqual(quoteDraft.methodologyTags, ['调查研究', '实事求是']);
    assert.equal(guideDraft.sourceType, 'reading');
    assert.equal(guideDraft.actionPlan, '选择一个正在拖延的问题，写下一个今天能完成的小实验，并记录结果。');
});
