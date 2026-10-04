(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomCognitionSpiral = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    // 实践—认识螺旋：把一个问题的过程记录按复盘切分成若干轮，
    // 每轮整理出“认识 → 实践 → 检验 → 再认识”四步，不需要用户额外填写。

    const VERDICT_LABELS = { pending: '待核实', confirmed: '证实', refuted: '推翻', partial: '部分证实' };
    const PRACTICE_TYPES = new Set(['practice', 'conversation', 'note', 'reading']);

    const time = (value) => {
        const t = Date.parse(value || '');
        return Number.isFinite(t) ? t : 0;
    };

    function inWindow(value, start, end) {
        const t = time(value);
        return t > start && t <= end;
    }

    function versionAt(versions, t) {
        let found = null;
        for (const version of versions) if (time(version.at) <= t) found = version;
        return found;
    }

    function buildCognitionSpiral(problemCase) {
        const activities = [...(problemCase?.activities || [])].sort((a, b) => time(a.createdAt) - time(b.createdAt));
        const investigations = problemCase?.investigations || [];
        const versions = [...(problemCase?.contradictionMap?.versions || [])].sort((a, b) => time(a.at) - time(b.at));
        const reviews = activities.filter((a) => a.type === 'review');
        const origin = time(problemCase?.createdAt) - 1;

        const boundaries = reviews.map((r) => time(r.createdAt));
        const lastBoundary = boundaries.length ? boundaries[boundaries.length - 1] : origin;
        const hasOngoing = !reviews.length
            || activities.some((a) => time(a.createdAt) > lastBoundary)
            || investigations.some((i) => time(i.createdAt) > lastBoundary)
            || versions.some((v) => time(v.at) > lastBoundary);
        const ends = [...boundaries, ...(hasOngoing ? [Infinity] : [])];

        let start = origin;
        const rounds = ends.map((end, index) => {
            const review = Number.isFinite(end) ? reviews[index] : null;
            const startVersion = versionAt(versions, start) || versions.find((v) => inWindow(v.at, start, end)) || null;
            const roundVersions = versions.filter((v) => inWindow(v.at, start, end));
            const lastVersion = roundVersions[roundVersions.length - 1] || null;
            const shift = startVersion && lastVersion && startVersion.mainText !== lastVersion.mainText
                ? { from: startVersion.mainText, to: lastVersion.mainText }
                : null;
            const checked = investigations
                .filter((i) => i.verdict !== 'pending' && inWindow(i.resolvedAt, start, end))
                .map((i) => ({ question: i.question, verdict: i.verdict, verdictLabel: VERDICT_LABELS[i.verdict], finding: i.finding }));
            const opened = investigations.filter((i) => inWindow(i.createdAt, start, end)).map((i) => i.question);
            const practices = activities.filter((a) => PRACTICE_TYPES.has(a.type) && inWindow(a.createdAt, start, end)).map((a) => ({ type: a.type, title: a.title }));
            const meta = review?.metadata || {};
            const round = {
                index: index + 1,
                status: review ? 'done' : 'ongoing',
                startedAt: Number.isFinite(start) && start > 0 ? new Date(start + 1).toISOString() : '',
                endedAt: review ? review.createdAt : '',
                knowing: {
                    mainContradiction: startVersion?.mainText || (index === 0 ? problemCase?.mainContradiction || '' : ''),
                    questions: opened,
                },
                practice: {
                    expected: meta.expectedResult || '',
                    actions: practices,
                },
                test: {
                    actual: meta.actualResult || '',
                    evidence: meta.evidence || '',
                    checked,
                },
                rethink: {
                    reflection: meta.reflection || review?.detail || '',
                    nextAction: meta.nextAction || '',
                    shift,
                },
            };
            start = end;
            return round;
        });

        const shifts = [];
        for (let i = 1; i < versions.length; i += 1) {
            if (versions[i].mainText !== versions[i - 1].mainText) shifts.push({ at: versions[i].at, from: versions[i - 1].mainText, to: versions[i].mainText, note: versions[i].note });
        }
        const resolved = investigations.filter((i) => i.verdict !== 'pending');
        return {
            rounds,
            shifts,
            stats: {
                rounds: rounds.filter((r) => r.status === 'done').length,
                checked: resolved.length,
                refuted: resolved.filter((i) => i.verdict === 'refuted').length,
                pending: investigations.filter((i) => i.verdict === 'pending').length,
            },
        };
    }

    return { buildCognitionSpiral, VERDICT_LABELS };
});
