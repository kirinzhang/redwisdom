// 由 data/concepts.source.json 生成 data/concepts.json：
// - 把关键原文片段解析为阅读页段落锚点（片段不存在时报错退出）
// - 统计每个概念在各篇文章中出现的次数
// - 关联已审核的党史案例
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
const compact = (value) => String(value || '').replace(/\s+/g, '');

const source = read('data/concepts.source.json');
const records = read('data/search-index.json').records;
const cases = read('data/history-cases.json').cases.filter((item) => ['source-reviewed', 'editor-approved'].includes(item.review?.status));

const errors = [];
const concepts = source.concepts.map((concept) => {
    const keyPassages = concept.keyPassages.map((passage) => {
        const record = records.find((r) => r.articleId === passage.articleId && compact(r.text).includes(compact(passage.phrase)));
        if (!record) {
            errors.push(`${concept.term}: 《${passage.articleId}》中找不到“${passage.phrase}”`);
            return null;
        }
        return { articleId: record.articleId, title: record.title, anchor: record.anchor, quote: passage.phrase };
    }).filter(Boolean);

    const terms = [concept.term, ...concept.aliases].map(compact).filter(Boolean);
    const counts = new Map();
    for (const record of records) {
        const text = compact(record.text);
        let hits = 0;
        for (const term of terms) hits += text.split(term).length - 1;
        if (hits) counts.set(record.articleId, { articleId: record.articleId, title: record.title, count: (counts.get(record.articleId)?.count || 0) + hits });
    }
    const articles = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    const tags = new Set(concept.caseTags);
    const historyCases = cases
        .map((item) => ({ item, score: (item.methodology || []).filter((tag) => tags.has(tag)).length + ((item.keywords || []).some((k) => terms.includes(compact(k))) ? 0.5 : 0) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ item }) => ({
            id: item.id,
            title: item.title,
            period: item.period,
            transferMethod: item.transferMethod,
            articleId: item.source?.articleId || '',
            anchor: item.source?.anchor || '',
        }));

    return {
        id: concept.id,
        term: concept.term,
        aliases: concept.aliases,
        summary: concept.summary,
        keyPassages,
        articles,
        historyCases,
        campaigns: concept.campaigns || [],
    };
});

if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exit(1);
}

fs.writeFileSync(path.join(rootDir, 'data/concepts.json'), `${JSON.stringify({ version: 1, note: '由 scripts/build-concepts.mjs 生成，请编辑 data/concepts.source.json', concepts }, null, 2)}\n`);
process.stdout.write(`Built ${concepts.length} concepts.\n`);
