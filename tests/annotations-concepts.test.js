const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const A = require(path.join(root, 'js/reading-annotations.js'));
const concepts = JSON.parse(fs.readFileSync(path.join(root, 'data/concepts.json'), 'utf8')).concepts;
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/concepts.source.json'), 'utf8')).concepts;
const records = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8')).records;
const cases = JSON.parse(fs.readFileSync(path.join(root, 'data/history-cases.json'), 'utf8')).cases;
const compact = (v) => String(v || '').replace(/\s+/g, '');

test('notes are parsed from the end-of-article note section', () => {
    const md = fs.readFileSync(path.join(root, 'data/articles/012-中国革命战争的战略问题.md'), 'utf8');
    const notes = A.parseNotes(md);
    assert.match(notes[7], /^遵义会议指一九三五年一月长征途中/);
    assert.match(notes[27], /水浒传/);
    assert.ok(Object.keys(notes).length >= 50);
});

test('inline markers map to note numbers', () => {
    assert.equal(A.markerNumber('⑴'), 1);
    assert.equal(A.markerNumber('⒇'), 20);
    assert.equal(A.markerNumber('（27）'), 27);
    assert.equal(A.markerNumber('(31)'), 31);
});

test('almost every inline marker in the corpus resolves to a note', () => {
    let total = 0; let resolved = 0;
    for (const file of fs.readdirSync(path.join(root, 'data/articles')).filter((f) => /^\d/.test(f))) {
        const md = fs.readFileSync(path.join(root, 'data/articles', file), 'utf8');
        const notes = A.parseNotes(md);
        const body = md.split(/注\s*释/)[0];
        for (const m of body.matchAll(/[⑴-⒇]|〔\d+〕|（\d+）|\(\d+\)/g)) { total += 1; if (notes[A.markerNumber(m[0])]) resolved += 1; }
    }
    assert.ok(resolved / total > 0.95, `resolved ${resolved}/${total}`);
});

test('concept matching finds the earliest term or alias', () => {
    const concept = { term: '调查研究', aliases: ['没有调查，没有发言权'] };
    assert.deepEqual(A.findConceptMatch('他说没有调查，没有发言权，要做调查研究', concept), { index: 2, length: 10 });
    assert.equal(A.findConceptMatch('与此无关', concept), null);
});

test('nested book titles use 〈〉 inside 《》', () => {
    assert.equal(A.bookTitle('《农村调查》的序言和跋'), '《〈农村调查〉的序言和跋》');
    assert.equal(A.bookTitle('矛盾论'), '《矛盾论》');
});

test('concept data is built from the source and every key passage is verbatim Mao text', () => {
    assert.equal(concepts.length, source.length, 'concepts.json is in sync with concepts.source.json');
    const ids = new Set();
    for (const c of concepts) {
        assert.ok(!ids.has(c.id), `${c.id} is unique`); ids.add(c.id);
        assert.ok(c.term && c.summary, `${c.term} has a summary`);
        assert.ok(c.keyPassages.length > 0, `${c.term} cites the original text`);
        for (const p of c.keyPassages) {
            const record = records.find((r) => r.articleId === p.articleId && r.anchor === p.anchor);
            assert.ok(record, `${c.term} anchor ${p.anchor} exists`);
            assert.ok(compact(record.text).includes(compact(p.quote)), `${c.term} quote is verbatim`);
        }
        for (const h of c.historyCases) {
            const item = cases.find((x) => x.id === h.id);
            assert.ok(item && ['source-reviewed', 'editor-approved'].includes(item.review.status), `${c.term} links only reviewed case ${h.id}`);
        }
    }
});

test('concept cards label the summary as an editorial summary and link back to the text', () => {
    const html = A.renderConceptCard(concepts.find((c) => c.term === '调查研究'));
    assert.match(html, /编辑概括/);
    assert.match(html, /reading\.html\?article=006-/);
    assert.match(html, /chat\.html\?prompt=/);
});

test('reading page wires annotations, concept index and deep links', () => {
    const page = fs.readFileSync(path.join(root, 'reading.html'), 'utf8');
    assert.match(page, /src="js\/reading-annotations\.js"/);
    assert.match(page, /enhanceArticle\(articleRoot/);
    assert.match(page, /id="conceptIndex"/);
    assert.match(page, /params\.get\('concept'\)/);
});

test('server retrieval adds concept definitions when the user names a concept', async () => {
    const ctx = await import(path.join(root, 'api/chat-context.mjs'));
    const matched = ctx.matchConcepts('我想用调查研究的方法看看这个问题', concepts);
    assert.equal(matched[0].term, '调查研究');
    const { message } = ctx.buildRetrievalContext('我想用调查研究的方法看看这个问题');
    assert.match(message.content, /用户提到的毛选概念/);
    assert.match(message.content, /没有调查，没有发言权/);
});
