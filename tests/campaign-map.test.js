const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'js/campaign-data.js'));
const searchIndex = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8'));
const compact = (value) => String(value || '').replace(/\s+/g, '');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const terrainIndex = readJson('data/terrain/index.json');

function within([l0, b0, l1, b1], [lon, lat]) {
    return lon >= l0 && lon <= l1 && lat >= b0 && lat <= b1;
}

test('every sandbox has real terrain and vector map data covering its area', () => {
    for (const c of [...data.CAMPAIGNS, data.OVERVIEW]) {
        const key = c.geo.map || c.id;
        const meta = terrainIndex[key];
        assert.ok(meta, `${key} is in the terrain index`);
        const [l0, b0, l1, b1] = meta.bbox;
        assert.equal(meta.w, Math.round((l1 - l0) / meta.res) + 1, `${key} terrain width matches its bbox`);
        assert.equal(meta.h, Math.round((b1 - b0) / meta.res) + 1, `${key} terrain height matches its bbox`);
        const bin = fs.readFileSync(path.join(root, `data/terrain/${key}.bin`));
        assert.equal(bin.length, meta.w * meta.h * 2, `${key} terrain is Int16 w×h`);
        const [g0, h0, g1, h1] = c.geo.bbox;
        if (!c.geo.overview) {
            assert.ok(l0 < g0 && b0 < h0 && l1 > g1 && b1 > h1, `${key} terrain extends beyond the campaign so the edges can fade out`);
        }
        const vec = readJson(`data/map/${key}.json`);
        for (const layer of ['provinces', 'rivers', 'labels']) assert.ok(Array.isArray(vec[layer]), `${key} map has ${layer}`);
        assert.ok(vec.rivers.every((r) => r.pts.length >= 2 && r.pts.every((p) => within(meta.bbox.map((v, i) => v + (i < 2 ? -1.2 : 1.2)), p))), `${key} rivers are clipped to the terrain`);
    }
});

test('terrain heights are plausible for the places on each map', () => {
    const sample = (key, lon, lat) => {
        const meta = terrainIndex[key], buf = fs.readFileSync(path.join(root, `data/terrain/${key}.bin`));
        const x = Math.round((lon - meta.bbox[0]) / meta.res), y = Math.round((meta.bbox[3] - lat) / meta.res);
        return buf.readInt16LE((y * meta.w + x) * 2);
    };
    assert.ok(sample('overview', 88, 32) > 4000, 'Tibetan plateau is high');
    assert.ok(sample('overview', 125, 30) < 0, 'East China Sea is below sea level');
    assert.ok(sample('dadu-river', 101.88, 29.6) > 4000, 'Gongga massif is high');
    assert.ok(sample('sidu-chishui', 106.93, 27.7) > 600 && sample('sidu-chishui', 106.93, 27.7) < 1400, 'Zunyi sits on the Guizhou plateau');
});

test('the national map keeps China whole, with the South China Sea islands inset', () => {
    const vec = readJson('data/map/overview.json');
    assert.ok(vec.land.length > 0 && vec.border.length > 0 && vec.coast.length > 0, 'overview has land, border and coast');
    const names = new Set(vec.labels.map((l) => l.name));
    for (const name of ['台湾', '西藏', '新疆', '香港', '澳门', '海南']) assert.ok(names.has(name), `${name} is labelled`);
    assert.ok(vec.scs && vec.scs.dash.length >= 9, 'South China Sea inset carries the dashed line');
});

test('the Long March overview reuses each campaign route and links into every sandbox', () => {
    const O = data.OVERVIEW;
    assert.equal(data.getCampaign(O.id), O);
    assert.equal(O.units.filter((u) => u.main).length, 1);
    const main = O.units.find((u) => u.main);
    main.k.forEach((key, i) => {
        if (i > 0) assert.ok(key[0] > main.k[i - 1][0], `overview keyframes are ordered at day ${key[0]}`);
        assert.ok(within(O.geo.bbox, [key[1], key[2]]), `overview route stays on the map at day ${key[0]}`);
    });
    assert.ok(main.k[main.k.length - 1][0] <= O.maxDay);
    for (const c of data.CAMPAIGNS) {
        const off = data.dayOffset(c.startDate);
        const cm = c.units.find((u) => u.main);
        assert.ok(main.k.some((k) => k[0] === off + cm.k[0][0] && k[1] === cm.k[0][1] && k[2] === cm.k[0][2]), `overview passes through ${c.id}`);
        assert.ok(O.markers.some((m) => m.type === 'campaign' && m.id === c.id && m.day === off), `overview links to ${c.id}`);
        assert.ok(O.chapters.some((ch) => ch.campaign === c.id), `an overview chapter opens ${c.id}`);
    }
    O.chapters.forEach((ch, i) => {
        if (i > 0) assert.ok(ch.day > O.chapters[i - 1].day, `${ch.title} is in order`);
        for (const [faction] of ch.moves) assert.ok(O.factions[faction], `${ch.title} uses a known faction`);
        for (const ref of ch.refs || []) {
            const record = searchIndex.records.find((r) => r.articleId === ref.articleId && r.anchor === ref.anchor);
            assert.ok(record && compact(record.text).includes(compact(ref.quote)), `${ch.title} quote is verbatim`);
        }
    });
    for (const d of O.decisions) {
        assert.ok(d.day > 0 && d.day < O.maxDay && d.options[d.answer], `${d.title} is well formed`);
        if (d.ref) {
            const record = searchIndex.records.find((r) => r.articleId === d.ref.articleId && r.anchor === d.ref.anchor);
            assert.ok(record && compact(record.text).includes(compact(d.ref.quote)), `${d.title} quote is verbatim`);
        }
    }
    assert.ok(searchIndex.records.some((r) => compact(r.text).includes(compact(O.method.askQuote))), 'overview ask quote is real Mao text');
    assert.equal(data.dateForDay(O, 374).toDateString(), new Date(1935, 9, 19).toDateString(), 'day 374 is the arrival at Wuqi');
});

test('the home page links to the party history timeline and the Long March sandbox', () => {
    const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(page, /<a href="timeline\.html" data-entry="timeline"/);
    assert.match(page, /<a href="campaign\.html" data-entry="sandbox"/);
    const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    for (const file of ['./data/terrain/index.json', './data/terrain/overview.bin', './data/map/overview.json']) assert.ok(worker.includes(`'${file}'`), `service worker caches ${file}`);
});
