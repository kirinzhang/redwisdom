import fs from 'node:fs';

const indexFile = 'data/search-index.json';
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

if (!fs.existsSync(indexFile)) {
  throw new Error(`${indexFile} does not exist`);
}

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
if (!index || !Array.isArray(index.chunks)) throw new Error('search index must contain chunks array');
if (index.chunks.length < 1000) throw new Error(`expected at least 1000 chunks, got ${index.chunks.length}`);
if (index.chunkCount !== index.chunks.length) {
  throw new Error(`chunkCount ${index.chunkCount} does not match chunks length ${index.chunks.length}`);
}

const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const catalogEntries = Object.entries(catalog.volumes).flatMap(([volume, articles]) =>
  articles.map((article) => ({
    filename: article.filename,
    title: article.title,
    articleIndex: article.index,
    volume
  }))
);
const catalogFiles = catalogEntries.map((article) => article.filename);
const catalogByFilename = new Map();
for (const article of catalogEntries) {
  if (catalogByFilename.has(article.filename)) throw new Error(`duplicate catalog filename ${article.filename}`);
  catalogByFilename.set(article.filename, article);
}
if (index.articleCount !== catalogFiles.length) {
  throw new Error(`articleCount ${index.articleCount} does not match catalog length ${catalogFiles.length}`);
}

const indexedFiles = new Set();
const chunkIds = new Set();
for (const [chunkIndex, chunk] of index.chunks.entries()) {
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
    throw new Error(`chunk ${chunkIndex} must be an object`);
  }

  for (const key of ['id', 'title', 'filename', 'volume', 'text']) {
    if (!hasOwn(chunk, key)) throw new Error(`chunk ${chunkIndex} missing ${key}`);
    if (typeof chunk[key] !== 'string' || chunk[key].length === 0) {
      throw new Error(`${chunk.id ?? 'chunk'} has invalid ${key}`);
    }
  }

  for (const key of ['articleIndex', 'paragraphIndex']) {
    if (!hasOwn(chunk, key)) throw new Error(`${chunk.id} missing ${key}`);
    if (!Number.isInteger(chunk[key]) || chunk[key] < 0) {
      throw new Error(`${chunk.id} has invalid ${key}`);
    }
  }

  if (!hasOwn(chunk, 'tokens')) throw new Error(`${chunk.id} missing tokens`);
  if (!Array.isArray(chunk.tokens) || chunk.tokens.length === 0) throw new Error(`${chunk.id} has no tokens`);
  for (const [tokenIndex, token] of chunk.tokens.entries()) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error(`${chunk.id} has invalid token ${tokenIndex}`);
    }
  }
  if (chunkIds.has(chunk.id)) throw new Error(`duplicate chunk id ${chunk.id}`);
  const catalogArticle = catalogByFilename.get(chunk.filename);
  if (!catalogArticle) throw new Error(`indexed filename outside catalog: ${chunk.filename}`);
  if (chunk.title !== catalogArticle.title) {
    throw new Error(`${chunk.id} title ${chunk.title} does not match catalog title ${catalogArticle.title}`);
  }
  if (chunk.volume !== catalogArticle.volume) {
    throw new Error(`${chunk.id} volume ${chunk.volume} does not match catalog volume ${catalogArticle.volume}`);
  }
  if (chunk.articleIndex !== catalogArticle.articleIndex) {
    throw new Error(
      `${chunk.id} articleIndex ${chunk.articleIndex} does not match catalog index ${catalogArticle.articleIndex}`
    );
  }
  const expectedId = `${chunk.articleIndex}-${chunk.paragraphIndex}`;
  if (chunk.id !== expectedId) throw new Error(`chunk id ${chunk.id} does not match expected id ${expectedId}`);

  chunkIds.add(chunk.id);
  indexedFiles.add(chunk.filename);
}

for (const filename of catalogFiles) {
  if (!indexedFiles.has(filename)) throw new Error(`missing indexed chunks for ${filename}`);
  if (!fs.existsSync(`data/articles/${filename}`)) throw new Error(`missing article file ${filename}`);
}

const smokeQueries = ['群众', '行动', '批评', '调查研究', '主要矛盾'];
for (const query of smokeQueries) {
  const hasMatch = index.chunks.some((chunk) => chunk.text.includes(query) || chunk.tokens.includes(query));
  if (!hasMatch) throw new Error(`no smoke match for ${query}`);
}

console.log(`Verified ${index.chunks.length} chunks across ${indexedFiles.size} articles`);
