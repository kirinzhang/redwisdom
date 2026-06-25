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
        return queryTokens.reduce((score, token) => {
            if (!candidateSet.has(token)) return score;
            return score + (isChineseUnigram(token) ? weight * 0.15 : weight);
        }, 0);
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function isChineseUnigram(token) {
        return /^[\u4e00-\u9fff]$/.test(token);
    }

    function isMeaningfulToken(token) {
        return Boolean(token) && !isChineseUnigram(token);
    }

    function selectedSourceHints(selectedSkills) {
        return asArray(selectedSkills)
            .flatMap((skill) => asArray(skill && skill.sourceHints))
            .map((hint) => String(hint || '').trim())
            .filter(Boolean);
    }

    function selectSkills(message, skills = [], limit = 3) {
        const queryTokens = tokenize(message);
        const meaningfulQueryTokens = queryTokens.filter(isMeaningfulToken);
        if (!meaningfulQueryTokens.length) return [];
        return asArray(skills)
            .map((skill) => {
                const skillTokens = tokenize([
                    skill.name,
                    skill.summary,
                    ...(skill.appliesTo || []),
                    ...(skill.keywords || []),
                    ...(skill.answerMoves || []),
                    skill.actionTemplate
                ].join(' '));
                let score = scoreByTokens(meaningfulQueryTokens, skillTokens, 4);
                for (const keyword of skill.keywords || []) {
                    if (String(message).includes(keyword)) score += 8;
                }
                return { ...skill, score };
            })
            .filter((skill) => skill.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    function excerpt(text, queryTokens) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        const hit = queryTokens.find((token) => token.length >= 2 && clean.includes(token));
        const start = hit ? Math.max(0, clean.indexOf(hit) - 80) : 0;
        return clean.slice(start, start + 220);
    }

    function scoreBySourceHints(chunk, hints) {
        const title = String(chunk.title || '');
        const text = String(chunk.text || '');
        return hints.reduce((score, hint) => {
            if (title === hint) return score + 120;
            if (title && (title.includes(hint) || hint.includes(title))) return score + 60;
            if (text.includes(hint)) return score + 35;
            return score;
        }, 0);
    }

    function rankChunks(message, selectedSkills = [], chunks = [], limit = 6) {
        const queryTokens = tokenize(message);
        const meaningfulQueryTokens = queryTokens.filter(isMeaningfulToken);
        const hints = selectedSourceHints(selectedSkills);
        const skillTokens = tokenize(asArray(selectedSkills).map((skill) => [
            skill.name,
            skill.summary,
            ...(skill.keywords || []),
            ...(skill.sourceHints || [])
        ].join(' ')).join(' '));
        const meaningfulSkillTokens = skillTokens.filter(isMeaningfulToken);
        const allTokens = Array.from(new Set([...meaningfulQueryTokens, ...meaningfulSkillTokens]));
        if (!allTokens.length && !hints.length) return [];
        return asArray(chunks)
            .map((chunk) => {
                const title = String(chunk.title || '');
                const text = String(chunk.text || '');
                const titleScore = meaningfulQueryTokens.some((token) => title.includes(token)) ? 12 : 0;
                const textScore = meaningfulQueryTokens.reduce((score, token) => score + (text.includes(token) ? 3 : 0), 0);
                const tokenScore = scoreByTokens(allTokens, chunk.tokens, 1);
                const sourceHintScore = scoreBySourceHints(chunk, hints);
                return {
                    ...chunk,
                    score: titleScore + textScore + tokenScore + sourceHintScore,
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
        return /自杀|自残|想死|死了算了|不想活|伤害自己|结束生命|活不下去|轻生/.test(String(message || ''));
    }

    window.RedWisdomRetrieval = {
        tokenize,
        selectSkills,
        rankChunks,
        articleUrl,
        hasCrisisSignal
    };
})();
