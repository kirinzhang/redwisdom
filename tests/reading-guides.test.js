const assert = require('node:assert/strict');
const test = require('node:test');

const {
    getReadingGuide,
    getThemeTracks,
} = require('../js/reading-guides.js');

test('getReadingGuide returns a structured guide for core articles', () => {
    const guide = getReadingGuide('实践论');

    assert.equal(guide.problem, '如何把认识建立在实践上，并用实践检验判断。');
    assert.deepEqual(guide.coreIdeas, [
        '认识来源于实践，不来源于空想。',
        '感性认识要上升为理性认识。',
        '理论必须回到实践中接受检验。',
    ]);
    assert.match(guide.practice, /选择一个正在拖延的问题/);
});

test('getThemeTracks exposes problem-oriented learning paths for visitors', () => {
    const tracks = getThemeTracks();
    const featuredTrack = tracks.find(track => track.id === 'featured');
    const contradictionTrack = tracks.find(track => track.id === 'contradiction');

    assert.equal(tracks.length >= 8, true);
    assert.equal(featuredTrack.featured, true);
    assert.deepEqual(featuredTrack.articles, ['实践论', '矛盾论', '论持久战', '反对本本主义', '为人民服务']);
    assert.equal(contradictionTrack.title, '看清矛盾');
    assert.deepEqual(contradictionTrack.articles, ['矛盾论', '关于正确处理人民内部矛盾的问题', '中国社会各阶级的分析']);
});

test('getReadingGuide returns localized English guides while keeping Chinese article keys', () => {
    const guide = getReadingGuide('实践论', 'en');

    assert.equal(guide.locale, 'en');
    assert.equal(guide.problem, 'How to ground understanding in practice and test judgments through action.');
    assert.deepEqual(guide.coreIdeas, [
        'Knowledge begins in practice, not speculation.',
        'Concrete experience has to be raised into reasoned understanding.',
        'Theory must return to practice for verification.',
    ]);
    assert.match(guide.practice, /Choose one problem you have been postponing/);
});

test('getThemeTracks returns localized English learning paths without translating article titles', () => {
    const tracks = getThemeTracks('en');
    const featuredTrack = tracks.find(track => track.id === 'featured');
    const practiceTrack = tracks.find(track => track.id === 'practice');

    assert.equal(featuredTrack.title, 'Popular Essays');
    assert.deepEqual(featuredTrack.articles, ['实践论', '矛盾论', '论持久战', '反对本本主义', '为人民服务']);
    assert.equal(practiceTrack.title, 'From Understanding to Action');
    assert.equal(practiceTrack.description, 'For turning anxiety, ideas, and judgments into small verifiable practices.');
    assert.deepEqual(practiceTrack.articles, ['实践论', '反对本本主义', '改造我们的学习']);
});

test('reading page exposes reader-controlled font size settings', () => {
    const page = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'reading.html'), 'utf8');

    assert.match(page, /id="readingFontControls"/);
    assert.match(page, /id="readingFontDecrease"/);
    assert.match(page, /id="readingFontIncrease"/);
    assert.match(page, /id="readingFontMenuButton"/);
    assert.match(page, /id="readingFontPopover"/);
    assert.match(page, /redwisdom\.readingFontSize\.v1/);
    assert.match(page, /setupReadingFontSizeControls/);
    assert.match(page, /setupMobileReadingChrome/);
    assert.match(page, /reader-chrome-hidden/);
    assert.match(page, /--reading-font-size/);
    assert.match(page, /value === null/);
});

test('reading notes and excerpts use an accessible responsive tool panel', () => {
    const page = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'reading.html'), 'utf8');

    assert.match(page, /id="openReadingNotesBtn"/);
    assert.match(page, /id="openReadingExcerptsBtn"/);
    assert.match(page, /id="readerTools"[^>]*\binert\b/);
    assert.match(page, /id="readerToolsOverlay"/);
    assert.match(page, /id="selectionExcerptButton"/);
    assert.match(page, /data-reading-tool-panel="notes"/);
    assert.match(page, /data-reading-tool-panel="excerpts"/);
    assert.match(page, /@media \(min-width: 1280px\)/);
    assert.match(page, /@media \(max-width: 640px\)/);
    assert.match(page, /bodyEl\.innerHTML = `\$\{renderReadingGuide\(guide\)\}\$\{html\}`/);
    assert.match(page, /renderReadingTools\(articleMeta\)/);
    assert.doesNotMatch(page, /renderReadingNoteBox/);
    assert.ok(page.indexOf('id="readerTools"') > page.indexOf('</main>'));
});

test('reading guides fall back to Chinese for unsupported locales', () => {
    const guide = getReadingGuide('实践论', 'fr');
    const tracks = getThemeTracks('fr');

    assert.equal(guide.locale, 'zh-CN');
    assert.equal(guide.problem, '如何把认识建立在实践上，并用实践检验判断。');
    assert.equal(tracks.find(track => track.id === 'practice').title, '从认识到行动');
});
