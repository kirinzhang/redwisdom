const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildDailyTrainingPlan } = require('../js/daily-training.js');

const rootDir = path.resolve(__dirname, '..');

test('daily training plan prioritizes review before new action and reading', () => {
    const plan = buildDailyTrainingPlan({
        practices: [
            {
                id: 'practice-done',
                title: '验证拖延问题',
                actionPlan: '今晚完成 25 分钟实验',
                status: 'done',
                reflection: '',
                updatedAt: '2026-06-29T02:00:00.000Z',
                methodologyTags: ['实践检验'],
            },
            {
                id: 'practice-active',
                title: '调查工作阻力',
                actionPlan: '问清楚一个事实',
                status: 'active',
                updatedAt: '2026-06-29T03:00:00.000Z',
                methodologyTags: ['调查研究'],
            },
        ],
        readingProgress: [
            {
                articleId: '016-实践论.md',
                articleTitle: '实践论',
                progressPercent: 42,
                updatedAt: '2026-06-29T04:00:00.000Z',
            },
        ],
        conversations: [{ id: 'conversation-1', title: '如何处理拖延', updatedAt: '2026-06-29T01:00:00.000Z' }],
        savedAnswers: [],
        savedQuotes: [],
    });

    assert.equal(plan.primary.type, 'review');
    assert.equal(plan.primary.title, '复盘：验证拖延问题');
    assert.equal(plan.primary.href, 'practice.html#practice-done');
    assert.equal(plan.secondary.some((item) => item.type === 'practice'), true);
    assert.equal(plan.secondary.some((item) => item.type === 'reading'), true);
    assert.deepEqual(plan.methodologyTags, [['实践检验', 1], ['调查研究', 1]]);
});

test('daily training plan keeps visitor mode useful when no archive exists', () => {
    const plan = buildDailyTrainingPlan({});

    assert.equal(plan.primary.type, 'draw-card');
    assert.equal(plan.primary.href, '#start-area');
    assert.equal(plan.stats.totalRecords, 0);
    assert.equal(plan.stats.activePractices, 0);
    assert.equal(plan.stats.pendingReviews, 0);
    assert.equal(plan.secondary[0].type, 'reading');
    assert.equal(plan.secondary[1].type, 'chat');
});

test('home page stays focused on drawing cards without the daily training panel', () => {
    const page = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const script = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');

    assert.doesNotMatch(page, /id="daily-training-panel"/);
    assert.doesNotMatch(page, /js\/daily-training\.js/);
    assert.doesNotMatch(script, /renderDailyTrainingPanel/);
    assert.doesNotMatch(script, /buildDailyTrainingPlan/);
});

test('profile page turns the full archive into a next training recommendation', () => {
    const page = fs.readFileSync(path.join(rootDir, 'me.html'), 'utf8');

    assert.match(page, /id="archiveTrainingPanel"/);
    assert.match(page, /js\/daily-training\.js/);
    assert.match(page, /renderArchiveTrainingPanel/);
    assert.match(page, /buildDailyTrainingPlan\(getLocalArchive\(\)\)/);
    assert.match(page, /下一步训练/);
    assert.match(page, /data-archive-training-primary/);
});

test('practice page exposes practice cards as hash targets for daily training links', () => {
    const page = fs.readFileSync(path.join(rootDir, 'practice.html'), 'utf8');

    assert.match(page, /<article[^>]+id="\$\{escapeAttribute\(practice\.id\)\}"[^>]+data-id="\$\{escapeAttribute\(practice\.id\)\}"/);
});
