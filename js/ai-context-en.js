(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomAIContextEn = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    'use strict';

    // 英文版问道的原文检索：在外文出版社英译本《毛泽东选集》的段落和语录中找与问题相关的材料。
    // 用词频加权（IDF）的词项匹配；索引在第一次调用时按数据数组缓存。

    const STOPWORDS = new Set(('a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves '
        + 'also always am anyone anything around away back become came come comes doesn don dont even every get gets getting go goes going got gotten im ive keep know like lot make makes making many may maybe might much must need never new now often one people really said say says see seem seems since someone something still take tell thing things think time try trying two us use used want wants way well whats whether without work yet').split(/\s+/));

    function stem(word) {
        let w = word;
        if (w.length > 5 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
        else if (w.length > 4 && w.endsWith('es') && /(ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2);
        else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
        if (w.length > 6 && w.endsWith('ing')) w = w.slice(0, -3);
        else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
        else if (w.length > 6 && w.endsWith('ly')) w = w.slice(0, -2);
        return w;
    }

    function tokenize(text) {
        return String(text || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/)
            .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
            .map(stem);
    }

    // 现代说法与毛选方法之间的词汇差距很大（"priorities" 对 "principal contradiction"），
    // 先按问题里的说法识别方法，再补上英译本里的术语，并优先这些方法的代表篇目。
    const METHODS = [
        { triggers: /priorit|first|main (?:problem|issue|thing)|most important|focus|too many|juggl|overwhelm|which (?:one|thing|task)|where to start|bottleneck|key/,
            terms: ['principal', 'contradiction', 'aspect', 'link', 'chain', 'center'], articles: ['016-on-contradiction.md', '146-methods-of-work-of-party-committees.md', '069-some-questions-concerning-methods-of-leadership.md'] },
        { triggers: /conflict|argu|disagree|tension|fight|quarrel|dilemma|torn|choose|choice|oppos|clash/,
            terms: ['contradiction', 'opposite', 'struggle', 'unity', 'identity'], articles: ['016-on-contradiction.md', '215-on-the-correct-handling-of-contradictions-among-the-people.md'] },
        { triggers: /don.?t know|unsure|unclear|not sure|research|data|fact|customer|user|market|decid|decision|information|assum|guess/,
            terms: ['investigation', 'investigate', 'facts', 'study', 'conditions', 'subjectivism', 'truth'], articles: ['228-oppose-book-worship.md', '058-reform-our-study.md', '001-report-on-an-investigation-of-the-peasant-movement-in-hunan.md', '062-rectify-the-party-s-style-of-work.md'] },
        { triggers: /theor|learn|plan|try|experiment|test|idea|overthink|start|book|course|skill/,
            terms: ['practice', 'knowledge', 'test', 'experience', 'perceptual', 'rational'], articles: ['015-on-practice.md', '058-reform-our-study.md'] },
        { triggers: /long|slow|progress|patien|persever|give up|quit|tired|setback|fail|anxi|worr|procrastinat|stuck|hopeless|discourag|hard/,
            terms: ['protracted', 'persevere', 'difficulties', 'arduous', 'struggle', 'victory', 'mountain'], articles: ['025-on-protracted-war.md', '082-the-foolish-old-man-who-removed-the-mountains.md'] },
        { triggers: /team|colleague|people|staff|employee|family|friend|communit|lead|manag|boss|partner|parent|member/,
            terms: ['masses', 'unite', 'leadership', 'cadres', 'concern', 'well'], articles: ['069-some-questions-concerning-methods-of-leadership.md', '009-be-concerned-with-the-well-being-of-the-masses-pay-attention.md', '146-methods-of-work-of-party-committees.md'] },
        { triggers: /mistake|wrong|blame|fault|regret|feedback|critici|ego|failed|error/,
            terms: ['criticism', 'self', 'mistakes', 'correct', 'shortcomings', 'errors'], articles: ['019-combat-liberalism.md', '075-serve-the-people.md', '062-rectify-the-party-s-style-of-work.md'] },
    ];

    function methodsFor(message) {
        const text = String(message || '').toLowerCase();
        return METHODS.filter((m) => m.triggers.test(text));
    }

    const cache = typeof WeakMap === 'function' ? new WeakMap() : null;

    function buildIndex(passages) {
        if (cache && cache.has(passages)) return cache.get(passages);
        const docs = passages.map((p) => {
            const terms = new Map();
            for (const t of tokenize(`${p.title} ${p.text}`)) terms.set(t, (terms.get(t) || 0) + 1);
            return { p, terms, len: p.text.length };
        }).filter((d) => d.len >= 120 && d.p.text !== d.p.title); // 标题行、日期行等太短的块不参与检索
        const df = new Map();
        for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) || 0) + 1);
        const index = { docs, df, n: docs.length };
        if (cache) cache.set(passages, index);
        return index;
    }

    function findRelevantPassages({ userMessage, passages, limit = 4 }) {
        if (!passages || !passages.length) return [];
        const index = buildIndex(passages);
        const methods = methodsFor(userMessage);
        const own = [...new Set(tokenize(userMessage))];
        const expanded = [...new Set(methods.flatMap((m) => m.terms.map(stem)))].filter((t) => !own.includes(t));
        if (!own.length && !expanded.length) return [];
        const idf = (t) => Math.log(1 + index.n / (1 + (index.df.get(t) || 0)));
        const weights = [...own.map((t) => [t, idf(t)]), ...expanded.map((t) => [t, idf(t) * 0.9])];
        const boosted = new Set(methods.flatMap((m) => m.articles));
        const scored = [];
        for (const d of index.docs) {
            let score = 0;
            for (const [t, w] of weights) {
                const tf = d.terms.get(t);
                if (tf) score += w * (1 + Math.log(tf));
            }
            if (score > 0) scored.push({ d, score: (score / Math.sqrt(1 + d.len / 600)) * (boosted.has(d.p.articleId) ? 1.6 : 1) });
        }
        scored.sort((a, b) => b.score - a.score);
        const seenArticles = new Map();
        const out = [];
        for (const { d } of scored) {
            const count = seenArticles.get(d.p.articleId) || 0;
            if (count >= 2) continue; // 同一篇最多取两段，避免材料过于集中
            seenArticles.set(d.p.articleId, count + 1);
            out.push(d.p);
            if (out.length >= limit) break;
        }
        return out;
    }

    function trimPassage(text, max = 520) {
        const value = String(text || '').replace(/\s+/g, ' ').trim();
        if (value.length <= max) return value;
        const cut = value.slice(0, max);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
        return `${end > max * 0.5 ? cut.slice(0, end + 1) : cut}…`;
    }

    function readingHref(passage) {
        return `reading.html?lang=en&article=${encodeURIComponent(passage.articleId)}&anchor=${encodeURIComponent(passage.anchor)}`;
    }

    function buildContextMessage(passages, maxLength = 2600) {
        if (!passages.length) return null;
        const lines = [
            'Relevant passages from the Selected Works of Mao Tse-tung (English translation, Foreign Languages Press, Peking):',
            'When you use them, name the article. Quote only words that appear below; if the material is not enough, say you are summarising the method. You may link a passage with its locator.',
            ...passages.map((p, i) => `${i + 1}. "${p.title}" (locator: ${readingHref(p)}): ${trimPassage(p.text)}`),
        ];
        return { role: 'system', content: lines.join('\n').slice(0, maxLength) };
    }

    return { tokenize, stem, methodsFor, findRelevantPassages, buildContextMessage, readingHref };
});
