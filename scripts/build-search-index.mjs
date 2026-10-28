import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createAnchorId, hashText } = require('../js/text-anchors.js');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// node scripts/build-search-index.mjs            → data/search-index.json（中文）
// node scripts/build-search-index.mjs --edition en → data/en/search-index.json（英文）
const edition = process.argv.includes('--edition') ? process.argv[process.argv.indexOf('--edition') + 1] : 'zh';
const dataDir = path.join(rootDir, edition === 'en' ? 'data/en' : 'data');
const catalog = JSON.parse(fs.readFileSync(path.join(dataDir, 'catalog.json'), 'utf8'));
const articles = Object.values(catalog.volumes).flat();
const records = [];

for (const article of articles) {
    const markdown = fs.readFileSync(path.join(dataDir, 'articles', article.filename), 'utf8');
    const occurrences = new Map();
    for (const block of extractMarkdownBlocks(markdown)) {
        const text = stripMarkdown(block);
        if (!text) continue;
        const hash = hashText(text);
        const occurrence = (occurrences.get(hash) || 0) + 1;
        occurrences.set(hash, occurrence);
        records.push({
            articleId: article.filename,
            title: article.title,
            anchor: createAnchorId(text, occurrence),
            text,
        });
    }
}

const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    articleCount: articles.length,
    records,
};
fs.writeFileSync(path.join(dataDir, 'search-index.json'), JSON.stringify(output));

// 英文语录卡：找到语录在英译本中的段落，记下锚点，卡片可直接跳到原文位置
if (edition === 'en') {
    const quotesPath = path.join(dataDir, 'quotes.json');
    const payload = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));
    const squash = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const byArticle = new Map();
    for (const r of records) {
        if (!byArticle.has(r.articleId)) byArticle.set(r.articleId, []);
        byArticle.get(r.articleId).push({ ...r, key: squash(r.text) });
    }
    let anchored = 0;
    for (const q of payload.quotes) {
        delete q.anchor;
        const list = byArticle.get(q.articleFilename);
        if (!list) continue;
        const probe = squash(q.content.split(/\n+/)[0].replace(/\.\s*\.\s*\./g, ' ')).slice(0, 60);
        const hit = probe.length >= 20 && list.find((r) => r.key.includes(probe));
        if (hit) { q.anchor = hit.anchor; anchored += 1; }
    }
    fs.writeFileSync(quotesPath, JSON.stringify(payload, null, 1));
    process.stdout.write(`Anchored ${anchored} of ${payload.quotes.length} quotations.\n`);
}
process.stdout.write(`Indexed ${records.length} blocks from ${articles.length} articles.\n`);

function extractMarkdownBlocks(markdown) {
    return String(markdown || '')
        .replace(/\r/g, '')
        .split(/\n\s*\n/)
        .flatMap((block) => {
            const lines = block.split('\n').filter((line) => line.trim());
            if (lines.every((line) => /^\s*(?:[-*+] |\d+[.)] )/.test(line))) return lines;
            return [block];
        });
}

function stripMarkdown(value) {
    return String(value || '')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/^\s*(?:[-*+] |\d+[.)] )/gm, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_~`]/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
