const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'js/campaign-data.js'));
const timeline = require(path.join(root, 'js/timeline-data.js'));
const searchIndex = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8'));
const compact = (value) => String(value || '').replace(/\s+/g, '');

function inBox(campaign, [lon, lat], margin = 0.02) {
    const [l0, b0, l1, b1] = campaign.geo.bbox;
    return lon >= l0 - margin && lon <= l1 + margin && lat >= b0 - margin && lat <= b1 + margin;
}

test('campaigns have unique ids and complete metadata', () => {
    assert.ok(data.CAMPAIGNS.length >= 2);
    const ids = data.CAMPAIGNS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'campaign ids are unique');
    for (const c of data.CAMPAIGNS) {
        assert.match(c.id, /^[a-z0-9-]+$/, `${c.id} is url-safe`);
        assert.ok(c.title && c.period && c.summary, `${c.id} has title, period and summary`);
        assert.match(c.startDate, /^\d{4}-\d{2}-\d{2}$/, `${c.id} has an ISO start date`);
        assert.ok(c.maxDay > 0, `${c.id} has a positive duration`);
        assert.ok(['draft', 'source-reviewed', 'editor-approved'].includes(c.review.status), `${c.id} declares a review status`);
    }
});

test('chapters run in order and every move names a known faction', () => {
    for (const c of data.CAMPAIGNS) {
        assert.equal(c.chapters[0].day, 0, `${c.id} starts at day 0`);
        c.chapters.forEach((chapter, i) => {
            assert.ok(chapter.title && chapter.date && chapter.text, `${c.id}/${chapter.title} is complete`);
            assert.ok(chapter.day >= 0 && chapter.day < c.maxDay, `${c.id}/${chapter.title} falls inside the campaign`);
            if (i > 0) assert.ok(chapter.day > c.chapters[i - 1].day, `${c.id}/${chapter.title} comes after the previous chapter`);
            assert.ok(chapter.moves.length > 0, `${c.id}/${chapter.title} lists at least one side's move`);
            for (const [faction, tag, text] of chapter.moves) {
                assert.ok(c.factions[faction], `${c.id}/${chapter.title} uses known faction ${faction}`);
                assert.ok(tag && text, `${c.id}/${chapter.title} move has a tag and text`);
            }
        });
        for (const [faction, rows] of c.profiles) {
            assert.ok(c.factions[faction], `${c.id} profile ${faction} is a known faction`);
            assert.ok(rows.length > 0, `${c.id} profile ${faction} has rows`);
        }
    }
});

test('units, markers and overlays stay on the sandbox and in time order', () => {
    for (const c of data.CAMPAIGNS) {
        assert.equal(c.units.filter((u) => u.main).length, 1, `${c.id} has exactly one main unit`);
        for (const unit of c.units) {
            assert.ok(c.factions[unit.faction], `${c.id} unit faction ${unit.faction} is known`);
            unit.k.forEach((key, i) => {
                assert.ok(key[0] >= 0 && key[0] <= c.maxDay, `${c.id} keyframe day ${key[0]} is in range`);
                if (i > 0) assert.ok(key[0] > unit.k[i - 1][0], `${c.id} ${unit.label || unit.faction} keyframes are ordered`);
                assert.ok(inBox(c, [key[1], key[2]]), `${c.id} ${unit.label || unit.faction} stays on the map at day ${key[0]}`);
            });
        }
        for (const marker of c.markers) {
            for (const point of [marker.at, marker.a, marker.b].filter(Boolean)) assert.ok(inBox(c, point), `${c.id} marker ${marker.label || marker.type} is on the map`);
        }
        for (const [name, lon, lat] of c.geo.places) assert.ok(inBox(c, [lon, lat]), `${c.id} place ${name} is on the map`);
        for (const overlay of c.overlays) {
            for (const point of [overlay.at, overlay.labelAt, ...(overlay.nodes || [])].filter(Boolean)) assert.ok(inBox(c, point, 0.1), `${c.id} overlay ${overlay.label || overlay.text} is on the map`);
        }
    }
});

test('every Mao Selected Works reference resolves to an indexed passage that contains the quote', () => {
    let count = 0;
    for (const c of data.CAMPAIGNS) {
        for (const chapter of c.chapters) {
            for (const ref of chapter.refs || []) {
                count += 1;
                const record = searchIndex.records.find((r) => r.articleId === ref.articleId && r.anchor === ref.anchor);
                assert.ok(record, `${c.id}/${chapter.title} anchor ${ref.anchor} exists in ${ref.articleId}`);
                assert.ok(compact(record.text).includes(compact(ref.quote)), `${c.id}/${chapter.title} quote appears in the cited passage`);
            }
        }
        const ask = c.method.askQuote;
        assert.ok(searchIndex.records.some((r) => compact(r.text).includes(compact(ask))), `${c.id} ask quote is real Mao text`);
    }
    assert.ok(count >= 8, `campaigns cite enough passages (${count})`);
});

test('method review separates judgment, transfer and limits, with checkable sources', () => {
    const allowedHosts = ['cpc.people.com.cn', 'www.news.cn', 'www.12371.cn', 'www.cac.gov.cn', 'www.chinawriter.com.cn'];
    for (const c of data.CAMPAIGNS) {
        const m = c.method;
        assert.ok(m.contradiction && m.limits, `${c.id} states the main contradiction and limits`);
        assert.ok(m.judgments.length >= 3 && m.transfer.length >= 2, `${c.id} lists judgments and transferable methods`);
        assert.ok(c.sources.length >= 1, `${c.id} cites at least one source`);
        for (const source of c.sources) assert.ok(allowedHosts.includes(new URL(source.url).hostname), `${c.id} source ${source.url} is an authoritative host`);
    }
});

test('timeline links only to campaigns that exist', () => {
    const ids = new Set(data.CAMPAIGNS.map((c) => c.id));
    const linked = [];
    for (const period of timeline.PERIODS) for (const stage of period.stages) for (const event of stage.events) if (event.campaign) linked.push(event.campaign);
    for (const point of timeline.DECISION_POINTS) if (point.campaign) linked.push(point.campaign);
    assert.ok(linked.length >= 2, 'timeline links to the sandbox');
    for (const id of linked) assert.ok(ids.has(id), `timeline campaign ${id} exists`);
});

test('campaign page loads its scripts and is cached for offline use', () => {
    const page = fs.readFileSync(path.join(root, 'campaign.html'), 'utf8');
    for (const script of ['js/campaign-data.js', 'js/campaign-engine.js', 'js/campaign.js']) {
        assert.ok(page.includes(`src="${script}"`), `campaign.html loads ${script}`);
    }
    const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    for (const file of ['./campaign.html', './js/campaign-data.js', './js/campaign-engine.js', './js/campaign.js']) {
        assert.ok(worker.includes(`'${file}'`), `service worker caches ${file}`);
    }
});

test('decision points are well formed and cite real passages', () => {
    let total = 0;
    for (const c of data.CAMPAIGNS) {
        assert.ok((c.decisions || []).length >= 1, `${c.id} has at least one decision point`);
        c.decisions.forEach((d, i) => {
            total += 1;
            assert.ok(d.day > 0 && d.day < c.maxDay, `${c.id} decision ${i} is inside the campaign`);
            if (i > 0) assert.ok(d.day > c.decisions[i - 1].day, `${c.id} decisions are in time order`);
            assert.ok(d.title && d.situation && d.question && d.reveal, `${c.id}/${d.title} is complete`);
            assert.ok(d.options.length >= 2 && d.options.length <= 4, `${c.id}/${d.title} has 2-4 options`);
            assert.ok(d.options.every((o) => o.label && o.note), `${c.id}/${d.title} options explain their trade-offs`);
            assert.ok(Number.isInteger(d.answer) && d.answer >= 0 && d.answer < d.options.length, `${c.id}/${d.title} marks the historical choice`);
            if (d.ref) {
                const record = searchIndex.records.find((r) => r.articleId === d.ref.articleId && r.anchor === d.ref.anchor);
                assert.ok(record && compact(record.text).includes(compact(d.ref.quote)), `${c.id}/${d.title} quote is verbatim`);
            }
        });
    }
    assert.ok(total >= 12, `enough decision points (${total})`);
});

test('the campaign list follows the Long March in time order and has a featured default', () => {
    const dates = data.CAMPAIGNS.map((c) => c.startDate);
    assert.deepEqual([...dates].sort(), dates);
    assert.equal(data.defaultCampaign().id, 'sidu-chishui');
    for (const id of ['xiangjiang', 'jinsha-river', 'lazikou', 'zhiluozhen']) assert.ok(data.getCampaign(id), `${id} exists`);
});

test('concept cards only link to campaigns that exist', () => {
    const concepts = JSON.parse(fs.readFileSync(path.join(root, 'data/concepts.json'), 'utf8')).concepts;
    const linked = concepts.flatMap((c) => c.campaigns || []);
    assert.ok(linked.length >= 5, 'concepts link into the sandbox');
    for (const item of linked) assert.ok(data.getCampaign(item.id), `concept links existing campaign ${item.id}`);
});
