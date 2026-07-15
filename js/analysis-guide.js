(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomAnalysisGuide = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function normalizeAnalysisInput(input) {
        const normalized = {
            realProblem: sanitizeText(input?.realProblem),
            facts: sanitizeText(input?.facts),
            mainContradiction: sanitizeText(input?.mainContradiction),
            investigationTodo: sanitizeText(input?.investigationTodo),
            availableForces: sanitizeText(input?.availableForces),
            actionPlan: sanitizeText(input?.actionPlan),
            reviewQuestion: sanitizeText(input?.reviewQuestion),
        };

        normalized.methodologyTags = inferTags(normalized);
        return normalized;
    }

    function buildGuidedAnalysisPrompt(input) {
        const analysis = normalizeAnalysisInput(input);
        const lines = [
            '请按毛选方法论，作为实践教练，帮我分析下面这个现实问题。',
            '',
            `现实问题：${analysis.realProblem || '未填写'}`,
            `事实材料：${analysis.facts || '未填写'}`,
            `主要矛盾：${analysis.mainContradiction || '未填写'}`,
            `缺少的调查：${analysis.investigationTodo || '未填写'}`,
            `可用力量：${analysis.availableForces || '未填写'}`,
            `今日实践：${analysis.actionPlan || '未填写'}`,
            `复盘问题：${analysis.reviewQuestion || '未填写'}`,
            '',
            '请先追问我最缺失的一条事实，再用“调查研究、主要矛盾、力量分析、今日行动、复盘标准”的结构给出指导。',
            '如果我的材料不足，请指出哪些判断还是想象，不要直接替我下结论。',
        ];

        return lines.join('\n');
    }

    function buildPracticeDraftFromAnalysis(input) {
        const analysis = normalizeAnalysisInput(input);

        return {
            title: `用毛选方法处理：${analysis.realProblem || '现实问题'}`,
            realProblem: analysis.realProblem,
            sourceType: 'analysis-guide',
            sourceTitle: '毛选方法分析向导',
            sourceHref: 'chat.html',
            relatedQuote: '',
            methodologyTags: analysis.methodologyTags,
            mainContradiction: analysis.mainContradiction,
            investigationTodo: analysis.investigationTodo,
            availableForces: analysis.availableForces,
            actionPlan: analysis.actionPlan || '先补一条关键事实，再决定今天能完成的一步。',
            expectedResult: analysis.reviewQuestion ? `复盘标准：${analysis.reviewQuestion}` : '',
        };
    }

    function inferTags(analysis) {
        const tags = [];

        if (analysis.facts || analysis.investigationTodo) addUnique(tags, '调查研究');
        if (analysis.mainContradiction) addUnique(tags, '主要矛盾');
        if (analysis.availableForces || analysis.actionPlan) addUnique(tags, '实践检验');
        if (analysis.reviewQuestion) addUnique(tags, '复盘');

        if (!tags.length) {
            addUnique(tags, '实践检验');
        }

        return tags;
    }

    function addUnique(list, value) {
        if (value && !list.includes(value)) {
            list.push(value);
        }
    }

    function sanitizeText(value) {
        return String(value || '').trim().slice(0, 5000);
    }

    return {
        buildGuidedAnalysisPrompt,
        buildPracticeDraftFromAnalysis,
        normalizeAnalysisInput,
    };
});
