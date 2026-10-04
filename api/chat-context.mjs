// 问道毛选的服务端上下文组装。
// 系统提示词、毛选原文检索和党史案例检索都在服务端完成，浏览器只提交对话内容，
// 这样既不能借接口注入任意系统提示词，也不需要在浏览器下载 4MB 的全文索引。

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { createPracticeCoachSystemPrompt } = require('../js/ai-methodology.js');
const { findRelevantMaoContexts, buildContextMessage } = require('../js/ai-context.js');
const History = require('../js/history-case-retrieval.js');
const { createLocaleInstructionMessage } = require('../js/i18n.js');
const ReadingGuides = require('../js/reading-guides.js');

let cachedSources = null;

function readJson(relativePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function buildGuideSources() {
    const titles = new Set();
    ReadingGuides.getThemeTracks().forEach((track) => track.articles.forEach((title) => titles.add(title)));
    return [...titles].map((articleTitle) => {
        const guide = ReadingGuides.getReadingGuide(articleTitle);
        return guide ? { articleTitle, ...guide } : null;
    }).filter(Boolean);
}

export function loadContextSources() {
    if (cachedSources) return cachedSources;
    const quotes = readJson('data/quotes.json', { quotes: [] });
    const search = readJson('data/search-index.json', { records: [] });
    const history = readJson('data/history-cases.json', { cases: [] });
    const types = readJson('data/history-problem-types.json', { types: [], noAnalogyCues: [] });
    cachedSources = {
        quotes: quotes.quotes || [],
        guides: buildGuideSources(),
        passages: search.records || [],
        historyCases: history.cases || [],
        historyProblemTypes: types.types || [],
        noAnalogyCues: types.noAnalogyCues || [],
    };
    return cachedSources;
}

export function buildRetrievalContext(userMessage, sources = loadContextSources()) {
    const contexts = findRelevantMaoContexts({
        userMessage,
        quotes: sources.quotes,
        guides: sources.guides,
        passages: sources.passages,
        limit: 4,
    });
    const historyCases = History.findRelevantHistoryCases({
        userMessage,
        cases: sources.historyCases,
        problemTypes: sources.historyProblemTypes,
        noAnalogyCues: sources.noAnalogyCues,
        limit: 3,
    });
    const classification = History.classifyProblem({
        userMessage,
        problemTypes: sources.historyProblemTypes,
        noAnalogyCues: sources.noAnalogyCues,
    });
    const originalContext = contexts.length ? buildContextMessage(contexts) : null;
    const historyContext = History.buildHistoryContextMessage(historyCases);
    const content = [originalContext?.content, historyContext?.content].filter(Boolean).join('\n\n');
    return {
        message: content ? { role: 'system', content } : null,
        historyMirror: History.buildHistoryMirrorModel(historyCases).slice(0, 3),
        classificationLabel: classification?.types?.[0]?.label || '',
    };
}

// 浏览器提交 { mode, locale, messages }，messages 只允许 user / assistant。
export function buildServerMessages({ mode, locale, dialogue }, sources) {
    const lastUser = [...dialogue].reverse().find((message) => message.role === 'user');
    const retrieval = buildRetrievalContext(lastUser ? lastUser.content : '', sources);
    const system = [
        { role: 'system', content: createPracticeCoachSystemPrompt(mode) },
        retrieval.message,
        createLocaleInstructionMessage(locale),
    ].filter(Boolean);
    return { messages: [...system, ...dialogue], retrieval };
}
