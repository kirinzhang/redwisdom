(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomTextAnchors = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function normalizeAnchorText(value) {
        return String(value || '')
            .replace(/\s+/g, '')
            .replace(/[\u200b-\u200d\ufeff]/g, '')
            .trim();
    }

    function hashText(value) {
        const text = normalizeAnchorText(value);
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function createAnchorId(text, occurrence = 1) {
        const suffix = occurrence > 1 ? `-${occurrence}` : '';
        return `p-${hashText(text)}${suffix}`;
    }

    function assignTextAnchors(container) {
        if (!container?.querySelectorAll) return [];
        const occurrences = new Map();
        return [...container.querySelectorAll('h1, h2, h3, h4, p, li')].map((element) => {
            const normalized = normalizeAnchorText(element.textContent);
            if (!normalized) return null;
            const hash = hashText(normalized);
            const occurrence = (occurrences.get(hash) || 0) + 1;
            occurrences.set(hash, occurrence);
            const id = createAnchorId(normalized, occurrence);
            element.id = id;
            element.classList.add('scroll-mt-20');
            return id;
        }).filter(Boolean);
    }

    return { assignTextAnchors, createAnchorId, hashText, normalizeAnchorText };
});
