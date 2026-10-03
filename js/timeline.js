(function () {
    'use strict';

    const data = window.RedWisdomTimelineData;
    if (!data) {
        console.error('timeline-data.js 未加载');
        return;
    }

    let catalogByTitle = null; // { 文章标题: filename }
    let activePeriod = 'all';
    let activeTab = 'timeline';
    let activeBattle = '';
    let searchQuery = '';

    const els = {
        tabs: document.getElementById('timelineTabs'),
        periodTabs: document.getElementById('periodTabs'),
        battleFilter: document.getElementById('battleFilter'),
        search: document.getElementById('timelineSearch'),
        searchStatus: document.getElementById('timelineSearchStatus'),
        timeline: document.getElementById('timelineContent'),
        decisions: document.getElementById('decisionContent'),
        quickRef: document.getElementById('quickRefContent'),
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
            return `<span class="timeline-chip timeline-chip-muted">${escapeHtml(title)}</span>`;
        }
        const href = `reading.html?article=${encodeURIComponent(filename)}`;
        return `<a class="timeline-chip" href="${href}" title="在阅读页打开《${escapeHtml(title)}》">${escapeHtml(title)}</a>`;
    }

    function articleChips(articles) {
        if (!articles || !articles.length) return '';
        return `<div class="mt-3 flex flex-wrap gap-2">${articles.map(articleLink).join('')}</div>`;
    }

    function battleChips(event) {
        const battles = (event.battles || []).map((name) =>
            `<button type="button" class="tag-chip tag-chip-battle" data-filter-battle="${escapeHtml(name)}" title="筛选战役：${escapeHtml(name)}">⚔ ${escapeHtml(name)}</button>`
        ).join('');
        if (!battles) return '';
        return `<div class="mt-2.5 flex flex-wrap gap-1.5">${battles}</div>`;
    }

    function campaignChip(item) {
        if (!item.campaign) return '';
        const href = `campaign.html?id=${encodeURIComponent(item.campaign)}`;
        return `<div class="mt-3"><a class="timeline-chip timeline-chip-sandbox" href="${href}" title="在长征沙盘中逐日推演这场战役">▶ 沙盘推演</a></div>`;
    }

    function eventCard(event) {
        const lessonHtml = event.lesson
            ? `<p class="mt-2 text-sm leading-relaxed"><span class="font-bold text-china-red">启示：</span>${escapeHtml(event.lesson)}</p>`
            : '';
        return `
            <li class="timeline-event">
                <div class="timeline-marker" aria-hidden="true"></div>
                <div class="timeline-card">
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span class="timeline-date">${escapeHtml(event.date)}</span>
                        <h3 class="font-serif text-base font-bold text-ink-black md:text-lg">${escapeHtml(event.title)}</h3>
                    </div>
                    <p class="mt-1.5 text-sm leading-relaxed text-gray-700">${escapeHtml(event.summary)}</p>
                    ${lessonHtml}
                    ${battleChips(event)}
                    ${articleChips(event.articles)}
                    ${campaignChip(event)}
                </div>
            </li>`;
    }

    function matchesFilters(event) {
        if (activeBattle && !(event.battles || []).includes(activeBattle)) return false;
        return true;
    }

    function matchesSearch(event) {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const haystack = [event.date, event.title, event.summary, event.lesson || '']
            .concat(event.battles || [])
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    }

    function activePeriodLabel() {
        if (activePeriod === 'all') return '全部时期';
        const period = data.PERIODS.find((p) => p.id === activePeriod);
        return period ? period.label : '全部时期';
    }

    function filterSummary() {
        const parts = [];
        parts.push(`时期：${activePeriodLabel()}`);
        if (activeBattle) parts.push(`战役：${activeBattle}`);
        if (searchQuery) parts.push(`搜索：${searchQuery}`);
        return parts.join(' · ');
    }

    function renderTimeline() {
        const container = els.timeline;
        let html = '';
        let shown = 0;

        data.PERIODS.forEach((period) => {
            if (activePeriod !== 'all' && activePeriod !== period.id) return;

            const periodEvents = [];
            period.stages.forEach((stage) => {
                const events = stage.events.filter((event) => matchesFilters(event) && matchesSearch(event));
                if (!events.length) return;
                periodEvents.push({ stage, events });
            });
            if (!periodEvents.length) return;

            html += `
                <section class="mb-12">
                    <div class="mb-6 border-l-4 border-china-red bg-white/80 px-5 py-4 shadow-sm">
                        <div class="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 class="font-mao text-2xl text-china-red md:text-3xl">${escapeHtml(period.label)}</h2>
                            <span class="text-sm font-medium text-gray-500">${escapeHtml(period.range)}</span>
                        </div>
                        <p class="mt-1 text-sm text-gray-600">${escapeHtml(period.intro)}</p>
                    </div>
                    ${periodEvents.map(({ stage, events }) => `
                        <div class="mb-8">
                            <div class="mb-3 flex items-center gap-3">
                                <h3 class="text-sm font-bold tracking-wide text-gray-700">${escapeHtml(stage.label)}</h3>
                                <span class="rounded-full bg-dark-beige/50 px-2.5 py-0.5 text-xs text-gray-600">${escapeHtml(stage.range)}</span>
                                <span class="h-px flex-1 bg-dark-beige/60" aria-hidden="true"></span>
                            </div>
                            <ol class="timeline-list">${events.map(eventCard).join('')}</ol>
                        </div>
                    `).join('')}
                </section>`;

            shown += periodEvents.reduce((sum, { events }) => sum + events.length, 0);
        });

        if (!html) {
            html = `
                <div class="rounded-xl border border-dark-beige bg-white/70 px-6 py-16 text-center">
                    <p class="font-serif text-lg text-gray-700">没有匹配的事件</p>
                    <p class="mt-2 text-sm text-gray-500">换个关键词试试，或清空搜索。</p>
                </div>`;
        }

        container.innerHTML = html;
        if (els.searchStatus) {
            const hasFilter = activeBattle || searchQuery || activePeriod !== 'all';
            els.searchStatus.textContent = hasFilter
                ? `找到 ${shown} 条相关事件（${filterSummary()}）`
                : `共 ${countAllEvents()} 条大事`;
        }
    }

    function countAllEvents() {
        return data.PERIODS.reduce(
            (sum, period) => sum + period.stages.reduce((s, stage) => s + stage.events.length, 0),
            0
        );
    }

    function renderPeriodTabs() {
        const total = countAllEvents();
        const buttons = [
            `<button type="button" data-period="all" class="period-tab${activePeriod === 'all' ? ' is-active' : ''}">
                <span class="period-tab-label">全部</span>
                <span class="period-tab-count">${total}</span>
            </button>`,
            ...data.PERIODS.map((period) => {
                const count = period.stages.reduce((sum, stage) => sum + stage.events.length, 0);
                return `<button type="button" data-period="${escapeHtml(period.id)}" class="period-tab${activePeriod === period.id ? ' is-active' : ''}">
                    <span class="period-tab-label">${escapeHtml(period.label)}</span>
                    <span class="period-tab-count">${count}</span>
                </button>`;
            }),
        ];
        els.periodTabs.innerHTML = buttons.join('');
        els.periodTabs.querySelectorAll('.period-tab').forEach((button) => {
            button.addEventListener('click', () => {
                activePeriod = button.dataset.period;
                renderPeriodTabs();
                renderTimeline();
            });
        });
    }

    function uniqueTagValues(getter) {
        const values = new Set();
        data.PERIODS.forEach((period) => {
            period.stages.forEach((stage) => {
                stage.events.forEach((event) => {
                    (getter(event) || []).forEach((value) => values.add(value));
                });
            });
        });
        return [...values].sort((a, b) => a.localeCompare(b, 'zh'));
    }

    function populateFilterSelect(select, values, placeholder, activeValue) {
        const options = [`<option value="">${placeholder}</option>`];
        values.forEach((value) => {
            options.push(
                `<option value="${escapeHtml(value)}"${value === activeValue ? ' selected' : ''}>${escapeHtml(value)}</option>`
            );
        });
        select.innerHTML = options.join('');
    }

    function syncFilterControls() {
        populateFilterSelect(els.battleFilter, uniqueTagValues((event) => event.battles), '全部战役', activeBattle);
    }

    function handleContainerClick(event) {
        const battleButton = event.target.closest('[data-filter-battle]');
        if (battleButton) {
            activeBattle = battleButton.dataset.filterBattle;
            syncFilterControls();
            renderTimeline();
        }
    }

    function renderDecisionPoints() {
        els.decisions.innerHTML = `
            <p class="mb-5 text-sm leading-relaxed text-gray-600">
                党史中最密集的路线选择节点。点击「查看背景」了解当时的形势与选项；再配合「决策复盘卡」（学习规划 7.4）使用：先弄清形势、选项和力量，再对照结果提炼可迁移方法。
            </p>
            <div class="grid gap-4 md:grid-cols-2">
                ${data.DECISION_POINTS.map((point) => `
                    <article class="decision-card">
                        <div class="flex items-center justify-between gap-2">
                            <h3 class="font-serif text-base font-bold text-china-red">${escapeHtml(point.title)}</h3>
                            <span class="text-xs text-gray-500">路线之争</span>
                        </div>
                        <p class="mt-2 text-sm leading-relaxed"><span class="font-bold text-gray-700">路线选择：</span>${escapeHtml(point.conflict)}</p>
                        <p class="mt-1 text-sm leading-relaxed"><span class="font-bold text-gray-700">结果：</span>${escapeHtml(point.outcome)}</p>
                        <p class="mt-2 rounded bg-warm-rice px-3 py-2 text-sm leading-relaxed text-gray-700"><span class="font-bold text-china-red">启示：</span>${escapeHtml(point.lesson)}</p>
                        <button type="button" class="decision-toggle" data-toggle-background aria-expanded="false">
                            <svg class="decision-toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
                            <span class="decision-toggle-label">查看背景</span>
                        </button>
                        <div class="decision-background hidden">
                            <p class="text-sm leading-relaxed text-gray-700"><span class="font-bold text-china-red">背景：</span>${escapeHtml(point.background || '')}</p>
                        </div>
                        ${articleChips(point.articles)}
                        ${campaignChip(point)}
                    </article>
                `).join('')}
            </div>`;
    }

    function handleDecisionClick(event) {
        const toggle = event.target.closest('[data-toggle-background]');
        if (!toggle) return;

        const card = toggle.closest('.decision-card');
        const panel = card.querySelector('.decision-background');
        const willOpen = panel.classList.contains('hidden');

        // 手风琴效果：一次只展开一个
        els.decisions.querySelectorAll('.decision-card').forEach((otherCard) => {
            if (otherCard === card) return;
            const otherPanel = otherCard.querySelector('.decision-background');
            const otherToggle = otherCard.querySelector('[data-toggle-background]');
            if (otherPanel && !otherPanel.classList.contains('hidden')) {
                otherPanel.classList.add('hidden');
                if (otherToggle) {
                    otherToggle.setAttribute('aria-expanded', 'false');
                    otherToggle.querySelector('.decision-toggle-label').textContent = '查看背景';
                }
            }
        });

        panel.classList.toggle('hidden', !willOpen);
        toggle.setAttribute('aria-expanded', String(willOpen));
        toggle.querySelector('.decision-toggle-label').textContent = willOpen ? '收起背景' : '查看背景';
    }

    function renderQuickRef() {
        const congressRows = data.CONGRESSES.map((c) => `
            <tr class="border-b border-dark-beige/40">
                <td class="px-3 py-2 font-serif font-bold text-china-red">${escapeHtml(c.n)}</td>
                <td class="px-3 py-2 text-gray-600">${escapeHtml(c.year)}</td>
                <td class="px-3 py-2 text-gray-600">${escapeHtml(c.place)}</td>
                <td class="px-3 py-2 text-gray-700">${escapeHtml(c.note)}</td>
            </tr>`).join('');

        els.quickRef.innerHTML = `
            <section class="mb-10">
                <h2 class="quickref-heading">历次全国代表大会速查</h2>
                <div class="overflow-x-auto rounded-xl border border-dark-beige bg-white/80">
                    <table class="w-full min-w-[560px] text-left text-sm">
                        <thead>
                            <tr class="bg-dark-beige/40 text-gray-700">
                                <th class="px-3 py-2 font-bold">届次</th>
                                <th class="px-3 py-2 font-bold">年份</th>
                                <th class="px-3 py-2 font-bold">地点</th>
                                <th class="px-3 py-2 font-bold">一句话要点</th>
                            </tr>
                        </thead>
                        <tbody>${congressRows}</tbody>
                    </table>
                </div>
            </section>

            <section class="mb-10">
                <h2 class="quickref-heading">纪念日速记</h2>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    ${data.ANNIVERSARIES.map((a) => `
                        <div class="rounded-xl border border-dark-beige bg-white/80 px-4 py-3">
                            <p class="font-serif font-bold text-china-red">${escapeHtml(a.date)}</p>
                            <p class="mt-0.5 text-sm font-bold text-gray-700">${escapeHtml(a.label)}</p>
                            <p class="mt-0.5 text-xs text-gray-500">${escapeHtml(a.note)}</p>
                        </div>`).join('')}
                </div>
            </section>

            <section>
                <h2 class="quickref-heading">关键文献：三个历史决议</h2>
                <div class="space-y-3">
                    ${data.RESOLUTIONS.map((r) => `
                        <div class="rounded-xl border-l-4 border-china-red bg-white/80 px-5 py-4 shadow-sm">
                            <h3 class="font-serif font-bold text-ink-black">${escapeHtml(r.title)}</h3>
                            <p class="mt-0.5 text-xs font-medium text-gray-500">${escapeHtml(r.time)}</p>
                            <p class="mt-1.5 text-sm leading-relaxed text-gray-700">${escapeHtml(r.note)}</p>
                        </div>`).join('')}
                </div>
            </section>`;
    }

    function switchTab(tab) {
        activeTab = tab;
        els.tabs.querySelectorAll('.tab-button').forEach((button) => {
            const isActive = button.dataset.tab === tab;
            button.classList.toggle('tab-button-active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });
        els.timeline.classList.toggle('hidden', tab !== 'timeline');
        els.decisions.classList.toggle('hidden', tab !== 'decisions');
        els.quickRef.classList.toggle('hidden', tab !== 'quickref');
        const searchWrap = document.getElementById('timelineSearchWrap');
        if (searchWrap) searchWrap.classList.toggle('hidden', tab !== 'timeline');
    }

    async function loadCatalog() {
        // 先渲染（文章链接暂为灰色占位），目录加载后重新渲染为可点击链接。
        renderTimeline();
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
            console.warn('无法加载文章目录，文章链接将不可点击:', error);
        }
        renderTimeline();
    }

    function init() {
        renderPeriodTabs();
        syncFilterControls();
        renderDecisionPoints();
        renderQuickRef();
        switchTab('timeline');
        loadCatalog();

        els.tabs.querySelectorAll('.tab-button').forEach((button) => {
            button.addEventListener('click', () => switchTab(button.dataset.tab));
        });

        els.battleFilter.addEventListener('change', () => {
            activeBattle = els.battleFilter.value;
            renderTimeline();
        });

        els.timeline.addEventListener('click', handleContainerClick);
        els.decisions.addEventListener('click', handleDecisionClick);

        els.search.addEventListener('input', () => {
            searchQuery = els.search.value.trim();
            renderTimeline();
        });
        els.search.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                els.search.value = '';
                searchQuery = '';
                renderTimeline();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
