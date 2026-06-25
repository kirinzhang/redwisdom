import fs from 'node:fs';
import path from 'node:path';

const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const outFile = 'data/search-index.json';

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~-]/g, '')
    .replace(/\r/g, '')
    .trim();
}

function tokenize(text) {
  const normalized = text.toLowerCase();
  const ascii = normalized.match(/[a-z0-9]+/g) || [];
  const chinese = Array.from(normalized.replace(/[^\u4e00-\u9fff]/g, ''));
  const grams = [];
  for (let i = 0; i < chinese.length; i += 1) {
    grams.push(chinese[i]);
    if (i < chinese.length - 1) grams.push(chinese[i] + chinese[i + 1]);
  }
  return Array.from(new Set([...ascii, ...grams])).filter(Boolean);
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 24);
}

const chunks = [];
let articleCount = 0;

for (const [volume, articles] of Object.entries(catalog.volumes)) {
  for (const article of articles) {
    const articlePath = path.join('data/articles', article.filename);
    const markdown = fs.readFileSync(articlePath, 'utf8');
    const paragraphs = splitParagraphs(stripMarkdown(markdown));
    articleCount += 1;
    paragraphs.forEach((text, paragraphIndex) => {
      const safeText = text.length > 900 ? `${text.slice(0, 900)}...` : text;
      chunks.push({
        id: `${article.index}-${paragraphIndex}`,
        articleIndex: article.index,
        paragraphIndex,
        title: article.title,
        filename: article.filename,
        volume,
        text: safeText,
        tokens: tokenize(`${article.title} ${volume} ${safeText}`)
      });
    });
  }
}

const payload = {
  articleCount,
  chunkCount: chunks.length,
  chunks
};

fs.writeFileSync(outFile, `${JSON.stringify(payload)}\n`);
console.log(`Wrote ${chunks.length} chunks from ${articleCount} articles to ${outFile}`);
