import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataset = readJson('data/history-cases.json');
const taxonomy = readJson('data/history-problem-types.json');
const schema = readJson('data/history-case.schema.json');
const sourceReviews = readJson('data/history-source-review.json');
const searchIndex = readJson('data/search-index.json');
const authorityHosts = new Set(['www.12371.cn', 'news.12371.cn', 'fuwu.12371.cn', 'xuexi.12371.cn']);
const publishableReviewStates = new Set(['source-reviewed', 'editor-approved']);
const reviewStates = new Set(schema.properties.review.properties.status.enum);
const reviewerTypes = new Set(schema.properties.review.properties.reviewerType.enum);
const caseKinds = new Set(schema.properties.caseKind.enum);
const typeIds = new Set(taxonomy.types.map((type) => type.id));
const requiredStrings = ['id', 'title', 'period', 'challenge', 'sourceBoundary', 'outcome', 'transferMethod', 'limits'];
const requiredArrays = ['problemTypes', 'actions', 'methodology', 'applicableProblems', 'keywords', 'evidence'];
const indexedText = new Map(searchIndex.records.map((record) => [
    `${record.articleId}#${record.anchor}`,
    String(record.text || record.content || ''),
]));
const errors = [];
const seenIds = new Set();
const seenEvidenceIds = new Set();
const reviewBatchByCase = buildReviewBatchIndex(sourceReviews);

if (dataset.version !== 3) errors.push(`dataset version must be 3, received ${dataset.version}`);
if (dataset.schema !== 'redwisdom.history-case.v3') errors.push('dataset schema must be redwisdom.history-case.v3');
if (!Array.isArray(dataset.cases) || dataset.cases.length < 60) errors.push('cases must contain at least 60 records');

for (const [index, item] of (dataset.cases || []).entries()) {
    const label = item.id || `case at index ${index}`;
    if (seenIds.has(item.id)) errors.push(`${label}: duplicate id`);
    seenIds.add(item.id);

    for (const field of requiredStrings) {
        if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${label}: ${field} must be a non-empty string`);
    }
    for (const field of requiredArrays) {
        if (!Array.isArray(item[field]) || item[field].length === 0) errors.push(`${label}: ${field} must be a non-empty array`);
    }
    if (!caseKinds.has(item.caseKind)) errors.push(`${label}: invalid caseKind ${item.caseKind}`);
    if (item.problemTypes?.some((id) => !typeIds.has(id))) errors.push(`${label}: contains an unknown problem type`);
    if (new Set(item.problemTypes || []).size !== item.problemTypes?.length) errors.push(`${label}: problemTypes must be unique`);
    if (!Array.isArray(item.retrieval?.aliases) || !Array.isArray(item.retrieval?.negativeCues)) {
        errors.push(`${label}: retrieval.aliases and retrieval.negativeCues must be arrays`);
    }

    if (item.verification?.status !== 'cross-checked') {
        errors.push(`${label}: published cases must have verification.status=cross-checked`);
    }
    if (!isDate(item.verification?.checkedAt)) errors.push(`${label}: verification.checkedAt must use YYYY-MM-DD`);
    validateReview(label, item.review);
    if (!reviewBatchByCase.has(item.id)) errors.push(`${label}: published case is missing from history-source-review.json`);
    if (reviewBatchByCase.get(item.id)?.id !== item.review?.batchId) errors.push(`${label}: review.batchId does not match source-review registry`);

    const sourceKey = `${item.source?.articleId || ''}#${item.source?.anchor || ''}`;
    if (!indexedText.has(sourceKey)) errors.push(`${label}: source anchor does not exist: ${sourceKey}`);

    const primaryEvidence = (item.evidence || []).filter((evidence) => evidence.type === 'primary');
    const authorityEvidence = (item.evidence || []).filter((evidence) => evidence.type === 'authoritative-history');
    if (primaryEvidence.length === 0) errors.push(`${label}: at least one primary evidence record is required`);
    if (authorityEvidence.length === 0) errors.push(`${label}: at least one authoritative history source is required`);
    if (!primaryEvidence.some((evidence) => `${evidence.articleId}#${evidence.anchor}` === sourceKey)) {
        errors.push(`${label}: source must match one primary evidence anchor`);
    }

    for (const evidence of item.evidence || []) {
        if (!evidence.id) errors.push(`${label}: evidence id is required`);
        if (seenEvidenceIds.has(evidence.id)) errors.push(`${label}: duplicate evidence id ${evidence.id}`);
        seenEvidenceIds.add(evidence.id);
        if (!Array.isArray(evidence.supports) || evidence.supports.length === 0) {
            errors.push(`${label}: every evidence record must declare supported claims`);
        }
    }
    for (const evidence of primaryEvidence) validatePrimaryEvidence(label, evidence);
    for (const evidence of authorityEvidence) validateAuthorityEvidence(label, evidence);

    const supportedClaims = new Set((item.evidence || []).flatMap((evidence) => evidence.supports || []));
    for (const claim of ['challenge', 'actions', 'outcome']) {
        if (!supportedClaims.has(claim)) errors.push(`${label}: evidence does not support ${claim}`);
    }
}

const coverage = Object.fromEntries(taxonomy.types.map((type) => [
    type.id,
    (dataset.cases || []).filter((item) => item.problemTypes?.includes(type.id)).length,
]));
for (const [typeId, count] of Object.entries(coverage)) {
    if (count < 5) errors.push(`problem type ${typeId} must have at least 5 cases, received ${count}`);
}

if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`Validated ${dataset.cases.length} source-reviewed cases. Source coverage 100%; category coverage ${JSON.stringify(coverage)}.\n`);
}

function validateReview(label, review) {
    if (!reviewStates.has(review?.status)) errors.push(`${label}: invalid review.status`);
    if (!publishableReviewStates.has(review?.status)) errors.push(`${label}: published case is not source-reviewed or editor-approved`);
    for (const field of ['sourceCheck', 'citationCheck', 'analogyCheck']) {
        if (review?.[field] !== 'passed') errors.push(`${label}: review.${field} must be passed before publication`);
    }
    if (!isDate(review?.reviewedAt)) errors.push(`${label}: review.reviewedAt must use YYYY-MM-DD`);
    if (!reviewerTypes.has(review?.reviewerType)) errors.push(`${label}: invalid review.reviewerType`);
    if (review?.status === 'editor-approved' && review?.reviewerType !== 'human-editor') {
        errors.push(`${label}: editor-approved requires reviewerType=human-editor`);
    }
}

function validatePrimaryEvidence(label, evidence) {
    const key = `${evidence.articleId || ''}#${evidence.anchor || ''}`;
    const sourceText = indexedText.get(key);
    if (!sourceText) {
        errors.push(`${label}: primary evidence anchor does not exist: ${key}`);
        return;
    }
    if (typeof evidence.excerpt !== 'string' || !evidence.excerpt.trim()) {
        errors.push(`${label}: primary evidence excerpt is required`);
    } else if (!sourceText.includes(evidence.excerpt)) {
        errors.push(`${label}: primary evidence excerpt is not an exact substring of ${key}`);
    }
    if (evidence.excerptHash !== sha256(evidence.excerpt || '')) {
        errors.push(`${label}: primary evidence excerptHash does not match excerpt`);
    }
}

function validateAuthorityEvidence(label, evidence) {
    let host = '';
    try {
        host = new URL(evidence.url).hostname;
    } catch {
        errors.push(`${label}: invalid authoritative source URL: ${evidence.url || '(missing)'}`);
    }
    if (host && !authorityHosts.has(host)) errors.push(`${label}: authoritative source host is not allowed: ${host}`);
    if (!isDate(evidence.accessedAt)) errors.push(`${label}: authoritative source accessedAt must use YYYY-MM-DD`);
}

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function isDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function buildReviewBatchIndex(registry) {
    const result = new Map();
    for (const batch of registry.batches || []) {
        for (const caseId of batch.caseIds || []) {
            if (result.has(caseId)) errors.push(`${caseId}: appears in multiple source-review batches`);
            result.set(caseId, batch);
        }
    }
    return result;
}
