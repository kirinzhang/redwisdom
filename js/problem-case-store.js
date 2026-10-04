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
    const VALID_ACTIVITY_TYPES = ['conversation', 'reading', 'note', 'practice', 'evidence', 'review', 'analysis'];
    const VALID_VERDICTS = ['pending', 'confirmed', 'refuted', 'partial'];
    const VERDICT_LABELS = { pending: '待核实', confirmed: '证实', refuted: '推翻', partial: '部分证实' };
    const MAX_INVESTIGATIONS = 40;
    const MAX_CONTRADICTIONS = 12;
    const MAX_VERSIONS = 30;

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
                    investigations: sanitizeInvestigations(input.investigations),
                    contradictionMap: sanitizeContradictionMap(input.contradictionMap),
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

            // ===== 调查清单 =====
            addInvestigation(id, input) {
                const problemCase = this.getCase(id);
                if (!problemCase) throw new Error('问题不存在');
                const question = sanitizeText(input.question, 300);
                if (!question) throw new Error('请写下要核实的判断');
                const timestamp = createTimestamp(now);
                const item = {
                    id: `inv-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    question,
                    source: sanitizeText(input.source, 300),
                    method: sanitizeText(input.method, 300),
                    finding: '',
                    verdict: 'pending',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    resolvedAt: '',
                };
                const investigations = [...getInvestigations(problemCase), item];
                const patch = { investigations, investigationTasks: pendingQuestions(investigations) };
                if (problemCase.stage === 'define') patch.stage = 'investigate';
                return this.updateCase(id, patch);
            },

            updateInvestigation(id, investigationId, input) {
                const problemCase = this.getCase(id);
                if (!problemCase) throw new Error('问题不存在');
                const timestamp = createTimestamp(now);
                let resolved = null;
                const investigations = getInvestigations(problemCase).map((item) => {
                    if (item.id !== investigationId) return item;
                    const next = { ...item, updatedAt: timestamp };
                    ['question', 'source', 'method'].forEach((key) => {
                        if (Object.prototype.hasOwnProperty.call(input, key)) next[key] = sanitizeText(input[key], 300);
                    });
                    if (Object.prototype.hasOwnProperty.call(input, 'finding')) next.finding = sanitizeText(input.finding, 2000);
                    if (Object.prototype.hasOwnProperty.call(input, 'verdict')) {
                        next.verdict = normalizeEnum(input.verdict, VALID_VERDICTS, 'pending');
                        if (next.verdict !== 'pending' && next.verdict !== item.verdict) {
                            next.resolvedAt = timestamp;
                            resolved = next;
                        }
                        if (next.verdict === 'pending') next.resolvedAt = '';
                    }
                    return next;
                });
                const updated = this.updateCase(id, { investigations, investigationTasks: pendingQuestions(investigations) });
                if (!resolved) return updated;
                return this.addActivity(id, {
                    type: 'evidence',
                    referenceId: resolved.id,
                    title: `调查结果：${VERDICT_LABELS[resolved.verdict]}`,
                    detail: `判断：${resolved.question}${resolved.finding ? `\n查到：${resolved.finding}` : ''}`,
                });
            },

            removeInvestigation(id, investigationId) {
                const problemCase = this.getCase(id);
                if (!problemCase) throw new Error('问题不存在');
                const investigations = getInvestigations(problemCase).filter((item) => item.id !== investigationId);
                return this.updateCase(id, { investigations, investigationTasks: pendingQuestions(investigations) });
            },

            // ===== 矛盾分析画布 =====
            saveContradictionMap(id, input, options = {}) {
                const problemCase = this.getCase(id);
                if (!problemCase) throw new Error('问题不存在');
                const current = sanitizeContradictionMap(problemCase.contradictionMap);
                const next = sanitizeContradictionMap({ ...current, items: input.items, mainAspect: input.mainAspect });
                const mainText = next.items[0]?.text || '';
                const patch = { contradictionMap: next, mainContradiction: mainText };
                if (options.recordVersion && next.items.length) {
                    const previous = current.versions[current.versions.length - 1];
                    const version = {
                        id: `ver-${now()}-${Math.random().toString(36).slice(2, 6)}`,
                        at: createTimestamp(now),
                        mainText,
                        mainAspect: next.mainAspect,
                        ranking: next.items.map((item) => item.text),
                        note: sanitizeText(options.note, 500),
                    };
                    patch.contradictionMap = { ...next, versions: [...current.versions, version].slice(-MAX_VERSIONS) };
                    if (problemCase.stage === 'define' || problemCase.stage === 'investigate') patch.stage = 'analyze';
                    const updated = this.updateCase(id, patch);
                    const shifted = previous && previous.mainText && previous.mainText !== mainText;
                    return this.addActivity(id, {
                        type: 'analysis',
                        referenceId: version.id,
                        title: shifted ? '主要矛盾转移' : '记录矛盾分析',
                        detail: shifted ? `由“${previous.mainText}”转为“${mainText}”${version.note ? `\n依据：${version.note}` : ''}` : `主要矛盾：${mainText}${version.note ? `\n依据：${version.note}` : ''}`,
                    }) || updated;
                }
                return this.updateCase(id, patch);
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
        if (Object.prototype.hasOwnProperty.call(patch, 'investigations')) {
            output.investigations = sanitizeInvestigations(patch.investigations);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'contradictionMap')) {
            output.contradictionMap = sanitizeContradictionMap(patch.contradictionMap);
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

    // 旧数据只有“待调查事项”文本列表时，转换为待核实的调查条目。
    function getInvestigations(problemCase) {
        const list = sanitizeInvestigations(problemCase?.investigations);
        if (list.length || !(problemCase?.investigationTasks || []).length) return list;
        return problemCase.investigationTasks.map((question, index) => ({
            id: `inv-legacy-${index}`,
            question: sanitizeText(question, 300),
            source: '',
            method: '',
            finding: '',
            verdict: 'pending',
            createdAt: problemCase.updatedAt || problemCase.createdAt || '',
            updatedAt: problemCase.updatedAt || problemCase.createdAt || '',
            resolvedAt: '',
        }));
    }

    function pendingQuestions(investigations) {
        return normalizeList(investigations.filter((item) => item.verdict === 'pending').map((item) => item.question));
    }

    function sanitizeInvestigations(list) {
        if (!Array.isArray(list)) return [];
        return list.slice(0, MAX_INVESTIGATIONS).map((item) => ({
            id: sanitizeText(item?.id, 80) || `inv-${Math.random().toString(36).slice(2, 10)}`,
            question: sanitizeText(item?.question, 300),
            source: sanitizeText(item?.source, 300),
            method: sanitizeText(item?.method, 300),
            finding: sanitizeText(item?.finding, 2000),
            verdict: normalizeEnum(item?.verdict, VALID_VERDICTS, 'pending'),
            createdAt: sanitizeText(item?.createdAt, 40),
            updatedAt: sanitizeText(item?.updatedAt, 40),
            resolvedAt: sanitizeText(item?.resolvedAt, 40),
        })).filter((item) => item.question);
    }

    function sanitizeContradictionMap(map) {
        const items = Array.isArray(map?.items) ? map.items : [];
        const versions = Array.isArray(map?.versions) ? map.versions : [];
        return {
            items: items.slice(0, MAX_CONTRADICTIONS).map((item) => ({
                id: sanitizeText(item?.id, 80) || `con-${Math.random().toString(36).slice(2, 10)}`,
                text: sanitizeText(item?.text, 300),
                note: sanitizeText(item?.note, 500),
            })).filter((item) => item.text),
            mainAspect: sanitizeText(map?.mainAspect, 500),
            versions: versions.slice(-MAX_VERSIONS).map((version) => ({
                id: sanitizeText(version?.id, 80),
                at: sanitizeText(version?.at, 40),
                mainText: sanitizeText(version?.mainText, 300),
                mainAspect: sanitizeText(version?.mainAspect, 500),
                ranking: (Array.isArray(version?.ranking) ? version.ranking : []).slice(0, MAX_CONTRADICTIONS).map((text) => sanitizeText(text, 300)).filter(Boolean),
                note: sanitizeText(version?.note, 500),
            })).filter((version) => version.at && version.mainText),
        };
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
        VALID_VERDICTS,
        VERDICT_LABELS,
        createProblemCaseStore,
        getInvestigations,
        sanitizeContradictionMap,
        summarizeProblemCases,
    };
});
