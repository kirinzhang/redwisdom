(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomSavedQuotes = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STORAGE_KEY = 'redwisdom.savedQuotes.v1';

    function createSavedQuotesStore(storage, now = () => Date.now()) {
        return {
            listSavedQuotes() {
                return readSavedQuotes(storage);
            },

            isQuoteSaved(quoteId) {
                const normalizedQuoteId = normalizeQuoteId(quoteId);
                return readSavedQuotes(storage).some((quote) => quote.quoteId === normalizedQuoteId);
            },

            saveQuote(input) {
                const savedQuotes = readSavedQuotes(storage);
                const timestamp = createTimestamp(now);
                const quoteId = normalizeQuoteId(input.id || input.quoteId || input.content);
                const index = savedQuotes.findIndex((quote) => quote.quoteId === quoteId);
                const base = index === -1 ? {
                    id: `quote-${quoteId}`,
                    quoteId,
                    createdAt: timestamp,
                } : savedQuotes[index];
                const savedQuote = {
                    ...base,
                    content: sanitizeText(input.content, 2000),
                    source: sanitizeText(input.source, 180) || '毛选智慧卡片',
                    date: sanitizeText(input.date, 80),
                    category: sanitizeText(input.category, 80) || '思想方法',
                    methodologyTags: normalizeTags(input.methodologyTags || input.methodTags),
                    articleTitle: sanitizeText(input.articleTitle, 180) || sanitizeText(input.source, 180),
                    articleHref: sanitizeText(input.articleHref, 300) || 'reading.html',
                    updatedAt: timestamp,
                };

                if (index === -1) {
                    savedQuotes.unshift(savedQuote);
                } else {
                    savedQuotes[index] = savedQuote;
                }

                writeSavedQuotes(storage, savedQuotes);
                return savedQuote;
            },

            toggleQuote(input) {
                const quoteId = normalizeQuoteId(input.id || input.quoteId || input.content);

                if (this.isQuoteSaved(quoteId)) {
                    this.deleteSavedQuote(quoteId);
                    return { saved: false, quote: null };
                }

                return { saved: true, quote: this.saveQuote(input) };
            },

            deleteSavedQuote(quoteId) {
                const normalizedQuoteId = normalizeQuoteId(quoteId);
                writeSavedQuotes(storage, readSavedQuotes(storage).filter((quote) => quote.quoteId !== normalizedQuoteId));
            },

            clearSavedQuotes() {
                storage.removeItem(STORAGE_KEY);
                storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString());
            },
        };
    }

    function summarizeSavedQuotesArchive(savedQuotes) {
        const sortedQuotes = sortByUpdatedAt(savedQuotes || []);
        const tagCounts = new Map();
        const tagOrder = new Map();

        sortedQuotes.forEach((quote) => {
            (quote.methodologyTags || []).forEach((tag) => {
                if (!tagOrder.has(tag)) {
                    tagOrder.set(tag, tagOrder.size);
                }
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });

        return {
            total: sortedQuotes.length,
            recentSavedQuotes: sortedQuotes.slice(0, 5),
            topMethodologyTags: [...tagCounts.entries()]
                .sort((a, b) => b[1] - a[1] || tagOrder.get(a[0]) - tagOrder.get(b[0]))
                .slice(0, 6),
        };
    }

    function readSavedQuotes(storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? sortByUpdatedAt(parsed) : [];
        } catch (error) {
            return [];
        }
    }

    function writeSavedQuotes(storage, savedQuotes) {
        storage.setItem(STORAGE_KEY, JSON.stringify(sortByUpdatedAt(savedQuotes)));
        storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString());
    }

    function sortByUpdatedAt(items) {
        return [...items].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function normalizeQuoteId(value) {
        return sanitizeText(value, 120) || 'unknown';
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
        createSavedQuotesStore,
        summarizeSavedQuotesArchive,
    };
});
