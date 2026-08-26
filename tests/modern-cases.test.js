const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const modern = require(path.join(root, 'js/modern-cases.js'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));

test('modern cases are complete and well-formed', () => {
    assert.ok(modern.CASES.length >= 10, `至少 10 个案例（当前 ${modern.CASES.length}）`);

    const ids = new Set();
    for (const item of modern.CASES) {
        assert.ok(!ids.has(item.id), `案例 id 不重复：${item.id}`);
        ids.add(item.id);
        assert.ok(item.title && item.scene, `${item.id} 有标题和场景`);
        assert.ok(modern.CATEGORIES.includes(item.category), `${item.id} 的分类 ${item.category} 合法`);
        assert.ok(Array.isArray(item.analysis) && item.analysis.length >= 3, `${item.id} 至少 3 条思维拆解`);
        assert.ok(Array.isArray(item.actions) && item.actions.length >= 3, `${item.id} 至少 3 条行动建议`);
        assert.ok(item.boundary && item.boundary.length >= 15, `${item.id} 有边界提示`);
        assert.ok(item.quote && item.quote.length >= 4, `${item.id} 有原文引文`);
        assert.ok(item.articleTitle, `${item.id} 有关联文章`);
    }

    for (const cat of modern.CATEGORIES) {
        assert.ok(modern.CASES.some((item) => item.category === cat), `分类「${cat}」下至少有一个案例`);
    }
});

test('every modern case quote and article reference matches the real corpus', () => {
    const titleToFile = new Map();
    for (const articles of Object.values(catalog.volumes || {})) {
        for (const article of articles) titleToFile.set(article.title, article.filename);
    }

    for (const item of modern.CASES) {
        const filename = titleToFile.get(item.articleTitle);
        assert.ok(filename, `${item.id} 关联文章《${item.articleTitle}》存在于目录中`);

        const articleText = fs.readFileSync(path.join(root, 'data/articles', filename), 'utf8');
        assert.ok(
            articleText.includes(item.quote),
            `${item.id} 的引文「${item.quote}」必须出现在《${item.articleTitle}》原文中`
        );
    }
});
