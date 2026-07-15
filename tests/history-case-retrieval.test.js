const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
    buildHistoryContextMessage,
    buildHistoryMirrorModel,
    classifyProblem,
    findRelevantHistoryCases,
} = require('../js/history-case-retrieval.js');

const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/history-cases.json'), 'utf8')).cases;

test('history case retrieval finds a relevant primary-source-backed analogy', () => {
    const results = findRelevantHistoryCases({
        userMessage: '创业初期现金流很紧，团队资源也不够，应该只削减成本吗？',
        cases,
    });
    assert.equal(results[0].id, 'border-economy-1942');
    assert.equal(results[0].source.articleTitle, '抗日时期的经济问题和财政问题');
});

test('history context requires similarities, differences and transfer limits', () => {
    const message = buildHistoryContextMessage([cases[0]]);
    assert.equal(message.role, 'system');
    assert.match(message.content, /相似之处/);
    assert.match(message.content, /关键差异/);
    assert.match(message.content, /历史结果/);
    assert.match(message.content, /最贴切的一例/);
    assert.match(message.content, /不得暗示历史结果/);
    assert.match(message.content, /不得补写人物动机/);
    assert.match(message.content, /不得把用户描述中的现代问题词反向写成当年的史实/);
    assert.match(message.content, /只有逐字内容确实出现在另行提供的毛选原文上下文时才能使用引号/);
    assert.match(message.content, /案例材料概括为/);
    assert.match(message.content, /史料边界（不得越过）/);
    assert.match(message.content, /最终核对/);
    assert.match(message.content, /史料核对/);
    assert.match(message.content, /12371\.cn/);
    assert.match(message.content, /reading\.html\?article=/);
});

test('history retrieval maps everyday difficulty language to relevant party history', () => {
    const anxious = findRelevantHistoryCases({
        userMessage: '我对未来很焦虑，越来越没信心，看不到希望。',
        cases,
    });
    const failed = findRelevantHistoryCases({
        userMessage: '项目彻底失败了，我是不是应该承认犯错并重新开始？',
        cases,
    });
    const conflict = findRelevantHistoryCases({
        userMessage: '团队互相指责，意见不合，内耗很严重。',
        cases,
    });

    assert.equal(anxious[0].id, 'spark-strategy-1930');
    assert.equal(failed[0].id, 'zunyi-correction-1935');
    assert.equal(conflict[0].id, 'rectification-learning-1942');
});

test('history dataset publishes 60 source-reviewed cases with exact primary excerpts', () => {
    assert.equal(cases.length, 60);
    cases.forEach((item) => {
        assert.equal(item.verification.status, 'cross-checked');
        assert.match(item.review.status, /^(source-reviewed|editor-approved)$/);
        assert.equal(typeof item.sourceBoundary === 'string' && item.sourceBoundary.length > 0, true);
        assert.equal(item.evidence.some(evidence => evidence.type === 'primary' && evidence.excerpt && evidence.excerptHash), true);
        assert.equal(item.evidence.some(evidence => evidence.type === 'authoritative-history' && /12371\.cn/.test(evidence.url)), true);
    });
});

test('problem classification blocks irrelevant analogies and exposes mirror links', () => {
    const taxonomy = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/history-problem-types.json'), 'utf8'));
    const classification = classifyProblem({
        userMessage: '项目失败以后团队互相指责，我该怎样复盘？',
        problemTypes: taxonomy.types,
    });
    const irrelevant = findRelevantHistoryCases({
        userMessage: '帮我查一下明天的天气',
        cases,
        problemTypes: taxonomy.types,
        noAnalogyCues: taxonomy.noAnalogyCues,
    });
    const result = findRelevantHistoryCases({
        userMessage: '项目失败以后团队互相指责，我该怎样复盘？',
        cases,
        problemTypes: taxonomy.types,
    });
    const mirror = buildHistoryMirrorModel(result);

    assert.equal(classification.primaryType, 'failure-recovery');
    assert.deepEqual(irrelevant, []);
    assert.match(mirror[0].readingHref, /^reading\.html\?article=/);
    assert.match(mirror[0].authorityUrl, /12371\.cn/);
    assert.equal(mirror[0].primaryExcerpt.length > 0, true);
});

test('unverified history drafts are excluded from retrieval', () => {
    const results = findRelevantHistoryCases({
        userMessage: '测试草稿案例',
        cases: [
            ...cases,
            {
                id: 'unverified-draft',
                title: '测试草稿案例',
                challenge: '测试草稿案例',
                keywords: ['测试草稿案例'],
                verification: { status: 'draft' },
            },
        ],
    });

    assert.equal(results.some(item => item.id === 'unverified-draft'), false);
});

test('expanded cases cover cooperation boundaries, reporting, differentiated rollout and meetings', () => {
    const prompts = [
        ['合作伙伴是最大客户，我担心太依赖对方，决策权和退出边界不清。', 'united-front-independence-1938'],
        ['公司扩张后出现信息孤岛，管理层不了解一线，汇报太多又没重点。', 'reporting-system-1948'],
        ['几个地区成熟度差异很大，总部一刀切推同一套制度。', 'differentiated-land-policy-1948'],
        ['每周开会但没有结果，领导班子无法形成共识。', 'committee-working-method-1949'],
        ['大家开会不说，会后抱怨，还因为熟人关系不敢反馈。', 'anti-liberalism-accountability-1937'],
        ['社区里每个人资源不足，但大家能力互补，怎样互助？', 'organize-mutual-aid-1943'],
    ];

    prompts.forEach(([userMessage, expectedId]) => {
        const [first] = findRelevantHistoryCases({ userMessage, cases, limit: 3 });
        assert.equal(first.id, expectedId);
    });
});
