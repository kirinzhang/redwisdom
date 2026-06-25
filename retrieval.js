(function () {
    function tokenize(text) {
        const normalized = String(text || '').toLowerCase();
        const ascii = normalized.match(/[a-z0-9]+/g) || [];
        const chinese = Array.from(normalized.replace(/[^\u4e00-\u9fff]/g, ''));
        const grams = [];
        for (let i = 0; i < chinese.length; i += 1) {
            grams.push(chinese[i]);
            if (i < chinese.length - 1) grams.push(chinese[i] + chinese[i + 1]);
        }
        return Array.from(new Set([...ascii, ...grams])).filter(Boolean);
    }

    function scoreByTokens(queryTokens, candidateTokens, weight) {
        const candidateSet = new Set(candidateTokens || []);
        return queryTokens.reduce((score, token) => score + (candidateSet.has(token) ? weight : 0), 0);
    }

    function selectSkills(message, skills, limit = 3) {
        const queryTokens = tokenize(message);
        return [...skills]
            .map((skill) => {
                const skillTokens = tokenize([
                    skill.name,
                    skill.summary,
                    ...(skill.appliesTo || []),
                    ...(skill.keywords || []),
                    ...(skill.answerMoves || []),
                    skill.actionTemplate
                ].join(' '));
                let score = scoreByTokens(queryTokens, skillTokens, 4);
                for (const keyword of skill.keywords || []) {
                    if (String(message).includes(keyword)) score += 8;
                }
                return { ...skill, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    function excerpt(text, queryTokens) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        const hit = queryTokens.find((token) => token.length >= 2 && clean.includes(token));
        const start = hit ? Math.max(0, clean.indexOf(hit) - 80) : 0;
        return clean.slice(start, start + 220);
    }

    function rankChunks(message, selectedSkills, chunks, limit = 6) {
        const queryTokens = tokenize(message);
        const skillTokens = tokenize(selectedSkills.map((skill) => [
            skill.name,
            skill.summary,
            ...(skill.keywords || []),
            ...(skill.sourceHints || [])
        ].join(' ')).join(' '));
        const allTokens = Array.from(new Set([...queryTokens, ...skillTokens]));
        return [...chunks]
            .map((chunk) => {
                const titleScore = queryTokens.some((token) => chunk.title.includes(token)) ? 12 : 0;
                const textScore = queryTokens.reduce((score, token) => score + (chunk.text.includes(token) ? 3 : 0), 0);
                const tokenScore = scoreByTokens(allTokens, chunk.tokens, 1);
                return {
                    ...chunk,
                    score: titleScore + textScore + tokenScore,
                    excerpt: excerpt(chunk.text, queryTokens)
                };
            })
            .filter((chunk) => chunk.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    function articleUrl(filename, title) {
        return `reading.html#${encodeURIComponent(filename)}?source=${encodeURIComponent(title || '')}`;
    }

    function hasCrisisSignal(message) {
        return /自杀|不想活|伤害自己|结束生命|活不下去|轻生/.test(String(message || ''));
    }

    window.RedWisdomRetrieval = {
        tokenize,
        selectSkills,
        rankChunks,
        articleUrl,
        hasCrisisSignal
    };
})();
