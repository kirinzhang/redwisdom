import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(rootDir, 'data');
const historyPath = path.join(dataDir, 'history-cases.json');
const existing = readJson(historyPath);
const additions = readJson(path.join(dataDir, 'history-case-additions.json'));
const taxonomy = readJson(path.join(dataDir, 'history-problem-types.json'));
const searchIndex = readJson(path.join(dataDir, 'search-index.json'));
const sourceReviews = readJson(path.join(dataDir, 'history-source-review.json'));
const checkedAt = '2026-07-14';

const legacyMetadata = {
    'hunan-investigation-1927': ['historical-event', ['investigation', 'needs-communication']],
    'investigation-meeting-1930': ['method-text', ['investigation', 'risk-decision']],
    'spark-strategy-1930': ['method-text', ['long-term-pressure', 'risk-decision']],
    'zunyi-correction-1935': ['historical-event', ['failure-recovery', 'learning-growth']],
    'protracted-war-stages-1938': ['method-text', ['long-term-pressure', 'risk-decision']],
    'changgang-caixi-service-1934': ['historical-event', ['needs-communication', 'execution-experiment']],
    'border-economy-1942': ['historical-event', ['resource-constraint', 'priority']],
    'leadership-pilot-1943': ['method-text', ['execution-experiment', 'learning-growth']],
    'rectification-learning-1942': ['historical-event', ['team-conflict', 'learning-growth']],
    'focus-front-1950': ['method-text', ['priority', 'risk-decision']],
    'gutian-organization-correction-1929': ['historical-event', ['organization-governance', 'team-conflict']],
    'anti-liberalism-accountability-1937': ['method-text', ['team-conflict', 'organization-governance']],
    'united-front-independence-1938': ['method-text', ['cooperation-boundaries', 'risk-decision']],
    'organize-mutual-aid-1943': ['historical-event', ['resource-constraint', 'cooperation-boundaries']],
    'reporting-system-1948': ['method-text', ['organization-governance', 'needs-communication']],
    'differentiated-land-policy-1948': ['historical-event', ['execution-experiment', 'risk-decision']],
    'committee-working-method-1949': ['method-text', ['organization-governance', 'priority', 'team-conflict']],
    'internal-contradictions-method-1957': ['method-text', ['team-conflict', 'risk-decision']],
};

const indexByAnchor = new Map(searchIndex.records.map((record) => [
    `${record.articleId}#${record.anchor}`,
    String(record.text || record.content || ''),
]));
const typeIds = new Set(taxonomy.types.map((type) => type.id));
const reviewByCaseId = buildReviewIndex(sourceReviews);
const additionIds = new Set(additions.cases.map((item) => item.id));
const baseCases = existing.cases.filter((item) => !additionIds.has(item.id));
const compiledCases = [...baseCases, ...additions.cases].map((item) => compileCase(item));
const ids = new Set(compiledCases.map((item) => item.id));
const cases = compiledCases.filter((item) => ['source-reviewed', 'editor-approved'].includes(item.review.status));

if (compiledCases.length !== ids.size) throw new Error('Duplicate case IDs found while compiling history library.');
if (cases.length < 60) throw new Error(`Expected at least 60 source-reviewed cases, received ${cases.length}.`);

const dataset = {
    version: 3,
    schema: 'redwisdom.history-case.v3',
    updatedAt: checkedAt,
    sourcePolicy: 'Every published case requires an exact local primary-text excerpt and at least one approved authoritative history source.',
    reviewPolicy: 'source-reviewed means automated/editorial source audit only; editor-approved is reserved for a recorded human editorial review.',
    cases,
};

fs.writeFileSync(historyPath, `${JSON.stringify(dataset, null, 2)}\n`);

const coverage = Object.fromEntries(taxonomy.types.map((type) => [
    type.id,
    cases.filter((item) => item.problemTypes.includes(type.id)).length,
]));
process.stdout.write(`Built ${cases.length} history cases. Coverage: ${JSON.stringify(coverage)}\n`);

function compileCase(input) {
    const [legacyKind, legacyTypes] = legacyMetadata[input.id] || [];
    const problemTypes = input.problemTypes || legacyTypes;
    if (!input.caseKind && !legacyKind) throw new Error(`${input.id}: missing legacy caseKind migration metadata.`);
    if (!Array.isArray(problemTypes) || problemTypes.some((id) => !typeIds.has(id))) {
        throw new Error(`${input.id}: contains an invalid problem type.`);
    }

    const evidence = input.evidence.map((entry, index) => compileEvidence(input.id, entry, index));
    return {
        ...input,
        caseKind: input.caseKind || legacyKind,
        problemTypes,
        retrieval: input.retrieval || {
            aliases: unique([
                ...(input.applicableProblems || []),
                ...(input.methodology || []),
                ...(input.keywords || []),
            ]),
            negativeCues: [],
        },
        evidence,
        verification: {
            status: 'cross-checked',
            checkedAt,
        },
        review: reviewByCaseId.get(input.id) || {
            status: 'draft',
            sourceCheck: 'pending',
            citationCheck: 'pending',
            analogyCheck: 'pending',
            reviewedAt: checkedAt,
            reviewerType: 'source-audit',
        },
    };
}

function compileEvidence(caseId, entry, index) {
    if (entry.type === 'primary') {
        const key = `${entry.articleId}#${entry.anchor}`;
        const fullText = indexByAnchor.get(key);
        if (!fullText) throw new Error(`${caseId}: missing source-index record ${key}.`);
        const needle = entry.excerptNeedle;
        if (needle && !fullText.includes(needle)) throw new Error(`${caseId}: primary excerpt needle is not in ${key}.`);
        const excerpt = extractExcerpt(fullText, needle);
        const { excerptNeedle: _discard, ...cleanEntry } = entry;
        return {
            id: `${caseId}-primary-${index + 1}`,
            ...cleanEntry,
            excerpt,
            excerptHash: sha256(excerpt),
        };
    }

    return {
        id: `${caseId}-history-${index + 1}`,
        ...entry,
        accessedAt: entry.accessedAt || checkedAt,
    };
}

function extractExcerpt(fullText, needle) {
    if (!needle) return fullText.slice(0, 260).trim();
    const index = fullText.indexOf(needle);
    const start = Math.max(0, index - 70);
    const end = Math.min(fullText.length, index + needle.length + 150);
    return fullText.slice(start, end).trim();
}

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function unique(values) {
    return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function buildReviewIndex(registry) {
    const result = new Map();
    for (const batch of registry.batches || []) {
        for (const caseId of batch.caseIds || []) {
            if (result.has(caseId)) throw new Error(`${caseId}: appears in more than one source-review batch.`);
            result.set(caseId, {
                status: batch.status,
                sourceCheck: batch.checks?.sourceCheck,
                citationCheck: batch.checks?.citationCheck,
                analogyCheck: batch.checks?.analogyCheck,
                reviewedAt: batch.reviewedAt,
                reviewerType: batch.reviewerType,
                batchId: batch.id,
            });
        }
    }
    return result;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
