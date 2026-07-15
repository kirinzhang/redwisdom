(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomReadingProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const PROGRESS_STORAGE_KEY = 'redwisdom.readingProgress.v1';
    const HIGHLIGHTS_STORAGE_KEY = 'redwisdom.highlights.v1';

    function createReadingProgressStore(storage, now = () => Date.now()) {
        return {
            listProgress() {
                return readProgress(storage);
            },

            getProgressForArticle(articleId) {
                return readProgress(storage).find((entry) => entry.articleId === articleId) || null;
            },

            upsertProgress(input) {
                const progress = readProgress(storage);
                const timestamp = createTimestamp(now);
                const articleId = sanitizeText(input.articleId, 180);
                const index = progress.findIndex((entry) => entry.articleId === articleId);
                const base = index === -1 ? {
                    id: `reading-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    articleId,
                    bookmarked: false,
                    createdAt: timestamp,
                } : progress[index];
                const entry = {
                    ...base,
                    articleTitle: sanitizeText(input.articleTitle, 120) || '未命名文章',
                    progressPercent: clampPercent(input.progressPercent),
                    lastPosition: clampNumber(input.lastPosition),
                    updatedAt: timestamp,
                };

                if (index === -1) {
                    progress.unshift(entry);
                } else {
                    progress[index] = entry;
                }

                writeProgress(storage, progress);
                return entry;
            },

            toggleBookmark(input) {
                const progress = readProgress(storage);
                const timestamp = createTimestamp(now);
                const articleId = sanitizeText(input.articleId, 180);
                const index = progress.findIndex((entry) => entry.articleId === articleId);
                const base = index === -1 ? {
                    id: `reading-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    articleId,
                    progressPercent: 0,
                    lastPosition: 0,
                    createdAt: timestamp,
                } : progress[index];
                const entry = {
                    ...base,
                    articleTitle: sanitizeText(input.articleTitle, 120) || base.articleTitle || '未命名文章',
                    bookmarked: !base.bookmarked,
                    updatedAt: timestamp,
                };

                if (index === -1) {
                    progress.unshift(entry);
                } else {
                    progress[index] = entry;
                }

                writeProgress(storage, progress);
                return entry;
            },

            listBookmarks() {
                return readProgress(storage).filter((entry) => entry.bookmarked);
            },

            listHighlights() {
                return readHighlights(storage);
            },

            listHighlightsForArticle(articleId) {
                return readHighlights(storage).filter((highlight) => highlight.articleId === articleId);
            },

            addHighlight(input) {
                const highlights = readHighlights(storage);
                const timestamp = createTimestamp(now);
                const highlight = {
                    id: `highlight-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    articleId: sanitizeText(input.articleId, 180),
                    articleTitle: sanitizeText(input.articleTitle, 120) || '未命名文章',
                    selectedText: sanitizeText(input.selectedText, 2000),
                    note: sanitizeText(input.note, 2000),
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                highlights.unshift(highlight);
                writeHighlights(storage, highlights);
                return highlight;
            },

            deleteHighlight(id) {
                writeHighlights(storage, readHighlights(storage).filter((highlight) => highlight.id !== id));
            },

            clearReadingProgress() {
                storage.removeItem(PROGRESS_STORAGE_KEY);
                storage.removeItem(HIGHLIGHTS_STORAGE_KEY);
                markArchiveDirty(storage);
            },
        };
    }

    function summarizeReadingProgressArchive({ progress, highlights }) {
        const sortedProgress = sortByUpdatedAt(progress || []);
        const sortedHighlights = sortByUpdatedAt(highlights || []);

        return {
            totalReadArticles: sortedProgress.length,
            totalBookmarks: sortedProgress.filter((entry) => entry.bookmarked).length,
            totalHighlights: sortedHighlights.length,
            recentProgress: sortedProgress.slice(0, 5),
            recentHighlights: sortedHighlights.slice(0, 5),
        };
    }

    function readProgress(storage) {
        return readJsonArray(storage, PROGRESS_STORAGE_KEY, sortByUpdatedAt);
    }

    function writeProgress(storage, progress) {
        storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(sortByUpdatedAt(progress)));
        markArchiveDirty(storage);
    }

    function readHighlights(storage) {
        return readJsonArray(storage, HIGHLIGHTS_STORAGE_KEY, sortByUpdatedAt);
    }

    function writeHighlights(storage, highlights) {
        storage.setItem(HIGHLIGHTS_STORAGE_KEY, JSON.stringify(sortByUpdatedAt(highlights)));
        markArchiveDirty(storage);
    }

    function markArchiveDirty(storage) { storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString()); }

    function readJsonArray(storage, key, sort) {
        try {
            const raw = storage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? sort(parsed) : [];
        } catch (error) {
            return [];
        }
    }

    function sortByUpdatedAt(items) {
        return [...items].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function createTimestamp(now) {
        return new Date(now()).toISOString();
    }

    function clampPercent(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.min(100, Math.max(0, Math.round(number)));
    }

    function clampNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.max(0, Math.round(number));
    }

    function sanitizeText(value, limit = 5000) {
        return String(value || '').trim().slice(0, limit);
    }

    return {
        HIGHLIGHTS_STORAGE_KEY,
        PROGRESS_STORAGE_KEY,
        createReadingProgressStore,
        summarizeReadingProgressArchive,
    };
});
