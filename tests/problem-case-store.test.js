const assert = require('node:assert/strict');
const test = require('node:test');

const {
    ACTIVE_CASE_KEY,
    createProblemCaseStore,
    summarizeProblemCases,
} = require('../js/problem-case-store.js');

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); },
    };
}

test('problem case store creates and activates a private problem case', () => {
    const storage = createMemoryStorage();
    const store = createProblemCaseStore(storage, () => 1700000000000);
    const problemCase = store.createCase({
        title: '决定是否换工作',
        realProblem: '目前工作成长变慢，但换工作有不确定性。',
        goal: '四周内形成有事实依据的决定。',
    });

    assert.equal(problemCase.status, 'active');
    assert.equal(problemCase.stage, 'define');
    assert.equal(storage.getItem(ACTIVE_CASE_KEY), problemCase.id);
    assert.equal(store.getActiveCase().goal, '四周内形成有事实依据的决定。');
});

test('problem case stores analysis fields and linked activities', () => {
    let now = 1700000000000;
    const store = createProblemCaseStore(createMemoryStorage(), () => now);
    const problemCase = store.createCase({ title: '改善团队协作' });
    now += 1000;
    store.updateCase(problemCase.id, {
        facts: '最近三次交付都延期。',
        mainContradiction: '需求频繁变化和交付节奏之间的矛盾。',
        investigationTasks: ['统计变更次数', '访谈项目负责人'],
        stage: 'investigate',
    });
    now += 1000;
    const updated = store.addActivity(problemCase.id, {
        type: 'conversation',
        referenceId: 'conversation-1',
        title: '第一次分析',
        sourceHref: 'chat.html?conversation=conversation-1',
    });

    assert.equal(updated.stage, 'investigate');
    assert.equal(updated.activities.length, 1);
    assert.equal(updated.activities[0].type, 'conversation');
    assert.deepEqual(updated.investigationTasks, ['统计变更次数', '访谈项目负责人']);
});

test('problem case summary counts states and activities', () => {
    const summary = summarizeProblemCases([
        { status: 'active', stage: 'act', activities: [{}, {}] },
        { status: 'resolved', stage: 'review', activities: [{}] },
    ]);
    assert.equal(summary.total, 2);
    assert.equal(summary.activityCount, 3);
    assert.deepEqual(summary.statusCounts, { active: 1, resolved: 1 });
});

test('problem case review stores evidence, updates next action and can resolve the case', () => {
    let now = 1700000000000;
    const store = createProblemCaseStore(createMemoryStorage(), () => now++);
    const problemCase = store.createCase({ title: '验证新流程' });
    const reviewed = store.addReview(problemCase.id, {
        expectedResult: '返工减少',
        actualResult: '返工从三次降到一次',
        evidence: '本周交付记录',
        reflection: '主要矛盾判断基本成立',
        nextAction: '再验证一周',
        resolved: true,
    });
    assert.equal(reviewed.stage, 'review');
    assert.equal(reviewed.status, 'resolved');
    assert.equal(reviewed.nextAction, '再验证一周');
    assert.equal(reviewed.activities[0].type, 'review');
    assert.equal(reviewed.activities[0].metadata.evidence, '本周交付记录');
});
