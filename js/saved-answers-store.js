(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomSavedAnswers = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STORAGE_KEY = 'redwisdom.savedAnswers.v1';

    function createSavedAnswersStore(storage, now = () => Date.now()) {
        return {
            listSavedAnswers() {
                return readSavedAnswers(storage);
            },

            isAnswerSaved(answerId) {
                const normalizedAnswerId = normalizeAnswerId(answerId);
                return readSavedAnswers(storage).some((answer) => answer.answerId === normalizedAnswerId);
            },

            saveAnswer(input) {
                const savedAnswers = readSavedAnswers(storage);
                const timestamp = createTimestamp(now);
                const answerId = normalizeAnswerId(input.answerId || input.id || input.assistantMessage);
                const index = savedAnswers.findIndex((answer) => answer.answerId === answerId);
                const base = index === -1 ? {
                    id: `answer-${answerId}`,
                    answerId,
                    createdAt: timestamp,
                } : savedAnswers[index];
                const savedAnswer = {
                    ...base,
                    conversationId: sanitizeText(input.conversationId, 160),
                    title: sanitizeText(input.title || input.userMessage, 100) || '收藏回答',
                    userMessage: sanitizeText(input.userMessage, 4000),
                    assistantMessage: sanitizeText(input.assistantMessage, 12000),
                    methodologyTags: normalizeTags(input.methodologyTags),
                    updatedAt: timestamp,
                };

                if (index === -1) {
                    savedAnswers.unshift(savedAnswer);
                } else {
                    savedAnswers[index] = savedAnswer;
                }

                writeSavedAnswers(storage, savedAnswers);
                return savedAnswer;
            },

            toggleAnswer(input) {
                const answerId = normalizeAnswerId(input.answerId || input.id || input.assistantMessage);

                if (this.isAnswerSaved(answerId)) {
                    this.deleteSavedAnswer(answerId);
                    return { saved: false, answer: null };
                }

                return { saved: true, answer: this.saveAnswer({ ...input, answerId }) };
            },

            deleteSavedAnswer(answerId) {
                const normalizedAnswerId = normalizeAnswerId(answerId);
                writeSavedAnswers(storage, readSavedAnswers(storage).filter((answer) => answer.answerId !== normalizedAnswerId));
            },

            clearSavedAnswers() {
                storage.removeItem(STORAGE_KEY);
                storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString());
            },
        };
    }

    function summarizeSavedAnswersArchive(savedAnswers) {
        const sortedAnswers = sortByUpdatedAt(savedAnswers || []);
        const tagCounts = new Map();
        const tagOrder = new Map();

        sortedAnswers.forEach((answer) => {
            (answer.methodologyTags || []).forEach((tag) => {
                if (!tagOrder.has(tag)) {
                    tagOrder.set(tag, tagOrder.size);
                }
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });

        return {
            total: sortedAnswers.length,
            recentSavedAnswers: sortedAnswers.slice(0, 5),
            topMethodologyTags: [...tagCounts.entries()]
                .sort((a, b) => b[1] - a[1] || tagOrder.get(a[0]) - tagOrder.get(b[0]))
                .slice(0, 6),
        };
    }

    function readSavedAnswers(storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? sortByUpdatedAt(parsed) : [];
        } catch (error) {
            return [];
        }
    }

    function writeSavedAnswers(storage, savedAnswers) {
        storage.setItem(STORAGE_KEY, JSON.stringify(sortByUpdatedAt(savedAnswers)));
        storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString());
    }

    function sortByUpdatedAt(items) {
        return [...items].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function normalizeAnswerId(value) {
        return sanitizeText(value, 160) || 'unknown';
    }

    function normalizeTags(tags) {
        const list = Array.isArray(tags) ? tags : [];
        return [...new Set(list.map((tag) => sanitizeText(tag, 40)).filter(Boolean))].slice(0, 8);
    }

    function createTimestamp(now) {
        return new Date(now()).toISOString();
    }

    function sanitizeText(value, limit = 5000) {
        return String(value || '').trim().slice(0, limit);
    }

    return {
        STORAGE_KEY,
        createSavedAnswersStore,
        summarizeSavedAnswersArchive,
    };
});
