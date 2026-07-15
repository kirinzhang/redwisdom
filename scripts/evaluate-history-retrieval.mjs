import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import retrieval from '../js/history-case-retrieval.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const history = readJson('data/history-cases.json');
const taxonomy = readJson('data/history-problem-types.json');
const evaluation = readJson('data/evaluation/history-retrieval-150.json');
const searchIndex = readJson('data/search-index.json');
const indexedText = new Map(searchIndex.records.map((record) => [
    `${record.articleId}#${record.anchor}`,
    String(record.text || record.content || ''),
]));
const caseIds = new Set(history.cases.map((item) => item.id));
const authorityHosts = new Set(['www.12371.cn', 'news.12371.cn', 'fuwu.12371.cn', 'xuexi.12371.cn']);
const failures = [];
let top3Hits = 0;
let categoryHits = 0;
let citationChecks = 0;
let validCitations = 0;
let forcedAnalogies = 0;

if (evaluation.items.length !== 150) failures.push(`Expected 150 evaluation items, received ${evaluation.items.length}.`);

const positiveItems = evaluation.items.filter((item) => item.allowAnalogy);
const negativeItems = evaluation.items.filter((item) => !item.allowAnalogy);
for (const item of evaluation.items) {
    const missingIds = item.acceptableCaseIds.filter((id) => !caseIds.has(id));
    if (missingIds.length) failures.push(`${item.id}: acceptable case IDs do not exist: ${missingIds.join(', ')}`);

    const classification = retrieval.classifyProblem({
        userMessage: item.query,
        problemTypes: taxonomy.types,
        noAnalogyCues: taxonomy.noAnalogyCues,
    });
    const results = retrieval.findRelevantHistoryCases({
        userMessage: item.query,
        cases: history.cases,
        problemTypes: taxonomy.types,
        noAnalogyCues: taxonomy.noAnalogyCues,
        limit: 3,
    });

    if (item.allowAnalogy) {
        if (results.some((result) => item.acceptableCaseIds.includes(result.id))) top3Hits += 1;
        if (classification.types.some((type) => type.id === item.expectedProblemType)) categoryHits += 1;
    } else if (results.length) {
        forcedAnalogies += 1;
    }

    for (const result of results) {
        citationChecks += 1;
        if (hasValidCitation(result)) validCitations += 1;
    }
}

const sourceValidCount = history.cases.filter(hasValidCitation).length;
const metrics = {
    evaluationItems: evaluation.items.length,
    positiveItems: positiveItems.length,
    negativeItems: negativeItems.length,
    sourceCoverage: ratio(sourceValidCount, history.cases.length),
    top3CaseHitRate: ratio(top3Hits, positiveItems.length),
    problemTypeTop3Rate: ratio(categoryHits, positiveItems.length),
    citationAccuracy: ratio(validCitations, citationChecks),
    forcedAnalogyRate: ratio(forcedAnalogies, negativeItems.length),
};
const thresholds = {
    sourceCoverage: 1,
    top3CaseHitRate: 0.85,
    problemTypeTop3Rate: 0.85,
    citationAccuracy: 0.95,
    forcedAnalogyRateMaximum: 0.05,
};

if (metrics.sourceCoverage < thresholds.sourceCoverage) failures.push(`Source coverage ${metrics.sourceCoverage} is below 1.`);
if (metrics.top3CaseHitRate < thresholds.top3CaseHitRate) failures.push(`Top-3 case hit rate ${metrics.top3CaseHitRate} is below 0.85.`);
if (metrics.problemTypeTop3Rate < thresholds.problemTypeTop3Rate) failures.push(`Problem-type top-3 rate ${metrics.problemTypeTop3Rate} is below 0.85.`);
if (metrics.citationAccuracy < thresholds.citationAccuracy) failures.push(`Citation accuracy ${metrics.citationAccuracy} is below 0.95.`);
if (metrics.forcedAnalogyRate >= thresholds.forcedAnalogyRateMaximum) failures.push(`Forced analogy rate ${metrics.forcedAnalogyRate} must be below 0.05.`);

const report = {
    version: 1,
    evaluatedAt: new Date().toISOString(),
    metrics,
    thresholds,
    passed: failures.length === 0,
    failures,
};
fs.writeFileSync(path.join(rootDir, 'data/evaluation/history-retrieval-report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;

function hasValidCitation(item) {
    const sourceKey = `${item.source?.articleId || ''}#${item.source?.anchor || ''}`;
    const primary = (item.evidence || []).find((evidence) => evidence.type === 'primary'
        && `${evidence.articleId}#${evidence.anchor}` === sourceKey);
    const authority = (item.evidence || []).find((evidence) => evidence.type === 'authoritative-history');
    const sourceText = indexedText.get(sourceKey) || '';
    let authorityHost = '';
    try {
        authorityHost = new URL(authority?.url).hostname;
    } catch {
        return false;
    }
    return Boolean(
        primary?.excerpt
        && sourceText.includes(primary.excerpt)
        && primary.excerptHash === sha256(primary.excerpt)
        && authorityHosts.has(authorityHost)
    );
}

function ratio(numerator, denominator) {
    return denominator ? Math.round((numerator / denominator) * 10000) / 10000 : 0;
}

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}
