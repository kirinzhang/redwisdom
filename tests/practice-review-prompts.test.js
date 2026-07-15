const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');
const modulePath = path.join(rootDir, 'js/practice-review-prompts.js');
const reviewPrompts = fs.existsSync(modulePath) ? require(modulePath) : {};

test('buildReviewPrompts turns a practice record into Maoist review questions', () => {
    assert.equal(typeof reviewPrompts.buildReviewPrompts, 'function');

    const prompts = reviewPrompts.buildReviewPrompts({
        title: '验证拖延问题',
        realProblem: '计划总被临时消息打断',
        mainContradiction: '重要任务和即时消息之间的矛盾',
        investigationTodo: '记录两小时内被打断的次数',
        expectedResult: '今天完成一段连续 45 分钟深度工作',
        actualResult: '',
    });

    assert.deepEqual(prompts.map((prompt) => prompt.label), [
        '对照预期',
        '核对事实',
        '检查矛盾',
        '下一步',
    ]);
    assert.match(prompts[0].question, /今天完成一段连续 45 分钟深度工作/);
    assert.match(prompts[1].question, /记录两小时内被打断的次数/);
    assert.match(prompts[2].question, /重要任务和即时消息之间的矛盾/);
    assert.match(prompts[3].question, /下一步调查或行动/);
});

test('buildReviewPrompts supports English review coaching prompts', () => {
    const prompts = reviewPrompts.buildReviewPrompts({
        mainContradiction: 'important work versus instant messages',
        investigationTodo: 'count interruptions for two hours',
        expectedResult: 'finish one 45-minute focus block today',
        actualResult: '',
    }, 'en');

    assert.deepEqual(prompts.map((prompt) => prompt.label), [
        'Compare Expectation',
        'Check Facts',
        'Inspect Contradiction',
        'Next Step',
    ]);
    assert.match(prompts[0].question, /finish one 45-minute focus block today/);
    assert.match(prompts[1].question, /count interruptions for two hours/);
    assert.match(prompts[2].question, /important work versus instant messages/);
    assert.match(prompts[3].question, /next investigation or action/i);
});

test('practice page renders review prompts for each practice card', () => {
    const page = fs.readFileSync(path.join(rootDir, 'practice.html'), 'utf8');

    assert.match(page, /js\/practice-review-prompts\.js/);
    assert.match(page, /reviewPromptBlock\(practice, currentLocale\)/);
    assert.match(page, /function reviewPromptBlock\(practice, locale = currentLocale\)/);
    assert.match(page, /practice\.reviewPrompts/);
    assert.match(page, /对照预期/);
    assert.match(page, /核对事实/);
    assert.match(page, /检查矛盾/);
    assert.match(page, /下一步/);
});
