(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomHistoryCases = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const DEFAULT_TYPES = [
        ['investigation', '调查与判断', ['调查', '事实', '一线', '现场', '查清', '核实', '信息不足', '不了解情况', '用户研究', '访谈', '判断', '原因不清', '共同事实', '不知道原因']],
        ['priority', '主要矛盾与优先级', ['优先级', '事情太多', '同时推进', '抓重点', '主要矛盾', '取舍', '资源分散', '全局', '中心任务', '顾不过来']],
        ['failure-recovery', '失败纠错与复盘', ['失败', '犯错', '复盘', '纠正', '重来', '重新开始', '损失', '沉没成本', '调整方向', '方案失效', '承认错误', '翻旧账', '辩解']],
        ['long-term-pressure', '长期目标与压力', ['焦虑', '害怕', '担心', '悲观', '长期', '坚持', '看不到希望', '没信心', '进展很慢', '压力', '弱小', '耐心', '阶段', '信心', '士气']],
        ['team-conflict', '团队协作与冲突', ['团队冲突', '意见不合', '内部矛盾', '分歧', '争论', '内耗', '抱怨', '批评', '反馈', '不敢说', '共识', '互相指责', '信任', '追责', '沟通']],
        ['organization-governance', '组织扩张与治理', ['组织扩张', '信息孤岛', '职责不清', '管理层', '汇报', '制度', '个人包办', '会议', '治理', '纪律', '领导班子', '拍板', '规则', '负责人', '总部', '高管']],
        ['needs-communication', '真实需求与沟通', ['真实需求', '用户不接受', '不配合', '听不懂', '受众', '一线需求', '客户', '动员', '服务', '表达', '投诉']],
        ['resource-constraint', '资源不足与自力更生', ['资源不足', '资源不够', '没钱', '钱不够', '预算', '现金流', '现金危机', '人手不足', '人手不够', '物资', '自力更生', '生产', '互助', '成本', '后勤', '供应', '自建', '采购']],
        ['cooperation-boundaries', '合作联盟与边界', ['合作', '伙伴', '联盟', '大客户', '依赖', '边界', '决策权', '利益相关者', '退出', '团结']],
        ['execution-experiment', '执行试点与推广', ['执行', '试点', '推广', '落地', '一刀切', '实验', '验证', '先做', '迭代', '成熟度', '拖延']],
        ['learning-growth', '学习成长与能力', ['学习', '成长', '能力', '不懂', '经验主义', '教条', '技能', '知识', '提高', '总结经验', '理论', '陌生', '练习']],
        ['risk-decision', '风险决策与阶段管理', ['风险', '决策', '局势', '强弱', '阶段', '条件', '边界', '时机', '不确定', '危机', '止损']],
    ].map(([id, label, positiveCues]) => ({ id, label, positiveCues, methodTags: [] }));
    const DEFAULT_NO_ANALOGY_CUES = ['天气', '翻译', '验证码', '快递单号', '计算器', '写一首诗', '密码', '菜谱', '航班号', '股票价格'];
    const PUBLISHABLE_REVIEW_STATES = new Set(['source-reviewed', 'editor-approved']);

    function classifyProblem({ userMessage, problemTypes, noAnalogyCues } = {}) {
        const input = normalize(userMessage);
        const types = normalizeTypes(problemTypes);
        const blockedCue = (noAnalogyCues || DEFAULT_NO_ANALOGY_CUES).find((cue) => input.includes(normalize(cue)));
        const classifications = types.map((type) => {
            const matchedCues = (type.positiveCues || []).filter((cue) => input.includes(normalize(cue)));
            const queryTokens = new Set(tokenize(input));
            const cueTokenHits = (type.positiveCues || []).reduce((count, cue) => {
                const tokens = tokenize(cue);
                return count + tokens.filter((token) => queryTokens.has(token)).length;
            }, 0);
            const methodTokenHits = (type.methodTags || []).reduce((count, tag) => {
                return count + tokenize(tag).filter((token) => queryTokens.has(token)).length;
            }, 0);
            const score = matchedCues.reduce((sum, cue) => sum + 7 + Math.min(normalize(cue).length, 6), 0)
                + (cueTokenHits * 0.45)
                + (methodTokenHits * 0.3);
            return { id: type.id, label: type.label, score, matchedCues };
        }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

        return {
            blocked: Boolean(blockedCue),
            blockedCue: blockedCue || null,
            primaryType: classifications[0]?.id || null,
            types: classifications.slice(0, 3),
        };
    }

    function findRelevantHistoryCases({ userMessage, cases, problemTypes, noAnalogyCues, limit = 3, minScore = 2.8 }) {
        const classification = classifyProblem({ userMessage, problemTypes, noAnalogyCues });
        if (classification.blocked) return [];

        const publishedCases = (cases || []).filter(isPublishable);
        const queryTerms = expandSemanticTerms(userMessage, tokenize(userMessage));
        if (!queryTerms.length) return [];
        const corpus = buildCorpus(publishedCases);
        const scored = publishedCases.map((item, index) => {
            const lexicalScore = scoreBm25(corpus[index], queryTerms, corpus);
            const categoryScore = scoreCategories(item, classification);
            const phraseScore = scoreExactPhrases(item, userMessage);
            const semanticScore = scoreMethodSemantics(item, queryTerms);
            const negativePenalty = scoreNegativeCues(item, userMessage);
            const score = lexicalScore + categoryScore + phraseScore + semanticScore - negativePenalty;
            return {
                item,
                score,
                signals: { lexicalScore, categoryScore, phraseScore, semanticScore, negativePenalty },
            };
        });

        return scored
            .filter((result) => result.score >= minScore)
            .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
            .slice(0, limit)
            .map(({ item, score, signals }) => ({
                ...item,
                _retrieval: {
                    score: round(score),
                    problemType: classification.primaryType,
                    classifiedTypes: classification.types.map((type) => type.id),
                    signals: Object.fromEntries(Object.entries(signals).map(([key, value]) => [key, round(value)])),
                },
            }));
    }

    function buildHistoryContextMessage(cases, maxLength = 6200) {
        if (!(cases || []).length) return null;
        const blocks = cases.map((item, index) => {
            const source = item.source || {};
            const primary = (item.evidence || []).find((evidence) => evidence.type === 'primary');
            const href = buildReadingHref(source);
            return [
                `${index + 1}. 历史案例：${item.title}（${item.period}）`,
                `历史问题：${item.challenge}`,
                `史料边界（不得越过）：${item.sourceBoundary}`,
                `采取的方法：${(item.actions || []).join('；')}`,
                `历史结果：${item.outcome || '未提供'}`,
                `可迁移方法：${item.transferMethod}`,
                `关键差异与边界：${item.limits}`,
                `原文：${source.articleTitle || ''}${href ? `｜${href}` : ''}`,
                primary?.excerpt ? `原文核验摘录：${primary.excerpt}` : '',
                `史料核对：${getAuthorityEvidence(item)}`,
            ].filter(Boolean).join('\n');
        });
        return {
            role: 'system',
            content: [
                '可参考的党史案例：',
                '优先选择最贴切的一例展开；问题确实涉及不同层面时，最多使用两例。只有在确有相似条件时才使用。',
                '回答必须分别写明“相似之处”“关键差异”“可迁移方法”，并把历史方法转成用户下一步可执行的调查或行动。不得暗示历史结果会在用户情境中重演。',
                '案例中的“历史问题”“采取的方法”“历史结果”是经过来源核对的编辑概括，不是原文直接引语。引用或转述史实时，就近标明原文文章名或“史料核对”来源；编辑概括要写成“案例材料概括为”，不要伪装成史料原句。',
                '历史事实、因果和结果只能使用案例及其证据明确提供的内容；不得把用户描述中的现代问题词反向写成当年的史实，不得补写人物动机、对话、数字或其他未经提供的细节。',
                '只有逐字内容确实出现在另行提供的毛选原文上下文时才能使用引号；本案例库具体指“原文核验摘录”中的内容。其余内容必须转述且不加引号。材料不足时直接说明“不足以确认”，宁可省略也不要推测。',
                ...blocks,
                '最终核对：上面的“史料边界”是禁止性约束。写相似之处时只能说明结构上的类比，不得声称历史案例曾出现用户问题中的现代现象、术语或管理场景。',
                ...cases.map((item, index) => `${index + 1}. 不得声称：${item.sourceBoundary}`),
            ].join('\n\n').slice(0, maxLength),
        };
    }

    function buildHistoryMirrorModel(cases) {
        return (cases || []).map((item) => {
            const primary = (item.evidence || []).find((evidence) => evidence.type === 'primary');
            const authority = (item.evidence || []).find((evidence) => evidence.type === 'authoritative-history');
            return {
                id: item.id,
                title: item.title,
                period: item.period,
                challenge: item.challenge,
                transferMethod: item.transferMethod,
                limits: item.limits,
                problemType: item._retrieval?.problemType || item.problemTypes?.[0] || null,
                readingHref: buildReadingHref(item.source),
                articleTitle: item.source?.articleTitle || primary?.title || '',
                primaryExcerpt: primary?.excerpt || '',
                authorityTitle: authority?.title || '',
                authorityUrl: authority?.url || '',
            };
        });
    }

    function buildCorpus(cases) {
        return cases.map((item) => {
            const weightedTerms = new Map();
            addWeightedTokens(weightedTerms, item.title, 5.5);
            addWeightedTokens(weightedTerms, (item.keywords || []).join(' '), 4.5);
            addWeightedTokens(weightedTerms, (item.retrieval?.aliases || []).join(' '), 3.8);
            addWeightedTokens(weightedTerms, (item.applicableProblems || []).join(' '), 3.5);
            addWeightedTokens(weightedTerms, (item.methodology || []).join(' '), 3.2);
            addWeightedTokens(weightedTerms, `${item.challenge || ''} ${item.transferMethod || ''}`, 1.2);
            return { weightedTerms, length: [...weightedTerms.values()].reduce((sum, value) => sum + value, 0) || 1 };
        });
    }

    function scoreBm25(document, queryTerms, corpus) {
        const averageLength = corpus.reduce((sum, item) => sum + item.length, 0) / Math.max(corpus.length, 1);
        const uniqueQueryTerms = [...new Set(queryTerms)];
        return uniqueQueryTerms.reduce((score, term) => {
            const frequency = document.weightedTerms.get(term) || 0;
            if (!frequency) return score;
            const documentFrequency = corpus.filter((item) => item.weightedTerms.has(term)).length;
            const inverseFrequency = Math.log(1 + ((corpus.length - documentFrequency + 0.5) / (documentFrequency + 0.5)));
            const denominator = frequency + 1.2 * (0.25 + (0.75 * document.length / averageLength));
            return score + inverseFrequency * ((frequency * 2.2) / denominator);
        }, 0);
    }

    function scoreCategories(item, classification) {
        return classification.types.reduce((score, type, index) => {
            if (!item.problemTypes?.includes(type.id)) return score;
            return score + Math.max(2.5, 8 - (index * 2)) + Math.min(type.score / 12, 4);
        }, 0);
    }

    function scoreExactPhrases(item, userMessage) {
        const input = normalize(userMessage);
        const phrases = unique([
            ...(item.keywords || []),
            ...(item.retrieval?.aliases || []),
            ...(item.applicableProblems || []),
        ]).filter((phrase) => normalize(phrase).length >= 2);
        return phrases.reduce((score, phrase) => {
            const normalizedPhrase = normalize(phrase);
            return score + (input.includes(normalizedPhrase) ? 5 + Math.min(normalizedPhrase.length / 2, 4) : 0);
        }, 0);
    }

    function scoreMethodSemantics(item, queryTerms) {
        const query = new Set(queryTerms);
        return [...(item.methodology || []), ...(item.retrieval?.aliases || [])].reduce((score, value) => {
            const overlap = tokenize(value).filter((term) => query.has(term)).length;
            return score + Math.min(overlap * 0.35, 1.4);
        }, 0);
    }

    function scoreNegativeCues(item, userMessage) {
        const input = normalize(userMessage);
        return (item.retrieval?.negativeCues || []).reduce((score, cue) => score + (input.includes(normalize(cue)) ? 20 : 0), 0);
    }

    function isPublishable(item) {
        const reviewState = item.review?.status;
        const reviewPassed = !reviewState || PUBLISHABLE_REVIEW_STATES.has(reviewState);
        return item.verification?.status === 'cross-checked' && reviewPassed;
    }

    function tokenize(value) {
        const input = normalize(value);
        const terms = new Set();
        input.split(/[^\u4e00-\u9fffa-z0-9]+/).filter(Boolean).forEach((segment) => {
            if (/^[a-z0-9]+$/.test(segment)) {
                if (segment.length >= 2) terms.add(segment);
                return;
            }
            if (segment.length >= 2) terms.add(segment);
            for (let index = 0; index <= segment.length - 2; index += 1) terms.add(segment.slice(index, index + 2));
        });
        return [...terms];
    }

    function expandSemanticTerms(value, initialTerms) {
        const input = normalize(value);
        const terms = new Set(initialTerms || []);
        const semanticGroups = [
            [['焦虑', '害怕', '担心', '没信心', '看不到希望', '前途迷茫'], ['悲观', '前景', '趋势', '长期', '阶段', '信心']],
            [['失败', '犯错', '做错', '走错', '重来', '重新开始', '挫折'], ['错误', '纠正', '路线', '损失', '复盘', '止损']],
            [['意见不合', '内部矛盾', '互相指责', '团队内耗', '思想不统一', '各说各话'], ['整风', '批评', '自我批评', '团结', '主观主义', '共同语言']],
            [['拖延', '坚持不下去', '长期目标', '进展很慢', '压力很久'], ['长期', '阶段', '节奏', '持久', '落实', '检查']],
            [['不知道原因', '信息不足', '不了解情况', '不知道怎么办', '怎么判断', '如何选择'], ['调查', '事实', '原因', '现状', '验证', '一线']],
            [['同事不配合', '团队不执行', '对方不配合', '用户不接受', '沟通没用'], ['需求', '执行', '群众', '调查', '支持', '服务']],
            [['钱不够', '没钱', '预算不足', '现金流', '资源不够', '人手不够'], ['预算', '现金流', '资源', '成本', '生产', '供给']],
            [['事情太多', '同时推进', '多个冲突', '顾不过来', '优先级'], ['集中', '主要矛盾', '任务太多', '暂缓', '重点']],
            [['背后议论', '会后抱怨', '开会不说', '不敢反馈', '熟人关系'], ['公开讨论', '原则性沟通', '组织纪律', '反馈', '桌面']],
            [['合作边界', '依赖客户', '合作伙伴', '决策权', '联合项目'], ['独立自主', '合作边界', '决策权', '退出', '统一战线']],
            [['信息孤岛', '不了解一线', '汇报太多', '汇报没重点', '组织扩张'], ['报告', '信息反馈', '管理层', '一线', '互通情报']],
            [['一刀切', '情况不同', '成熟度不同', '因地制宜', '分层推进'], ['分类指导', '分层', '成熟度', '政策适配', '试点']],
            [['会议低效', '开会没结果', '领导班子', '无法形成共识'], ['会议方法', '集体领导', '议题', '共识', '党委会']],
            [['能力互补', '资源共享', '社区互助', '一个人做不完'], ['互助', '资源整合', '组织起来', '协作']],
        ];

        semanticGroups.forEach(([triggers, concepts]) => {
            if (triggers.some((trigger) => input.includes(trigger))) {
                concepts.forEach((concept) => tokenize(concept).forEach((term) => terms.add(term)));
            }
        });
        return [...terms];
    }

    function addWeightedTokens(map, value, weight) {
        tokenize(value).forEach((term) => map.set(term, (map.get(term) || 0) + weight));
    }

    function normalizeTypes(problemTypes) {
        if (Array.isArray(problemTypes)) return problemTypes;
        if (Array.isArray(problemTypes?.types)) return problemTypes.types;
        return DEFAULT_TYPES;
    }

    function normalize(value) {
        return String(value || '').toLowerCase().trim();
    }

    function unique(values) {
        return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
    }

    function round(value) {
        return Math.round(value * 100) / 100;
    }

    function buildReadingHref(source) {
        if (!source?.articleId) return '';
        return `reading.html?article=${encodeURIComponent(source.articleId)}&anchor=${encodeURIComponent(source.anchor || '')}`;
    }

    function getAuthorityEvidence(item) {
        const evidence = (item.evidence || []).find((source) => source.type === 'authoritative-history');
        if (!evidence) return '未提供';
        return `${evidence.title}${evidence.url ? `｜${evidence.url}` : ''}`;
    }

    return {
        buildHistoryContextMessage,
        buildHistoryMirrorModel,
        classifyProblem,
        expandSemanticTerms,
        findRelevantHistoryCases,
        tokenize,
    };
});
