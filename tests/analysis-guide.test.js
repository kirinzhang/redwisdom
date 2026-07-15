const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildGuidedAnalysisPrompt,
    buildPracticeDraftFromAnalysis,
    normalizeAnalysisInput,
} = require('../js/analysis-guide.js');

test('normalizeAnalysisInput trims fields and infers methodology tags from filled steps', () => {
    const normalized = normalizeAnalysisInput({
        realProblem: '  团队项目拖延  ',
        facts: '  已经延期两周；需求还在变  ',
        mainContradiction: '范围不清和交付时间固定之间的矛盾',
        investigationTodo: '今天问清三个必须保留的需求',
        availableForces: '两名同事可协助拆任务',
        actionPlan: '今晚前重排优先级',
        reviewQuestion: '明天看是否减少返工',
    });

    assert.equal(normalized.realProblem, '团队项目拖延');
    assert.equal(normalized.facts, '已经延期两周；需求还在变');
    assert.deepEqual(normalized.methodologyTags, ['调查研究', '主要矛盾', '实践检验', '复盘']);
});

test('buildGuidedAnalysisPrompt asks AI to coach through Mao-selected-works method steps', () => {
    const prompt = buildGuidedAnalysisPrompt({
        realProblem: '团队项目拖延',
        facts: '已经延期两周；需求还在变',
        mainContradiction: '范围不清和交付时间固定之间的矛盾',
        investigationTodo: '今天问清三个必须保留的需求',
        availableForces: '两名同事可协助拆任务',
        actionPlan: '今晚前重排优先级',
        reviewQuestion: '明天看是否减少返工',
    });

    assert.match(prompt, /请按毛选方法论/);
    assert.match(prompt, /事实材料：已经延期两周；需求还在变/);
    assert.match(prompt, /主要矛盾：范围不清和交付时间固定之间的矛盾/);
    assert.match(prompt, /缺少的调查：今天问清三个必须保留的需求/);
    assert.match(prompt, /今日实践：今晚前重排优先级/);
    assert.match(prompt, /先追问/);
});

test('buildPracticeDraftFromAnalysis creates a draft that can be saved as daily practice', () => {
    const draft = buildPracticeDraftFromAnalysis({
        realProblem: '团队项目拖延',
        facts: '已经延期两周；需求还在变',
        mainContradiction: '范围不清和交付时间固定之间的矛盾',
        investigationTodo: '今天问清三个必须保留的需求',
        availableForces: '两名同事可协助拆任务',
        actionPlan: '今晚前重排优先级',
        reviewQuestion: '明天看是否减少返工',
    });

    assert.equal(draft.sourceType, 'analysis-guide');
    assert.equal(draft.sourceTitle, '毛选方法分析向导');
    assert.equal(draft.realProblem, '团队项目拖延');
    assert.equal(draft.mainContradiction, '范围不清和交付时间固定之间的矛盾');
    assert.equal(draft.investigationTodo, '今天问清三个必须保留的需求');
    assert.equal(draft.availableForces, '两名同事可协助拆任务');
    assert.equal(draft.actionPlan, '今晚前重排优先级');
    assert.match(draft.expectedResult, /明天看是否减少返工/);
    assert.deepEqual(draft.methodologyTags, ['调查研究', '主要矛盾', '实践检验', '复盘']);
});
