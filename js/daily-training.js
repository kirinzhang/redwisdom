(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomDailyTraining = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function buildDailyTrainingPlan(archive = {}) {
        const practices = sortByUpdatedAt(archive.practices || []);
        const readingProgress = sortByUpdatedAt(archive.readingProgress || []);
        const conversations = sortByUpdatedAt(archive.conversations || []);
        const savedAnswers = sortByUpdatedAt(archive.savedAnswers || []);
        const savedQuotes = sortByUpdatedAt(archive.savedQuotes || []);
        const pendingReviewPractices = practices.filter((practice) => practice.status === 'done' && !sanitizeText(practice.reflection));
        const activePractices = practices.filter((practice) => practice.status === 'active');
        const draftPractices = practices.filter((practice) => practice.status === 'draft');
        const inProgressArticles = readingProgress.filter((entry) => Number(entry.progressPercent || 0) < 100);
        const recommendations = [
            ...pendingReviewPractices.map(createReviewItem),
            ...activePractices.map(createPracticeItem),
            ...draftPractices.map(createDraftItem),
            ...inProgressArticles.map(createReadingItem),
            ...conversations.slice(0, 1).map(createConversationItem),
            ...savedAnswers.slice(0, 1).map(createSavedAnswerItem),
            ...savedQuotes.slice(0, 1).map(createSavedQuoteItem),
        ];
        const primary = recommendations[0] || createVisitorPrimaryItem();
        const secondary = recommendations.length > 1
            ? recommendations.slice(1, 4)
            : createVisitorSecondaryItems();

        return {
            primary,
            secondary,
            methodologyTags: summarizeMethodologyTags([
                ...pendingReviewPractices,
                ...activePractices,
                ...draftPractices,
                ...practices.filter((practice) => !['done', 'active', 'draft'].includes(practice.status)),
                ...conversations,
                ...savedAnswers,
                ...savedQuotes,
            ]),
            stats: {
                totalRecords: practices.length + readingProgress.length + conversations.length + savedAnswers.length + savedQuotes.length,
                activePractices: activePractices.length,
                pendingReviews: pendingReviewPractices.length,
                readingInProgress: inProgressArticles.length,
            },
        };
    }

    function createReviewItem(practice) {
        return {
            type: 'review',
            title: `复盘：${sanitizeText(practice.title) || '未命名实践'}`,
            description: sanitizeText(practice.actualResult) || sanitizeText(practice.actionPlan) || '记录实际结果、复盘原因，再确定下一步。',
            href: `practice.html#${encodeURIComponent(practice.id || '')}`,
            meta: '完成后先复盘',
        };
    }

    function createPracticeItem(practice) {
        return {
            type: 'practice',
            title: `今日实践：${sanitizeText(practice.title) || '未命名实践'}`,
            description: sanitizeText(practice.actionPlan) || sanitizeText(practice.realProblem) || '把当前问题推进一个最小行动。',
            href: `practice.html#${encodeURIComponent(practice.id || '')}`,
            meta: '今日待做',
        };
    }

    function createDraftItem(practice) {
        return {
            type: 'draft',
            title: `启动实践：${sanitizeText(practice.title) || '未命名实践'}`,
            description: sanitizeText(practice.actionPlan) || '把草稿改成今天能完成的一步。',
            href: `practice.html#${encodeURIComponent(practice.id || '')}`,
            meta: '草稿',
        };
    }

    function createReadingItem(entry) {
        return {
            type: 'reading',
            title: `继续阅读：${sanitizeText(entry.articleTitle, 120) || '毛选原文'}`,
            description: `已读 ${normalizePercent(entry.progressPercent)}%，继续从原文里找方法。`,
            href: `reading.html#${encodeURIComponent(entry.articleId || '')}`,
            meta: '继续阅读',
        };
    }

    function createConversationItem(conversation) {
        return {
            type: 'chat',
            title: `继续问道：${sanitizeText(conversation.title, 60) || '现实问题'}`,
            description: '带着新的事实、行动结果或矛盾变化继续追问。',
            href: 'chat.html',
            meta: '问答追踪',
        };
    }

    function createSavedAnswerItem(answer) {
        return {
            type: 'saved-answer',
            title: `回看回答：${sanitizeText(answer.title, 60) || '收藏回答'}`,
            description: '从收藏回答里挑一个判断，转成今天可验证的行动。',
            href: 'me.html#savedAnswerList',
            meta: '收藏回答',
        };
    }

    function createSavedQuoteItem(quote) {
        return {
            type: 'saved-quote',
            title: `用语录实践：${sanitizeText(quote.source, 60) || '毛选语录'}`,
            description: sanitizeText(quote.content, 72) || '从收藏语录里提炼一个今日行动。',
            href: 'me.html#savedQuoteList',
            meta: '收藏语录',
        };
    }

    function createVisitorPrimaryItem() {
        return {
            type: 'draw-card',
            title: '抽一张，开始今天的训练',
            description: '先把当前困惑放在心里，再用抽到的语录进入原文、问道或实践。',
            href: '#start-area',
            meta: '游客也可使用',
        };
    }

    function createVisitorSecondaryItems() {
        return [
            {
                type: 'reading',
                title: '读《实践论》',
                description: '从认识和行动的关系开始，建立第一条方法线。',
                href: 'reading.html#016-%E5%AE%9E%E8%B7%B5%E8%AE%BA.md',
                meta: '推荐原文',
            },
            {
                type: 'chat',
                title: '用问题问道',
                description: '把现实问题带入事实、调查、矛盾和行动的结构。',
                href: 'chat.html',
                meta: '结构化问答',
            },
        ];
    }

    function summarizeMethodologyTags(records) {
        const counts = new Map();
        const order = new Map();

        records.forEach((record) => {
            (record.methodologyTags || []).forEach((tag) => {
                const cleanTag = sanitizeText(tag, 40);
                if (!cleanTag) return;
                if (!order.has(cleanTag)) {
                    order.set(cleanTag, order.size);
                }
                counts.set(cleanTag, (counts.get(cleanTag) || 0) + 1);
            });
        });

        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || order.get(a[0]) - order.get(b[0]))
            .slice(0, 5);
    }

    function sortByUpdatedAt(items) {
        return [...items].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function normalizePercent(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.min(100, Math.max(0, Math.round(number)));
    }

    function sanitizeText(value, limit = 5000) {
        return String(value || '').trim().slice(0, limit);
    }

    return {
        buildDailyTrainingPlan,
    };
});
