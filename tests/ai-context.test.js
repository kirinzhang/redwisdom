const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildContextMessage,
    findRelevantMaoContexts,
} = require('../js/ai-context.js');

const quotes = [
    {
        content: '没有调查，没有发言权。',
        source: '反对本本主义',
        category: '调查研究',
    },
    {
        content: '实践是检验真理的唯一标准。',
        source: '实践论',
        category: '实践检验',
    },
    {
        content: '要善于抓住主要矛盾。',
        source: '矛盾论',
        category: '矛盾分析',
    },
];

const guides = [
    {
        articleTitle: '反对本本主义',
        problem: '如何避免脱离实际，用调查研究替代空想和照搬。',
        coreIdeas: ['没有调查就没有发言权。', '实际情况比书本结论更具体。'],
        practice: '列出一个问题的三条待调查事实。',
    },
    {
        articleTitle: '矛盾论',
        problem: '如何在复杂局面中找出主要矛盾和解决顺序。',
        coreIdeas: ['复杂问题中要抓主要矛盾。'],
        practice: '把现实问题拆成三条矛盾。',
    },
];

test('findRelevantMaoContexts ranks quotes and guides by problem keywords and methodology', () => {
    const contexts = findRelevantMaoContexts({
        userMessage: '我做产品决策太主观，没有用户调查，应该怎么开始？',
        quotes,
        guides,
        limit: 3,
    });

    assert.equal(contexts.length, 3);
    assert.equal(contexts[0].sourceTitle, '反对本本主义');
    assert.equal(contexts[0].type, 'quote');
    assert.ok(contexts.some(context => context.type === 'guide' && context.sourceTitle === '反对本本主义'));
});

test('findRelevantMaoContexts deduplicates source text and includes methodology tags', () => {
    const contexts = findRelevantMaoContexts({
        userMessage: '我需要通过实践检验判断',
        quotes,
        guides,
        limit: 5,
    });

    const uniqueKeys = new Set(contexts.map(context => `${context.type}:${context.sourceTitle}:${context.text}`));
    assert.equal(uniqueKeys.size, contexts.length);
    assert.ok(contexts[0].methodologyTags.includes('实践检验'));
});

test('buildContextMessage creates a bounded system message with citation instructions', () => {
    const message = buildContextMessage([
        {
            type: 'quote',
            sourceTitle: '反对本本主义',
            text: '没有调查，没有发言权。',
            methodologyTags: ['调查研究'],
        },
        {
            type: 'guide',
            sourceTitle: '矛盾论',
            text: '复杂问题中要抓主要矛盾。',
            methodologyTags: ['矛盾分析'],
        },
    ]);

    assert.equal(message.role, 'system');
    assert.match(message.content, /可参考的毛选上下文/);
    assert.match(message.content, /《反对本本主义》/);
    assert.match(message.content, /必须标明文章名/);
    assert.ok(message.content.length < 1600);
});

test('findRelevantMaoContexts can retrieve anchored full-text passages', () => {
    const contexts = findRelevantMaoContexts({
        userMessage: '怎样了解困难问题的来源和现状',
        quotes: [],
        guides: [],
        passages: [{
            articleId: '006-反对本本主义.md',
            title: '反对本本主义',
            anchor: 'p-source',
            text: '把困难问题的来源找到手，现状弄明白，这个困难问题也就容易解决了。',
        }],
    });
    assert.equal(contexts[0].type, 'passage');
    assert.match(contexts[0].sourceHref, /anchor=p-source/);
});
