const assert = require('node:assert/strict');
const test = require('node:test');

const {
    getQuotePresentation,
    normalizeQuotes,
} = require('../js/quote-utils.js');

test('normalizeQuotes enriches JSON quotes with source, method tags, and article links', () => {
    const payload = {
        quotes: [
            {
                id: 1,
                content: '没有调查就没有发言权。',
                source: '反对本本主义',
                date: '一九三〇年五月',
                category: '调查研究',
            },
        ],
    };
    const catalog = {
        volumes: {
            第一卷: [
                {
                    title: '反对本本主义',
                    filename: '006-反对本本主义.md',
                },
            ],
        },
    };

    const [quote] = normalizeQuotes(payload, catalog);

    assert.equal(quote.id, 1);
    assert.equal(quote.content, '没有调查就没有发言权。');
    assert.equal(quote.source, '反对本本主义');
    assert.equal(quote.date, '一九三〇年五月');
    assert.equal(quote.category, '调查研究');
    assert.deepEqual(quote.methodTags, ['调查研究', '实事求是', '反对本本主义']);
    assert.equal(quote.articleTitle, '反对本本主义');
    assert.equal(quote.articleHref, 'reading.html#006-%E5%8F%8D%E5%AF%B9%E6%9C%AC%E6%9C%AC%E4%B8%BB%E4%B9%89.md');
});

test('getQuotePresentation gives very long quotes the smallest class before generic long quote handling', () => {
    const presentation = getQuotePresentation('长'.repeat(90));

    assert.equal(presentation.fontSizeClass, 'quote-size-xs');
    assert.equal(presentation.layoutClass, 'layout-top');
});

