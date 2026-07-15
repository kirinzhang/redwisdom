(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomQuoteUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const CATEGORY_TAGS = {
        '调查研究': ['调查研究', '实事求是'],
        '思维方法': ['矛盾分析', '实事求是'],
        '实践精神': ['实践检验', '行动'],
        '工作方法': ['主要矛盾', '组织方法'],
        '群众路线': ['群众路线', '调查研究'],
        '坚持奋斗': ['持久战', '长期斗争'],
        '信念勇气': ['持久战', '长期斗争'],
        '自我批评': ['自我批评', '自我修正'],
        '学习态度': ['实践检验', '反对本本主义'],
    };

    const SOURCE_TAGS = {
        '反对本本主义': ['反对本本主义'],
        '实践论': ['实践检验'],
        '矛盾论': ['矛盾分析', '主要矛盾'],
        '论持久战': ['持久战'],
        '关心群众生活，注意工作方法': ['群众路线', '组织方法'],
        '党委会的工作方法': ['组织方法'],
        '反对自由主义': ['自我批评'],
        '反对党八股': ['反对主观主义'],
        '整顿党的作风': ['反对主观主义', '实事求是'],
    };

    function getQuotePresentation(content) {
        const len = String(content || '').length;

        if (len > 80) {
            return {
                fontSizeClass: 'quote-size-xs',
                layoutClass: 'layout-top',
            };
        }

        if (len > 40) {
            return {
                fontSizeClass: 'quote-size-small',
                layoutClass: 'layout-top',
            };
        }

        if (len < 20) {
            return {
                fontSizeClass: 'quote-size-large',
                layoutClass: 'layout-center',
            };
        }

        return {
            fontSizeClass: 'quote-size-medium',
            layoutClass: 'layout-center',
        };
    }

    function normalizeQuotes(payload, catalog) {
        const quotes = Array.isArray(payload) ? payload : payload?.quotes || [];
        const articleMap = buildArticleMap(catalog);

        return quotes.map((quote) => {
            const article = articleMap.get(quote.source);
            const methodTags = buildMethodTags(quote.category, quote.source);

            return {
                id: quote.id,
                content: quote.content,
                source: quote.source || '毛选智慧卡片',
                date: quote.date || '',
                category: quote.category || '思想方法',
                methodTags,
                articleTitle: article?.title || quote.source || '',
                articleFilename: article?.filename || '',
                articleHref: article ? `reading.html#${encodeURIComponent(article.filename)}` : 'reading.html',
            };
        });
    }

    function buildArticleMap(catalog) {
        const map = new Map();
        const volumes = catalog?.volumes || {};

        Object.values(volumes).forEach((articles) => {
            articles.forEach((article) => {
                map.set(article.title, article);
            });
        });

        return map;
    }

    function buildMethodTags(category, source) {
        const tags = [];

        addUnique(tags, category);
        (CATEGORY_TAGS[category] || []).forEach((tag) => addUnique(tags, tag));
        (SOURCE_TAGS[source] || []).forEach((tag) => addUnique(tags, tag));

        return tags.filter(Boolean).slice(0, 4);
    }

    function addUnique(list, value) {
        if (value && !list.includes(value)) {
            list.push(value);
        }
    }

    return {
        getQuotePresentation,
        normalizeQuotes,
    };
});

