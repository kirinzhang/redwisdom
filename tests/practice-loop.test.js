const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const { createProblemCaseStore, getInvestigations } = require('../js/problem-case-store.js');
const { buildCognitionSpiral } = require('../js/cognition-spiral.js');
const { pushArchiveToSupabase, mapProblemCaseToCloudRow, mapCloudRowToProblemCase } = require('../js/cloud-sync.js');

function memory() {
    const data = new Map();
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}
function clock(start = Date.parse('2026-10-01T00:00:00Z')) {
    let t = start;
    return { now: () => t, tick: (ms = 60000) => { t += ms; } };
}

test('investigation checklist records questions, findings and verdicts', () => {
    const c = clock();
    const store = createProblemCaseStore(memory(), c.now);
    const pc = store.createCase({ title: '客户流失' });
    c.tick();
    let updated = store.addInvestigation(pc.id, { question: '客户流失主要因为价格', source: '最近流失的五位客户', method: '电话回访' });
    assert.equal(updated.stage, 'investigate', 'adding an investigation moves the case into the investigate stage');
    assert.deepEqual(updated.investigationTasks, ['客户流失主要因为价格'], 'pending questions stay mirrored for older features');
    const inv = updated.investigations[0];
    c.tick();
    updated = store.updateInvestigation(pc.id, inv.id, { finding: '五位中四位提到响应慢，只有一位提价格', verdict: 'refuted' });
    assert.equal(updated.investigations[0].verdict, 'refuted');
    assert.ok(updated.investigations[0].resolvedAt);
    assert.deepEqual(updated.investigationTasks, []);
    assert.equal(updated.activities[0].type, 'evidence');
    assert.match(updated.activities[0].title, /推翻/);
    assert.match(updated.activities[0].detail, /响应慢/);
    updated = store.removeInvestigation(pc.id, inv.id);
    assert.equal(updated.investigations.length, 0);
});

test('legacy to-do lines become pending investigation items', () => {
    const items = getInvestigations({ investigationTasks: ['统计变更次数', '访谈项目负责人'], updatedAt: '2026-01-01T00:00:00Z' });
    assert.deepEqual(items.map((i) => [i.question, i.verdict]), [['统计变更次数', 'pending'], ['访谈项目负责人', 'pending']]);
});

test('contradiction map keeps the ranking, syncs the main contradiction and records shifts', () => {
    const c = clock();
    const store = createProblemCaseStore(memory(), c.now);
    const pc = store.createCase({ title: '项目延期' });
    c.tick();
    let updated = store.saveContradictionMap(pc.id, { items: [{ text: '需求变化快 与 交付固定' }, { text: '人手不足' }], mainAspect: '需求变化一方' }, { recordVersion: true, note: '第一次梳理' });
    assert.equal(updated.mainContradiction, '需求变化快 与 交付固定');
    assert.equal(updated.contradictionMap.versions.length, 1);
    assert.equal(updated.stage, 'analyze');
    assert.equal(updated.activities[0].title, '记录矛盾分析');
    c.tick();
    updated = store.saveContradictionMap(pc.id, { items: [{ text: '人手不足' }, { text: '需求变化快 与 交付固定' }] }, { recordVersion: true, note: '需求已冻结' });
    assert.equal(updated.mainContradiction, '人手不足');
    assert.equal(updated.activities[0].title, '主要矛盾转移');
    assert.match(updated.activities[0].detail, /由“需求变化快 与 交付固定”转为“人手不足”/);
    c.tick();
    updated = store.saveContradictionMap(pc.id, { items: [{ text: '人手不足' }] });
    assert.equal(updated.contradictionMap.versions.length, 2, 'reordering without recording does not add a version');
});

test('cognition spiral splits the record into rounds at each review', () => {
    const c = clock();
    const store = createProblemCaseStore(memory(), c.now);
    const pc = store.createCase({ title: '团队内耗' });
    c.tick();
    store.saveContradictionMap(pc.id, { items: [{ text: '目标不清' }] }, { recordVersion: true });
    c.tick();
    let updated = store.addInvestigation(pc.id, { question: '大家对目标理解不同' });
    c.tick();
    store.addActivity(pc.id, { type: 'practice', title: '开一次目标对齐会' });
    c.tick();
    store.updateInvestigation(pc.id, updated.investigations[0].id, { verdict: 'confirmed', finding: '五人说出三种目标' });
    c.tick();
    store.addReview(pc.id, { expectedResult: '争论减少', actualResult: '争论减少一半', evidence: '周会记录', reflection: '目标对齐有效，但分工仍不清', nextAction: '明确分工' });
    c.tick();
    store.saveContradictionMap(pc.id, { items: [{ text: '分工不清' }, { text: '目标不清' }] }, { recordVersion: true, note: '复盘后' });
    c.tick();
    updated = store.addActivity(pc.id, { type: 'practice', title: '画出职责表' });

    const spiral = buildCognitionSpiral(updated);
    assert.equal(spiral.rounds.length, 2);
    const [first, second] = spiral.rounds;
    assert.equal(first.status, 'done');
    assert.equal(first.knowing.mainContradiction, '目标不清');
    assert.deepEqual(first.knowing.questions, ['大家对目标理解不同']);
    assert.equal(first.practice.expected, '争论减少');
    assert.equal(first.test.checked[0].verdictLabel, '证实');
    assert.match(first.rethink.reflection, /分工仍不清/);
    assert.equal(second.status, 'ongoing');
    assert.deepEqual(second.rethink.shift, { from: '目标不清', to: '分工不清' });
    assert.equal(spiral.stats.rounds, 1);
    assert.equal(spiral.shifts.length, 1);
});

test('a brand-new case shows a single ongoing round', () => {
    const spiral = buildCognitionSpiral({ createdAt: '2026-10-01T00:00:00Z', activities: [] });
    assert.equal(spiral.rounds.length, 1);
    assert.equal(spiral.rounds[0].status, 'ongoing');
});

test('new fields round-trip through cloud rows', () => {
    const local = { id: 'p1', title: 't', investigations: [{ id: 'i1', question: 'q', verdict: 'pending' }], contradictionMap: { items: [{ id: 'c1', text: 'x' }], versions: [] } };
    const row = mapProblemCaseToCloudRow('u1', local);
    assert.deepEqual(row.investigations, local.investigations);
    assert.deepEqual(row.contradiction_map, local.contradictionMap);
    const back = mapCloudRowToProblemCase(row);
    assert.deepEqual(back.investigations, local.investigations);
    assert.deepEqual(back.contradictionMap, local.contradictionMap);
});

test('sync keeps working when the cloud table has not been migrated yet', async () => {
    const attempts = [];
    const client = {
        from(table) {
            return {
                upsert: async (rows) => {
                    attempts.push({ table, keys: Object.keys(rows[0] || {}) });
                    if (table === 'problem_cases' && Object.keys(rows[0]).includes('investigations')) {
                        return { error: { message: "Could not find the 'investigations' column of 'problem_cases' in the schema cache" } };
                    }
                    return { error: null };
                },
            };
        },
    };
    const warn = console.warn; console.warn = () => {};
    try {
        const counts = await pushArchiveToSupabase(client, 'u1', { problemCases: [{ id: 'p1', title: '问题' }] });
        assert.equal(counts.problemCases, 1);
    } finally { console.warn = warn; }
    const pcAttempts = attempts.filter((a) => a.table === 'problem_cases');
    assert.equal(pcAttempts.length, 2);
    assert.ok(!pcAttempts[1].keys.includes('investigations') && !pcAttempts[1].keys.includes('contradiction_map'));
});

test('problems page mounts the three practice-loop sections', () => {
    const page = fs.readFileSync(path.join(root, 'problems.html'), 'utf8');
    for (const id of ['investigationSection', 'contradictionSection', 'spiralSection', 'spiralSvg', 'recordVersionBtn']) assert.match(page, new RegExp(`id="${id}"`));
    assert.match(page, /src="js\/cognition-spiral\.js"/);
    assert.match(page, /src="js\/practice-loop-ui\.js"/);
    assert.match(page, /RedWisdomPracticeLoopUI\.mount/);
    const migration = fs.readFileSync(path.join(root, 'docs/database/migrations/2026-10-04-practice-loop.sql'), 'utf8');
    assert.match(migration, /add column if not exists investigations jsonb/);
});
