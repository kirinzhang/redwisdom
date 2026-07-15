(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomProblemCases = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STORAGE_KEY = 'redwisdom.problemCases.v1';
    const ACTIVE_CASE_KEY = 'redwisdom.activeProblemCase.v1';
    const VALID_STATUSES = ['active', 'paused', 'resolved', 'archived'];
    const VALID_STAGES = ['define', 'investigate', 'analyze', 'act', 'review'];
    const VALID_ACTIVITY_TYPES = ['conversation', 'reading', 'note', 'practice', 'evidence', 'review'];

    function createProblemCaseStore(storage, now = () => Date.now()) {
        return {
            listCases() {
                return readCases(storage);
            },

            getCase(id) {
                return readCases(storage).find((problemCase) => problemCase.id === id) || null;
            },

            getActiveCase() {
                const id = storage.getItem(ACTIVE_CASE_KEY);
                return id ? this.getCase(id) : null;
            },

            setActiveCase(id) {
                if (!id) {
                    storage.removeItem(ACTIVE_CASE_KEY);
                    return null;
                }
                const problemCase = this.getCase(id);
                if (!problemCase) throw new Error('问题不存在');
                storage.setItem(ACTIVE_CASE_KEY, id);
                return problemCase;
            },

            createCase(input) {
                const cases = readCases(storage);
                const timestamp = createTimestamp(now);
                const problemCase = {
                    id: `problem-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    title: sanitizeText(input.title, 100) || sanitizeText(input.realProblem, 100) || '未命名问题',
                    realProblem: sanitizeText(input.realProblem, 5000),
                    goal: sanitizeText(input.goal, 2000),
                    facts: sanitizeText(input.facts, 5000),
                    judgments: sanitizeText(input.judgments, 5000),
                    emotions: sanitizeText(input.emotions, 2000),
                    mainContradiction: sanitizeText(input.mainContradiction, 3000),
                    investigationTasks: normalizeList(input.investigationTasks),
                    availableForces: sanitizeText(input.availableForces, 3000),
                    nextAction: sanitizeText(input.nextAction, 3000),
                    methodologyTags: normalizeTags(input.methodologyTags),
                    stage: normalizeEnum(input.stage, VALID_STAGES, 'define'),
                    status: normalizeEnum(input.status, VALID_STATUSES, 'active'),
                    activities: [],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                cases.unshift(problemCase);
                writeCases(storage, cases);
                storage.setItem(ACTIVE_CASE_KEY, problemCase.id);
                return problemCase;
            },

            updateCase(id, patch) {
                const cases = readCases(storage);
                const index = cases.findIndex((problemCase) => problemCase.id === id);
                if (index === -1) throw new Error('问题不存在');

                const updated = {
                    ...cases[index],
                    ...sanitizePatch(patch),
                    updatedAt: createTimestamp(now),
                };
                cases[index] = updated;
                writeCases(storage, cases);
                return updated;
            },

            addActivity(id, input) {
                const problemCase = this.getCase(id);
                if (!problemCase) throw new Error('问题不存在');
                const timestamp = createTimestamp(now);
                const activity = {
                    id: `activity-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    type: normalizeEnum(input.type, VALID_ACTIVITY_TYPES, 'review'),
                    referenceId: sanitizeText(input.referenceId, 180),
                    title: sanitizeText(input.title, 140),
                    detail: sanitizeText(input.detail, 5000),
                    sourceHref: sanitizeText(input.sourceHref, 500),
                    metadata: sanitizeMetadata(input.metadata),
                    createdAt: timestamp,
                };
                const activities = [...(problemCase.activities || []), activity]
                    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
                return this.updateCase(id, { activities });
            },

            addReview(id, input) {
                const nextAction = sanitizeText(input.nextAction, 3000);
                this.addActivity(id, {
                    type: 'review',
                    title: sanitizeText(input.title, 140) || '行动复盘',
                    detail: sanitizeText(input.reflection, 5000),
                    metadata: {
                        expectedResult: input.expectedResult,
                        actualResult: input.actualResult,
                        evidence: input.evidence,
                        reflection: input.reflection,
                        nextAction,
                    },
                });
                return this.updateCase(id, {
                    stage: 'review',
                    status: input.resolved ? 'resolved' : 'active',
                    nextAction,
                });
            },

            deleteCase(id) {
                writeCases(storage, readCases(storage).filter((problemCase) => problemCase.id !== id));
                if (storage.getItem(ACTIVE_CASE_KEY) === id) storage.removeItem(ACTIVE_CASE_KEY);
            },

            clearCases() {
                storage.removeItem(STORAGE_KEY);
                storage.removeItem(ACTIVE_CASE_KEY);
                markArchiveDirty(storage);
            },
        };
    }

    function summarizeProblemCases(cases) {
        const statusCounts = {};
        const stageCounts = {};
        let activityCount = 0;
        (cases || []).forEach((problemCase) => {
            statusCounts[problemCase.status] = (statusCounts[problemCase.status] || 0) + 1;
            stageCounts[problemCase.stage] = (stageCounts[problemCase.stage] || 0) + 1;
            activityCount += (problemCase.activities || []).length;
        });
        return { total: (cases || []).length, activityCount, statusCounts, stageCounts };
    }

    function sanitizePatch(patch) {
        const output = {};
        const textLimits = {
            title: 100,
            realProblem: 5000,
            goal: 2000,
            facts: 5000,
            judgments: 5000,
            emotions: 2000,
            mainContradiction: 3000,
            availableForces: 3000,
            nextAction: 3000,
        };
        Object.entries(textLimits).forEach(([key, limit]) => {
            if (Object.prototype.hasOwnProperty.call(patch, key)) output[key] = sanitizeText(patch[key], limit);
        });
        if (Object.prototype.hasOwnProperty.call(patch, 'investigationTasks')) {
            output.investigationTasks = normalizeList(patch.investigationTasks);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'methodologyTags')) {
            output.methodologyTags = normalizeTags(patch.methodologyTags);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'stage')) {
            output.stage = normalizeEnum(patch.stage, VALID_STAGES, 'define');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
            output.status = normalizeEnum(patch.status, VALID_STATUSES, 'active');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'activities')) {
            output.activities = Array.isArray(patch.activities) ? patch.activities.slice(0, 500) : [];
        }
        return output;
    }

    function readCases(storage) {
        try {
            const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? sortCases(parsed) : [];
        } catch (error) {
            return [];
        }
    }

    function writeCases(storage, cases) {
        storage.setItem(STORAGE_KEY, JSON.stringify(sortCases(cases)));
        markArchiveDirty(storage);
    }

    function markArchiveDirty(storage) { storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString()); }

    function sortCases(cases) {
        return [...cases].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function sanitizeText(value, limit = 5000) {
        return String(value || '').trim().slice(0, limit);
    }

    function normalizeList(values) {
        const list = Array.isArray(values) ? values : String(values || '').split(/\r?\n/);
        return [...new Set(list.map((item) => sanitizeText(item, 300)).filter(Boolean))].slice(0, 20);
    }

    function normalizeTags(tags) {
        return normalizeList(Array.isArray(tags) ? tags : String(tags || '').split(/[，,]/)).slice(0, 8);
    }

    function normalizeEnum(value, values, fallback) {
        return values.includes(value) ? value : fallback;
    }

    function sanitizeMetadata(metadata) {
        const allowed = ['expectedResult', 'actualResult', 'evidence', 'reflection', 'nextAction'];
        return allowed.reduce((output, key) => {
            if (metadata && Object.prototype.hasOwnProperty.call(metadata, key)) {
                output[key] = sanitizeText(metadata[key], 5000);
            }
            return output;
        }, {});
    }

    function createTimestamp(now) {
        return new Date(now()).toISOString();
    }

    return {
        ACTIVE_CASE_KEY,
        STORAGE_KEY,
        VALID_ACTIVITY_TYPES,
        VALID_STAGES,
        VALID_STATUSES,
        createProblemCaseStore,
        summarizeProblemCases,
    };
});
