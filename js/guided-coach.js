(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomGuidedCoach = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STEPS = [
        {
            key: 'realProblem',
            prompt: '先把问题落到一件具体事情上。请按这个格式回答：发生了什么；它影响了谁或什么；你现在最想解决哪一点。用两三句话即可。',
            promptEn: 'Make the problem concrete. Answer in three parts: what happened; who or what it affects; the one point you most need to solve now.',
        },
        {
            key: 'facts',
            prompt: '请把“已经确认的情况”和“你的推测或担心”分开写。比如：已确认＝截止日期是周五、对方退回过两次；推测＝对方可能不信任我。不确定的地方直接写“不确定”。',
            promptEn: 'Separate confirmed details from interpretations or worries. Example: confirmed = the deadline is Friday and the work was returned twice; interpretation = they may not trust me. Write “uncertain” where needed.',
        },
        {
            key: 'goal',
            prompt: '先不追求一次解决全部问题。未来一到两周出现什么可观察的变化，就说明方向开始有效？例如：按时交付一次、完成一次坦诚沟通、睡眠恢复到六小时。',
            promptEn: 'Do not try to solve everything at once. What observable change in the next one or two weeks would show that the direction is working?',
        },
        {
            key: 'mainContradiction',
            prompt: '如果只能先处理一个卡点，你认为是哪一个？可以写成“A需要……，但B却……”；例如“需求不断变化，但交付日期固定”。拿不准就列出两个候选，我来帮助判断。',
            promptEn: 'If you could address only one bottleneck first, what would it be? Use “A needs..., but B...” or list two candidates if you are unsure.',
        },
        {
            key: 'investigation',
            prompt: '为了决定下一步，你最需要确认哪一件事？请写：要确认什么；向谁询问或查什么记录；最晚什么时候能确认。例：“确认真正必须保留的需求；问负责人；今天下班前”。想不到可以直接回答“暂时想不到”，我会根据前面的材料提出调查建议。',
            promptEn: 'To choose the next step, what single thing most needs verification? Write: what to verify; whom to ask or which record to check; when you can confirm it. If nothing comes to mind, say “not sure” and I will propose an investigation.',
        },
        {
            key: 'availableForces',
            prompt: '列出现在已经能用的条件，不必理想化：可以帮忙的人、可支配时间、已有资料、预算、技能或过去成功过的做法。没有的项目可以不写。',
            promptEn: 'List conditions already available: people who can help, time, records, budget, skills, or approaches that worked before. Omit anything you do not have.',
        },
    ];

    function createGuidedCoach(seed = {}, locale = 'zh-CN') {
        const answers = {};
        STEPS.forEach((step) => {
            const value = sanitize(seed[step.key]);
            if (value) answers[step.key] = value;
        });
        let stepIndex = findNextStep(answers);

        return {
            getCurrentPrompt() {
                return stepIndex < STEPS.length ? getPrompt(STEPS[stepIndex], locale) : '';
            },
            getProgress() {
                return { completed: Object.keys(answers).length, total: STEPS.length, stepIndex };
            },
            isComplete() {
                return stepIndex >= STEPS.length;
            },
            answer(value) {
                if (stepIndex >= STEPS.length) return { complete: true, prompt: '', finalPrompt: buildFinalPrompt(answers, locale) };
                const normalized = sanitize(value);
                if (!normalized) return { complete: false, prompt: getPrompt(STEPS[stepIndex], locale), finalPrompt: '' };
                answers[STEPS[stepIndex].key] = normalized;
                stepIndex = findNextStep(answers);
                const complete = stepIndex >= STEPS.length;
                return {
                    complete,
                    prompt: complete ? '' : getPrompt(STEPS[stepIndex], locale),
                    finalPrompt: complete ? buildFinalPrompt(answers, locale) : '',
                };
            },
            getAnswers() {
                return { ...answers };
            },
        };
    }

    function findNextStep(answers) {
        const index = STEPS.findIndex((step) => !answers[step.key]);
        return index === -1 ? STEPS.length : index;
    }

    function buildFinalPrompt(answers, locale = 'zh-CN') {
        if (locale === 'en') {
            return [
                'Use the following structured intake to produce a complete practical analysis grounded in Selected Works of Mao Zedong. Separate facts from judgments, explain the basis and uncertainty of the main contradiction, cite verifiable source texts, compare the situation with a relevant CPC history case when one is provided, and propose one small action with a review standard. If the user wrote “not sure,” infer useful candidates instead of repeating the question.',
                `Real problem: ${answers.realProblem || 'Not provided'}`,
                `Known facts: ${answers.facts || 'Not provided'}`,
                `Desired result: ${answers.goal || 'Not provided'}`,
                `Tentative main contradiction: ${answers.mainContradiction || 'Not provided'}`,
                `Missing investigation: ${answers.investigation || 'Not provided'}`,
                `Available forces: ${answers.availableForces || 'Not provided'}`,
            ].join('\n');
        }
        return [
            '请根据以下逐步梳理的材料，使用毛选方法做一次完整但务实的综合分析。不要重复追问已经回答的内容；用户写“不确定”或“暂时想不到”时，要根据现有材料给出候选判断。请区分事实和判断，指出主要矛盾判断的依据与不确定性，引用可核对的原文出处；如提供了相关党史案例，要说明相似处、差异和可迁移方法；最后给出一个最小行动和复盘标准。',
            `现实问题：${answers.realProblem || '未说明'}`,
            `已知事实：${answers.facts || '未说明'}`,
            `期望结果：${answers.goal || '未说明'}`,
            `主要矛盾（用户初判）：${answers.mainContradiction || '未说明'}`,
            `待调查事实：${answers.investigation || '未说明'}`,
            `可用力量：${answers.availableForces || '未说明'}`,
        ].join('\n');
    }

    function getPrompt(step, locale) {
        return locale === 'en' ? step.promptEn : step.prompt;
    }

    function sanitize(value) {
        return String(value || '').trim().slice(0, 3000);
    }

    return { STEPS, buildFinalPrompt, createGuidedCoach };
});
