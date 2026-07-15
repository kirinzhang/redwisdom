(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomPracticeReviewPrompts = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function buildReviewPrompts(practice = {}, locale = 'zh-CN') {
        const expectedResult = sanitizeText(practice.expectedResult);
        const actualResult = sanitizeText(practice.actualResult);
        const investigationTodo = sanitizeText(practice.investigationTodo);
        const mainContradiction = sanitizeText(practice.mainContradiction);

        if (locale === 'en') {
            return [
                {
                    label: 'Compare Expectation',
                    question: expectedResult
                        ? `The review standard was "${expectedResult}". Did the actual result meet it? Where is the gap?`
                        : 'First write the actual result, then compare it with the original action plan.',
                },
                {
                    label: 'Check Facts',
                    question: investigationTodo
                        ? `The missing investigation was "${investigationTodo}". Which facts did you verify today? Which key fact is still unclear?`
                        : 'What new facts did you get today? Which judgments are still guesses?',
                },
                {
                    label: 'Inspect Contradiction',
                    question: mainContradiction
                        ? `The original main contradiction was "${mainContradiction}". Did practice prove that judgment accurate? Is there a more important contradiction now?`
                        : 'From the actual result, what is the main contradiction now?',
                },
                {
                    label: 'Next Step',
                    question: actualResult
                        ? 'Based on the result, facts, and contradiction, what is the next investigation or action? Make it as small as possible.'
                        : 'Based on the facts and contradiction above, what is the next investigation or action? Make it as small as possible.',
                },
            ];
        }

        return [
            {
                label: '对照预期',
                question: expectedResult
                    ? `原来的复盘标准是“${expectedResult}”。实际结果是否达到？差在哪里？`
                    : '先写清实际结果，再说明它和原来的行动计划相比有什么差异。',
            },
            {
                label: '核对事实',
                question: investigationTodo
                    ? `原来缺少的调查是“${investigationTodo}”。今天补到了哪些事实？还有哪一条事实没弄清？`
                    : '今天新获得了哪些事实？哪些判断仍只是猜测？',
            },
            {
                label: '检查矛盾',
                question: mainContradiction
                    ? `原来判断的主要矛盾是“${mainContradiction}”。实际过程证明这个判断准确吗？有没有更主要的矛盾？`
                    : '从实际结果看，当前最主要的矛盾是什么？',
            },
            {
                label: '下一步',
                question: actualResult
                    ? '基于实际结果、事实和矛盾，下一步调查或行动是什么？越小越好。'
                    : '基于上面的事实和矛盾，下一步调查或行动是什么？越小越好。',
            },
        ];
    }

    function sanitizeText(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 240);
    }

    return {
        buildReviewPrompts,
    };
});
