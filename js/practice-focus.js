(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomPracticeFocus = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function chooseReviewFocusSelector(practice = {}) {
        if (!hasText(practice.actualResult)) return '.actualInput';
        if (!hasText(practice.reflection)) return '.reflectionInput';
        if (!hasText(practice.nextAction)) return '.nextInput';
        return '.statusInput';
    }

    function getPracticeIdFromHash(locationObject) {
        const hash = String(locationObject?.hash || '');
        if (!hash.startsWith('#')) return '';

        try {
            return decodeURIComponent(hash.slice(1)).trim();
        } catch (error) {
            return hash.slice(1).trim();
        }
    }

    function findPracticeById(practices, practiceId) {
        return (practices || []).find((practice) => practice.id === practiceId) || null;
    }

    function hasText(value) {
        return String(value || '').trim().length > 0;
    }

    return {
        chooseReviewFocusSelector,
        findPracticeById,
        getPracticeIdFromHash,
    };
});
