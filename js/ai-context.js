(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomAIContext = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const METHOD_KEYWORDS = [
        ['调查研究', ['调查', '用户', '事实', '现场', '主观', '决策', '了解']],
        ['实践检验', ['实践', '行动', '检验', '验证', '实验', '拖延']],
        ['矛盾分析', ['矛盾', '冲突', '复杂', '选择', '阻力', '卡点']],
        ['主要矛盾', ['主要矛盾', '重点', '关键', '优先']],
        ['持久战', ['长期', '坚持', '阶段', '周期', '低谷']],
        ['群众路线', ['团队', '组织', '群众', '协作', '沟通']],
        ['自我批评', ['反思', '批评', '改正', '缺点', '逃避']],
    ];

    function findRelevantMaoContexts({ userMessage, quotes, guides, passages, limit = 4 }) {
        const queryTokens = tokenize(userMessage);
        const candidates = [
            ...normalizeQuotes(quotes),
            ...normalizeGuides(guides),
            ...normalizePassages(passages),
        ];
        const seen = new Set();

        return candidates
            .map((context, index) => ({
                ...context,
                score: scoreContext(context, queryTokens, userMessage) + (1 / (index + 100)),
            }))
            .filter((context) => context.score > 0)
            .sort((a, b) => b.score - a.score)
            .filter((context) => {
                const key = `${context.type}:${context.sourceTitle}:${context.text}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, limit)
            .map(({ score, ...context }) => context);
    }

    function buildContextMessage(contexts, maxLength = 1500) {
        const lines = [
            '可参考的毛选上下文：',
            '使用以下材料时，必须标明文章名；材料不够时要说明是方法论概括，不要编造出处。',
            ...contexts.map((context, index) => {
                const tags = context.methodologyTags.length ? `｜${context.methodologyTags.join('、')}` : '';
                const locator = context.sourceHref ? `｜定位：${context.sourceHref}` : '';
                return `${index + 1}. 《${context.sourceTitle}》${tags}${locator}：${context.text}`;
            }),
        ];

        return {
            role: 'system',
            content: lines.join('\n').slice(0, maxLength),
        };
    }

    function normalizeQuotes(quotes) {
        return (quotes || []).map((quote) => ({
            type: 'quote',
            sourceTitle: quote.source || '毛选',
            text: quote.content || '',
            methodologyTags: inferMethodologyTags(`${quote.category || ''} ${quote.content || ''} ${quote.source || ''}`),
        }));
    }

    function normalizeGuides(guides) {
        return (guides || []).map((guide) => ({
            type: 'guide',
            sourceTitle: guide.articleTitle || guide.title || '毛选导读',
            text: [
                guide.problem,
                ...(guide.coreIdeas || []),
                guide.practice,
            ].filter(Boolean).join(' '),
            methodologyTags: inferMethodologyTags([
                guide.articleTitle,
                guide.problem,
                ...(guide.coreIdeas || []),
                guide.practice,
            ].filter(Boolean).join(' ')),
        }));
    }

    function normalizePassages(passages) {
        return (passages || []).map((passage) => ({
            type: 'passage',
            sourceTitle: passage.title || '毛选原文',
            text: passage.text || '',
            sourceHref: passage.articleId && passage.anchor
                ? `reading.html?article=${encodeURIComponent(passage.articleId)}&anchor=${encodeURIComponent(passage.anchor)}`
                : '',
            methodologyTags: inferMethodologyTags(`${passage.title || ''} ${passage.text || ''}`),
        }));
    }

    function scoreContext(context, queryTokens, rawQuery) {
        const haystack = `${context.sourceTitle} ${context.text} ${context.methodologyTags.join(' ')}`;
        const tokenScore = queryTokens.reduce((total, token) => total + (haystack.includes(token) ? 2 : 0), 0);
        const methodScore = context.methodologyTags.reduce((total, tag) => {
            const keywords = METHOD_KEYWORDS.find(([name]) => name === tag)?.[1] || [];
            return total + (keywords.some((keyword) => rawQuery.includes(keyword)) ? 4 : 0);
        }, 0);

        return tokenScore + methodScore;
    }

    function inferMethodologyTags(text) {
        return METHOD_KEYWORDS
            .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
            .map(([tag]) => tag);
    }

    function tokenize(text) {
        const value = String(text || '');
        const tokens = new Set();

        METHOD_KEYWORDS.flatMap(([, keywords]) => keywords).forEach((keyword) => {
            if (value.includes(keyword)) {
                tokens.add(keyword);
            }
        });

        value
            .split(/[^\u4e00-\u9fa5A-Za-z0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2)
            .forEach((token) => tokens.add(token));

        value.split(/[^\u4e00-\u9fa5]+/).filter((token) => token.length >= 4).forEach((token) => {
            for (let index = 0; index <= token.length - 2; index += 1) {
                tokens.add(token.slice(index, index + 2));
            }
        });

        return [...tokens];
    }

    return {
        buildContextMessage,
        findRelevantMaoContexts,
    };
});
