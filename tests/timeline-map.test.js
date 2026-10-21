const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'js/timeline-data.js'));
const tm = require(path.join(root, 'js/timeline-map.js'));
const overview = JSON.parse(fs.readFileSync(path.join(root, 'data/terrain/index.json'), 'utf8')).overview;

test('event dates in all the timeline spellings parse to a start date', () => {
    assert.deepEqual(tm.parseEventDate('1921.7.23'), { year: 1921, month: 7, day: 23, value: 1921 + 6 / 12 });
    assert.equal(tm.parseEventDate('1927.4–7').month, 4);
    assert.equal(tm.parseEventDate('1945.8.15 / 9.2').day, 15);
    assert.equal(tm.parseEventDate('1956 年底').month, 12);
    assert.equal(tm.parseEventDate('1933.9–1934.10').year, 1933);
    assert.equal(tm.parseEventDate('2026').month, null);
    assert.equal(tm.parseEventDate('不详'), null);
});

test('every event either has a place on the map or says where it happened', () => {
    const [l0, b0, l1, b1] = overview.bbox;
    for (const [name, [lon, lat]] of Object.entries(data.PLACES)) {
        assert.ok(lon > l0 && lon < l1 && lat > b0 && lat < b1, `${name} is on the national map`);
    }
    for (const period of data.PERIODS) for (const stage of period.stages) for (const event of stage.events) {
        const places = event.place ? [].concat(event.place) : [];
        for (const name of places) assert.ok(data.PLACES[name], `${event.title}: place ${name} has coordinates`);
        assert.ok(places.length || event.placeNote, `${event.title} has a place or a place note`);
    }
});

test('map events run in date order and the scene marks every located event', () => {
    const events = tm.buildMapEvents(data);
    assert.ok(events.length >= 45, `enough events (${events.length})`);
    assert.equal(events[0].title, '五四运动', 'the map starts with the May Fourth Movement');
    assert.equal(events[events.length - 1].title, '中华人民共和国成立', 'the map ends with the founding of the PRC');
    assert.ok(events.every((e) => e.year <= 1949), 'the map stops at 1949');
    assert.ok(tm.buildMapEvents(data, { until: 2100 }).length > events.length, 'later events stay in the data for the list view');
    events.forEach((e, i) => {
        assert.equal(e.index, i);
        if (i > 0) assert.ok(e.value >= events[i - 1].value, `${e.title} is not earlier than ${events[i - 1].title}`);
    });
    const located = events.filter((e) => e.places.length);
    assert.ok(located.length / events.length > 0.9, 'almost every revolutionary-era event is located');
    assert.ok(events.filter((e) => e.major).length >= 15, 'major events are flagged for the axis');
    const scene = tm.buildScene(events);
    assert.equal(scene.maxDay, events.length - 1);
    assert.equal(scene.units.length, 0);
    assert.equal(scene.markers.length, located.reduce((n, e) => n + e.places.length, 0));
    for (const m of scene.markers) assert.equal(events[m.day].id, m.id);
    const zunyi = events.find((e) => e.title === '遵义会议');
    assert.deepEqual(zunyi.places.map((p) => p.name), ['遵义']);
    assert.equal(tm.shortTitle('中共一大（上海→嘉兴南湖）'), '中共一大');
    const marks = tm.decadeMarks(events);
    assert.equal(marks[0].label, '1919');
    assert.deepEqual(tm.stageBands(events).map((b) => b.label), ['建党与大革命', '土地革命战争', '全民族抗日战争', '解放战争']);
    assert.equal(tm.compactDate({ date: '1945.8.15 / 9.2' }), '1945.8');
    assert.equal(tm.compactDate({ date: '1933.9–1934.10' }), '1933.9');
});

test('the timeline page opens on the map tab and loads the map scripts', () => {
    const page = fs.readFileSync(path.join(root, 'timeline.html'), 'utf8');
    assert.match(page, /data-tab="map" role="tab" aria-selected="true"/);
    for (const src of ['js/timeline-data.js', 'js/campaign-engine.js', 'js/timeline-map.js', 'js/timeline.js']) assert.ok(page.includes(`src="${src}"`), `timeline.html loads ${src}`);
    assert.ok(page.indexOf('js/timeline-map.js') < page.indexOf('js/timeline.js'), 'map module loads before the page script');
    const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(worker.includes("'./js/timeline-map.js'"), 'service worker caches the map module');
});
