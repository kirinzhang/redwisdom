(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomReadingNotes = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STORAGE_KEY = 'redwisdom.readingNotes.v1';

    function createReadingNotesStore(storage, now = () => Date.now()) {
        return {
            listNotes() {
                return readNotes(storage);
            },

            getNoteForArticle(articleId) {
                return readNotes(storage).find((note) => note.articleId === articleId) || null;
            },

            upsertNote(input) {
                const notes = readNotes(storage);
                const timestamp = createTimestamp(now);
                const articleId = sanitizeText(input.articleId, 180);
                const index = notes.findIndex((note) => note.articleId === articleId);
                const base = index === -1 ? {
                    id: `note-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    articleId,
                    createdAt: timestamp,
                } : notes[index];
                const note = {
                    ...base,
                    problemCaseId: sanitizeText(input.problemCaseId, 180) || base.problemCaseId || '',
                    articleTitle: sanitizeText(input.articleTitle, 120) || '未命名文章',
                    content: sanitizeText(input.content, 12000),
                    updatedAt: timestamp,
                };

                if (index === -1) {
                    notes.unshift(note);
                } else {
                    notes[index] = note;
                }

                writeNotes(storage, notes);
                return note;
            },

            deleteNoteForArticle(articleId) {
                writeNotes(storage, readNotes(storage).filter((note) => note.articleId !== articleId));
            },

            clearNotes() {
                storage.removeItem(STORAGE_KEY);
                markArchiveDirty(storage);
            },
        };
    }

    function summarizeReadingNotesArchive(notes) {
        return {
            total: notes.length,
            recentNotes: sortNotes(notes).slice(0, 5),
        };
    }

    function readNotes(storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? sortNotes(parsed) : [];
        } catch (error) {
            return [];
        }
    }

    function writeNotes(storage, notes) {
        storage.setItem(STORAGE_KEY, JSON.stringify(sortNotes(notes)));
        markArchiveDirty(storage);
    }

    function markArchiveDirty(storage) { storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString()); }

    function sortNotes(notes) {
        return [...notes].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function createTimestamp(now) {
        return new Date(now()).toISOString();
    }

    function sanitizeText(value, limit = 5000) {
        return String(value || '').trim().slice(0, limit);
    }

    return {
        STORAGE_KEY,
        createReadingNotesStore,
        summarizeReadingNotesArchive,
    };
});
