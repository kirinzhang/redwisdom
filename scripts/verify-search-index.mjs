import fs from 'node:fs';

const indexFile = 'data/search-index.json';
if (!fs.existsSync(indexFile)) {
  throw new Error(`${indexFile} does not exist`);
}

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
if (!index || !Array.isArray(index.chunks)) throw new Error('search index must contain chunks array');
if (index.chunks.length < 1000) throw new Error(`expected at least 1000 chunks, got ${index.chunks.length}`);

const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const catalogFiles = Object.values(catalog.volumes).flat().map((article) => article.filename);
const indexedFiles = new Set(index.chunks.map((chunk) => chunk.filename));
for (const filename of catalogFiles) {
  if (!indexedFiles.has(filename)) throw new Error(`missing indexed chunks for ${filename}`);
  if (!fs.existsSync(`data/articles/${filename}`)) throw new Error(`missing article file ${filename}`);
}

for (const chunk of index.chunks.slice(0, 20)) {
  for (const key of ['id', 'title', 'filename', 'volume', 'text', 'tokens']) {
    if (!(key in chunk)) throw new Error(`chunk missing ${key}`);
  }
  if (!Array.isArray(chunk.tokens) || chunk.tokens.length === 0) throw new Error(`${chunk.id} has no tokens`);
}

const smokeQueries = ['群众', '行动', '批评', '调查研究', '主要矛盾'];
for (const query of smokeQueries) {
  const hasMatch = index.chunks.some((chunk) => chunk.text.includes(query) || chunk.tokens.includes(query));
  if (!hasMatch) throw new Error(`no smoke match for ${query}`);
}

console.log(`Verified ${index.chunks.length} chunks across ${indexedFiles.size} articles`);
