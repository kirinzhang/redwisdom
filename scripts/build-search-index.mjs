import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createAnchorId, hashText } = require('../js/text-anchors.js');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/catalog.json'), 'utf8'));
const articles = Object.values(catalog.volumes).flat();
const records = [];

for (const article of articles) {
    const markdown = fs.readFileSync(path.join(rootDir, 'data/articles', article.filename), 'utf8');
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
fs.writeFileSync(path.join(rootDir, 'data/search-index.json'), JSON.stringify(output));
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
