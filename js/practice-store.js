(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomPractice = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STORAGE_KEY = 'redwisdom.practices.v1';

    function createPracticeStore(storage, now = () => Date.now()) {
        return {
            listPractices() {
                return readPractices(storage);
            },

            createPractice(input) {
                const practices = readPractices(storage);
                const timestamp = new Date(now()).toISOString();
                const practice = {
                    id: `practice-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    problemCaseId: sanitizeText(input.problemCaseId),
                    title: sanitizeText(input.title) || '未命名实践',
                    realProblem: sanitizeText(input.realProblem),
                    sourceType: sanitizeText(input.sourceType) || 'manual',
                    sourceTitle: sanitizeText(input.sourceTitle),
                    sourceHref: sanitizeText(input.sourceHref),
                    relatedQuote: sanitizeText(input.relatedQuote),
                    methodologyTags: normalizeTags(input.methodologyTags),
                    mainContradiction: sanitizeText(input.mainContradiction),
                    investigationTodo: sanitizeText(input.investigationTodo),
                    availableForces: sanitizeText(input.availableForces),
                    actionPlan: sanitizeText(input.actionPlan),
                    expectedResult: sanitizeText(input.expectedResult),
                    actualResult: '',
                    reflection: '',
                    nextAction: '',
                    status: 'draft',
                    dueDate: sanitizeText(input.dueDate),
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                practices.unshift(practice);
                writePractices(storage, practices);
                return practice;
            },

            updatePractice(id, patch) {
                const practices = readPractices(storage);
                const index = practices.findIndex((practice) => practice.id === id);

                if (index === -1) {
                    throw new Error('实践记录不存在');
                }

                const updated = {
                    ...practices[index],
                    ...sanitizePatch(patch),
                    updatedAt: new Date(now()).toISOString(),
                };

                practices[index] = updated;
                writePractices(storage, practices);
                return updated;
            },

            deletePractice(id) {
                const practices = readPractices(storage).filter((practice) => practice.id !== id);
                writePractices(storage, practices);
            },

            clearPractices() {
                storage.removeItem(STORAGE_KEY);
                markArchiveDirty(storage);
            },
        };
    }

    function buildPracticeDraftFromQuote(quote) {
        return {
            title: `用《${quote.source || '毛选'}》分析我的问题`,
            realProblem: '',
            sourceType: 'quote',
            sourceTitle: quote.source || '',
            sourceHref: quote.articleHref || '',
            relatedQuote: quote.content || '',
            methodologyTags: normalizeTags(quote.methodTags),
            actionPlan: '写下一个现实问题，先区分事实、判断和情绪，再决定今天能做的一步。',
        };
    }

    function buildPracticeDraftFromGuide(articleTitle, guide) {
        return {
            title: `实践《${articleTitle}》的方法`,
            realProblem: guide?.problem || '',
            sourceType: 'reading',
            sourceTitle: articleTitle,
            sourceHref: '',
            relatedQuote: '',
            methodologyTags: inferGuideTags(articleTitle),
            actionPlan: guide?.practice || '',
        };
    }

    function buildPracticeDraftFromConversation({ userMessage, assistantMessage }) {
        return {
            title: '从问道毛选生成的实践',
            realProblem: userMessage || '',
            sourceType: 'conversation',
            sourceTitle: '问道毛选',
            sourceHref: 'chat.html',
            relatedQuote: '',
            methodologyTags: ['实践检验', '复盘'],
            actionPlan: extractSection(assistantMessage, '今日实践') || '从回答中选择一个今天能完成的小行动。',
            mainContradiction: extractSection(assistantMessage, '主要矛盾') || '',
            investigationTodo: extractSection(assistantMessage, '缺少的调查') || '',
        };
    }

    function summarizePracticeArchive(practices) {
        const statusCounts = {};
        const tagCounts = new Map();
        const tagOrder = new Map();

        practices.forEach((practice) => {
            statusCounts[practice.status] = (statusCounts[practice.status] || 0) + 1;
            (practice.methodologyTags || []).forEach((tag) => {
                if (!tagOrder.has(tag)) {
                    tagOrder.set(tag, tagOrder.size);
                }
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });

        const topMethodologyTags = [...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1] || tagOrder.get(a[0]) - tagOrder.get(b[0]))
            .slice(0, 6);

        return {
            total: practices.length,
            statusCounts,
            topMethodologyTags,
        };
    }

    function readPractices(storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writePractices(storage, practices) {
        storage.setItem(STORAGE_KEY, JSON.stringify(practices));
        markArchiveDirty(storage);
    }

    function markArchiveDirty(storage) { storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString()); }

    function sanitizePatch(patch) {
        const allowed = [
            'title',
            'problemCaseId',
            'realProblem',
            'mainContradiction',
            'investigationTodo',
            'availableForces',
            'actionPlan',
            'expectedResult',
            'actualResult',
            'reflection',
            'nextAction',
            'status',
            'dueDate',
        ];
        const output = {};

        allowed.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(patch, key)) {
                output[key] = sanitizeText(patch[key]);
            }
        });

        return output;
    }

    function sanitizeText(value) {
        return String(value || '').trim().slice(0, 5000);
    }

    function normalizeTags(tags) {
        const list = Array.isArray(tags) ? tags : [];
        return [...new Set(list.map(sanitizeText).filter(Boolean))].slice(0, 8);
    }

    function inferGuideTags(articleTitle) {
        const tags = {
            '实践论': ['实践检验', '实事求是'],
            '矛盾论': ['矛盾分析', '主要矛盾'],
            '论持久战': ['持久战', '长期斗争'],
            '反对本本主义': ['调查研究', '反对本本主义'],
            '党委会的工作方法': ['组织方法', '群众路线'],
        };

        return tags[articleTitle] || ['实践检验'];
    }

    function extractSection(text, title) {
        if (!text) return '';
        const pattern = new RegExp(`${title}[：:]?\\s*([^\\n#]+)`, 'i');
        const match = String(text).match(pattern);
        return match ? match[1].trim() : '';
    }

    return {
        STORAGE_KEY,
        buildPracticeDraftFromConversation,
        buildPracticeDraftFromGuide,
        buildPracticeDraftFromQuote,
        createPracticeStore,
        summarizePracticeArchive,
    };
});
