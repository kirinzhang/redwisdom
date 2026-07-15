const assert = require('node:assert/strict');
const test = require('node:test');
const { STEPS, createGuidedCoach } = require('../js/guided-coach.js');

test('guided coach asks one question at a time and builds a final analysis prompt', () => {
    const coach = createGuidedCoach();
    assert.match(coach.getCurrentPrompt(), /发生了什么/);
    let result;
    ['想解决延期', '已经延期三次', '下次按时交付', '需求变化与固定工期', '统计变更次数', '团队三人'].forEach((answer) => {
        result = coach.answer(answer);
    });
    assert.equal(coach.isComplete(), true);
    assert.equal(result.complete, true);
    assert.match(result.finalPrompt, /现实问题：想解决延期/);
    assert.match(result.finalPrompt, /可用力量：团队三人/);
    assert.match(result.finalPrompt, /党史案例/);
    assert.equal(coach.getProgress().total, STEPS.length);
});

test('guided coach makes investigation concrete and permits uncertainty', () => {
    const investigationStep = STEPS.find((step) => step.key === 'investigation');
    assert.match(investigationStep.prompt, /要确认什么/);
    assert.match(investigationStep.prompt, /向谁询问或查什么记录/);
    assert.match(investigationStep.prompt, /暂时想不到/);
});

test('guided coach skips fields already known from a problem case', () => {
    const coach = createGuidedCoach({ realProblem: '是否换工作', facts: '收入没有变化' });
    assert.match(coach.getCurrentPrompt(), /什么可观察的变化/);
    assert.equal(coach.getProgress().completed, 2);
});

test('guided coach supports an English intake and final synthesis prompt', () => {
    const coach = createGuidedCoach({}, 'en');
    assert.match(coach.getCurrentPrompt(), /what happened/i);
    let result;
    ['late delivery', 'three missed dates', 'ship on time', 'scope versus deadline', 'count changes', 'three teammates'].forEach(answer => { result = coach.answer(answer); });
    assert.match(result.finalPrompt, /Real problem: late delivery/);
});
