const assert = require('node:assert/strict');
const test = require('node:test');

const { createAnchorId } = require('../js/text-anchors.js');
const { searchIndex, tokenize } = require('../js/full-text-search.js');

test('text anchors are stable for the same paragraph and distinguish duplicates', () => {
    assert.equal(createAnchorId('没有调查，就没有发言权。'), createAnchorId('没有调查，就没有发言权。'));
    assert.notEqual(createAnchorId('同一段', 1), createAnchorId('同一段', 2));
});

test('full text search ranks title and paragraph matches and returns an anchor', () => {
    const records = [
        { articleId: '006.md', title: '反对本本主义', anchor: 'p-one', text: '没有调查，没有发言权。' },
        { articleId: '016.md', title: '实践论', anchor: 'p-two', text: '实践是认识的来源。' },
    ];
    const results = searchIndex(records, '调查事实');
    assert.equal(results[0].articleId, '006.md');
    assert.equal(results[0].anchor, 'p-one');
    assert.match(results[0].snippet, /调查/);
});

test('Chinese queries include bigrams for useful partial matching', () => {
    assert.ok(tokenize('调查研究方法').includes('调查'));
    assert.ok(tokenize('调查研究方法').includes('研究'));
});
