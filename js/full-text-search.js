(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomFullTextSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function searchIndex(records, query, limit = 20) {
        const terms = tokenize(query);
        if (!terms.length) return [];

        return (records || [])
            .map((record, index) => ({
                ...record,
                score: scoreRecord(record, terms) + (1 / (index + 10000)),
            }))
            .filter((record) => record.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ score, ...record }) => ({
                ...record,
                snippet: createSnippet(record.text, terms),
            }));
    }

    function scoreRecord(record, terms) {
        const title = normalize(record.title);
        const text = normalize(record.text);
        return terms.reduce((score, term) => {
            if (!text.includes(term) && !title.includes(term)) return score;
            const exactTitle = title.includes(term) ? 8 : 0;
            const occurrences = Math.min(5, text.split(term).length - 1);
            return score + exactTitle + occurrences * 2;
        }, 0);
    }

    function createSnippet(text, terms, radius = 54) {
        const value = String(text || '').replace(/\s+/g, ' ').trim();
        const lower = value.toLowerCase();
        const positions = terms.map((term) => lower.indexOf(term)).filter((position) => position >= 0);
        const position = positions.length ? Math.min(...positions) : 0;
        const start = Math.max(0, position - radius);
        const end = Math.min(value.length, position + radius * 2);
        return `${start > 0 ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`;
    }

    function tokenize(query) {
        const normalized = normalize(query);
        if (!normalized) return [];
        const chunks = normalized.split(/[^\u4e00-\u9fa5a-z0-9]+/).filter(Boolean);
        const terms = new Set(chunks);
        chunks.forEach((chunk) => {
            if (/^[\u4e00-\u9fa5]+$/.test(chunk) && chunk.length >= 4) {
                for (let index = 0; index <= chunk.length - 2; index += 1) terms.add(chunk.slice(index, index + 2));
            }
        });
        return [...terms];
    }

    function normalize(value) {
        return String(value || '').toLowerCase().trim();
    }

    return { createSnippet, searchIndex, tokenize };
});
