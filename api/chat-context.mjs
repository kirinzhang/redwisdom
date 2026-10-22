// 问道毛选的服务端上下文组装（Node 版：本地开发服务器与 Vercel 函数）。
// 检索逻辑在 chat-context-core.mjs；这里只负责从磁盘读取 data/*.json 并缓存。

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as core from './chat-context-core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let cachedSources = null;

function readJson(relativePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
    } catch (error) {
        return fallback;
    }
}

export const { matchConcepts, buildContextSources, CONTEXT_DATA_FILES } = core;

// data/quotes.json、data/search-index.json、data/history-cases.json、data/history-problem-types.json、data/concepts.json
export function loadContextSources() {
    if (cachedSources) return cachedSources;
    const files = core.CONTEXT_DATA_FILES;
    cachedSources = core.buildContextSources({
        quotes: readJson(files.quotes, { quotes: [] }),
        search: readJson(files.search, { records: [] }),
        history: readJson(files.history, { cases: [] }),
        types: readJson(files.types, { types: [], noAnalogyCues: [] }),
        concepts: readJson(files.concepts, { concepts: [] }),
    });
    return cachedSources;
}

export function buildRetrievalContext(userMessage, sources = loadContextSources()) {
    return core.buildRetrievalContext(userMessage, sources);
}

export function buildServerMessages(input, sources = loadContextSources()) {
    return core.buildServerMessages(input, sources);
}
