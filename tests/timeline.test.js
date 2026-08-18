const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const timeline = require(path.join(root, 'js/timeline-data.js'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));

function collectArticleRefs() {
    const refs = [];
    for (const period of timeline.PERIODS) {
        for (const stage of period.stages) {
            for (const event of stage.events) {
                for (const title of event.articles || []) refs.push(title);
            }
        }
    }
    for (const point of timeline.DECISION_POINTS) {
        for (const title of point.articles || []) refs.push(title);
    }
    return refs;
}

test('timeline data exposes four periods with stages and events', () => {
    assert.equal(timeline.PERIODS.length, 4);
    for (const period of timeline.PERIODS) {
        assert.ok(period.id && period.label && period.range && period.intro, `${period.label} 有完整元信息`);
        assert.ok(period.stages.length > 0, `${period.label} 至少有一个阶段`);
        for (const stage of period.stages) {
            assert.ok(stage.label && stage.range, `${period.label}/${stage.label} 有阶段信息`);
            assert.ok(stage.events.length > 0, `${period.label}/${stage.label} 至少有一个事件`);
            for (const event of stage.events) {
                assert.ok(event.date && event.title && event.summary, `${period.label}/${stage.label}/${event.title} 有日期、标题和摘要`);
            }
        }
    }
});

test('every article referenced by the timeline exists in catalog.json', () => {
    const catalogTitles = new Set();
    for (const articles of Object.values(catalog.volumes || {})) {
        for (const article of articles) catalogTitles.add(article.title);
    }

    const refs = collectArticleRefs();
    assert.ok(refs.length > 50, `有足够多的文章引用（当前 ${refs.length}）`);
    const missing = [...new Set(refs.filter((title) => !catalogTitles.has(title)))];
    assert.deepEqual(missing, [], '所有引用文章都应在目录中');
});

test('events are tagged with battles and military actions for filtering', () => {
    const battles = new Set();
    let battleCount = 0;

    for (const period of timeline.PERIODS) {
        for (const stage of period.stages) {
            for (const event of stage.events) {
                assert.equal('people' in event, false, `事件不再带人物标签（${event.title}）`);
                for (const name of event.battles || []) {
                    assert.ok(name && typeof name === 'string', '战役标签为非空字符串');
                    battles.add(name);
                }
                if (event.battles?.length) battleCount += 1;
            }
        }
    }

    assert.ok(battleCount >= 10, `至少 10 条事件有战役标签（当前 ${battleCount}）`);
    assert.ok(battles.has('长征') && battles.has('三大战役') && battles.has('抗美援朝'), '包含关键战役');
});

test('decision points and quick reference data are populated', () => {
    assert.ok(timeline.DECISION_POINTS.length >= 10, '至少 10 个决策点');
    for (const point of timeline.DECISION_POINTS) {
        assert.ok(point.title && point.conflict && point.outcome && point.lesson, `${point.title} 有完整字段`);
        assert.ok(point.background && point.background.length >= 30, `${point.title} 有背景介绍（当前 ${point.background ? point.background.length : 0} 字）`);
    }
    assert.ok(timeline.CONGRESSES.some((c) => c.n === '一大'), '包含一大');
    assert.ok(timeline.CONGRESSES.some((c) => c.n === '二十大'), '包含二十大');
    assert.equal(timeline.RESOLUTIONS.length, 3, '三个历史决议');
    assert.ok(timeline.ANNIVERSARIES.length >= 5, '纪念日列表非空');
});
