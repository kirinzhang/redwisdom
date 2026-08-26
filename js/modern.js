(function () {
    'use strict';

    const data = window.RedWisdomModernCases;
    if (!data) {
        console.error('modern-cases.js 未加载');
        return;
    }

    let catalogByTitle = null; // { 文章标题: filename }
    let activeCategory = 'all';
    const expanded = new Set();

    const els = {
        categoryChips: document.getElementById('categoryChips'),
        grid: document.getElementById('casesGrid'),
        status: document.getElementById('casesStatus'),
        count: document.getElementById('casesCount'),
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function articleLink(title) {
        const filename = catalogByTitle ? catalogByTitle[title] : null;
        if (!filename) {
            return `<span class="timeline-chip timeline-chip-muted">《${escapeHtml(title)}》</span>`;
        }
        const href = `reading.html?article=${encodeURIComponent(filename)}`;
        return `<a class="timeline-chip" href="${href}" title="在阅读页打开《${escapeHtml(title)}》">读原文《${escapeHtml(title)}》</a>`;
    }

    function askLink(item) {
        const prompt = `我最近在纠结的问题：${item.title} 具体情况：${item.scene} 请用《${item.articleTitle}》的思维帮我逐步分析。`;
        const params = new URLSearchParams({
            prompt,
            quote: item.quote,
            source: item.articleTitle,
        });
        return `<a class="ask-link" href="chat.html?${params.toString()}">带着这个问题去问道 →</a>`;
    }

    function caseCard(item) {
        const isOpen = expanded.has(item.id);
        const analysis = item.analysis.map((line) => `<li class="case-li">${escapeHtml(line)}</li>`).join('');
        const actions = item.actions.map((line) => `<li class="case-li case-action">${escapeHtml(line)}</li>`).join('');

        return `
            <article class="decision-card" id="case-${escapeHtml(item.id)}">
                <div class="flex items-start justify-between gap-2">
                    <h3 class="font-serif text-base font-bold text-ink-black md:text-lg">${escapeHtml(item.title)}</h3>
                    <span class="category-badge flex-none">${escapeHtml(item.category)}</span>
                </div>
                <p class="mt-2 text-sm leading-relaxed text-gray-600">${escapeHtml(item.scene)}</p>
                <button type="button" class="decision-toggle" data-toggle-case="${escapeHtml(item.id)}" aria-expanded="${isOpen}">
                    <svg class="decision-toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
                    <span class="decision-toggle-label">${isOpen ? '收起' : '看看毛选怎么说'}</span>
                </button>
                <div class="case-detail ${isOpen ? '' : 'hidden'}">
                    <blockquote class="quote-block">
                        <p class="quote-text-line">「${escapeHtml(item.quote)}」</p>
                        <footer class="quote-source">${articleLink(item.articleTitle)}</footer>
                    </blockquote>
                    <div class="case-section">
                        <h4 class="case-heading">思维拆解</h4>
                        <ol class="case-list">${analysis}</ol>
                    </div>
                    <div class="case-section">
                        <h4 class="case-heading">今天就能做的行动</h4>
                        <ul class="case-list">${actions}</ul>
                    </div>
                    <p class="boundary-note"><span class="font-bold">边界：</span>${escapeHtml(item.boundary)}</p>
                    <div class="mt-3">${askLink(item)}</div>
                </div>
            </article>`;
    }

    function renderCards() {
        const cases = data.CASES.filter((item) => activeCategory === 'all' || item.category === activeCategory);
        els.grid.innerHTML = cases.map(caseCard).join('') || `
            <div class="rounded-xl border border-dark-beige bg-white/70 px-6 py-16 text-center md:col-span-2">
                <p class="font-serif text-lg text-gray-700">这个分类下还没有内容</p>
            </div>`;
        if (els.status) {
            els.status.textContent = `共 ${cases.length} 个案例` + (activeCategory === 'all' ? '' : `（分类：${activeCategory}）`);
        }
    }

    function renderCategoryChips() {
        const count = (cat) => data.CASES.filter((item) => cat === 'all' || item.category === cat).length;
        const chips = ['all', ...data.CATEGORIES].map((cat) => {
            const label = cat === 'all' ? '全部' : cat;
            return `<button type="button" data-category="${escapeHtml(cat)}" class="period-tab${activeCategory === cat ? ' is-active' : ''}">
                <span class="period-tab-label">${escapeHtml(label)}</span>
                <span class="period-tab-count">${count(cat)}</span>
            </button>`;
        });
        els.categoryChips.innerHTML = chips.join('');
        els.categoryChips.querySelectorAll('.period-tab').forEach((button) => {
            button.addEventListener('click', () => {
                activeCategory = button.dataset.category;
                renderCategoryChips();
                renderCards();
            });
        });
    }

    function handleToggle(event) {
        const button = event.target.closest('[data-toggle-case]');
        if (!button) return;

        const id = button.dataset.toggleCase;
        if (expanded.has(id)) {
            expanded.delete(id);
        } else {
            expanded.add(id);
        }
        renderCards();
    }

    async function loadCatalog() {
        try {
            const response = await fetch('data/catalog.json');
            const catalog = await response.json();
            catalogByTitle = {};
            Object.values(catalog.volumes || {}).forEach((articles) => {
                articles.forEach((article) => {
                    catalogByTitle[article.title] = article.filename;
                });
            });
        } catch (error) {
            console.warn('无法加载文章目录，原文链接将不可点击:', error);
        }
        renderCards();
    }

    function init() {
        if (els.count) els.count.textContent = `${data.CASES.length} 个常见困惑 · 持续更新`;
        renderCategoryChips();
        renderCards();
        loadCatalog();

        els.grid.addEventListener('click', handleToggle);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
