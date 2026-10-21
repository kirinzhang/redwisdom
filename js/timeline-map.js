(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomTimelineMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    'use strict';

    // 党史时间线的“沙盘地图”视图：在全国立体地图上，随时间轴标注大事发生地。
    // 纯函数（parseEventDate / buildMapEvents / buildScene）可在 Node 中测试；mount 只在浏览器中使用。

    // 把 '1927.4–7'、'1945.8.15 / 9.2'、'1956 年底'、'1933.9–1934.10' 等写法解析为起始日期。
    function parseEventDate(text) {
        const s = String(text || '');
        const m = s.match(/(\d{4})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?/);
        if (!m) return null;
        const year = Number(m[1]);
        let month = m[2] ? Number(m[2]) : null;
        const day = m[3] ? Number(m[3]) : null;
        if (!month && /年底|年末/.test(s)) month = 12;
        // 排序只看年、月；同月的事件保持原数据中的先后（原数据按史实顺序排列）
        const value = year + ((month || 1) - 1) / 12;
        return { year, month, day, value };
    }

    // 地图只讲到新中国成立：1919 年五四运动 — 1949 年 10 月开国大典。
    const MAP_START = 1919;
    const MAP_END = 1949 + 9 / 12;

    // 按时间排序的大事（默认只取 1919—1949.10）；每条带 index（时间轴位置）和地点坐标（可能为空）。
    function buildMapEvents(data, { from = MAP_START, until = MAP_END } = {}) {
        const places = data.PLACES || {};
        const list = [];
        let order = 0;
        for (const period of data.PERIODS) {
            for (const stage of period.stages) {
                for (const event of stage.events) {
                    const parsed = parseEventDate(event.date);
                    if (!parsed || parsed.value < from || parsed.value > until) continue;
                    const names = event.place ? [].concat(event.place) : [];
                    list.push({
                        ...event,
                        order: order++,
                        period: { id: period.id, label: period.label },
                        stage: { id: stage.id, label: stage.label },
                        year: parsed.year,
                        value: parsed.value,
                        places: names.filter((name) => places[name]).map((name) => ({ name, at: places[name] })),
                    });
                }
            }
        }
        list.sort((a, b) => a.value - b.value || a.order - b.order);
        list.forEach((event, index) => { event.index = index; event.id = `e${index}`; });
        return list;
    }

    // 给沙盘引擎用的场景：全国地图 + 每个事件地点一个 history 标记；时间轴按事件序号推进。
    function buildScene(events) {
        const markers = [];
        for (const event of events) {
            for (const place of event.places) {
                markers.push({ type: 'history', id: event.id, eventIndex: event.index, day: event.index, date: event.date, label: shortTitle(event.title), place: place.name, at: place.at, major: Boolean(event.major) });
            }
        }
        return {
            id: 'party-history',
            title: '党史地图',
            maxDay: Math.max(1, events.length - 1),
            historyWindow: 2.5,
            geo: {
                overview: true,
                map: 'overview',
                bbox: [73.5, 18, 134.8, 53.6],
                vex: 22,
                grid: 10,
                camera: { at: [111.5, 31.2], r: 0.5, th: 0.06, ph: 0.62, portrait: { at: [112, 31.4], r: 0.62, ph: 0.5 } },
                lowR: 0.22,
                rivers: [],
                regions: [],
                places: [],
            },
            factions: {},
            units: [],
            markers,
            overlays: [],
        };
    }

    // 地图标签用短标题：去掉括号里的地点注释
    function shortTitle(title) {
        return String(title || '').replace(/（[^）]*）/g, '').trim() || String(title || '');
    }

    // 时间轴上的年份标签：每 5 年一个，取该年份之后的第一件事的位置；太挤的省略
    function decadeMarks(events, step = 5) {
        const marks = [];
        if (!events.length) return marks;
        const gap = Math.max(2, events.length * 0.09);
        marks.push({ index: 0, label: String(events[0].year) });
        const first = Math.ceil((events[0].year + 1) / step) * step;
        for (let y = first; y <= events[events.length - 1].year; y += step) {
            const e = events.find((x) => x.year >= y);
            if (!e) break;
            const prev = marks[marks.length - 1];
            if (e.index - prev.index < gap) continue;
            marks.push({ index: e.index, label: String(y) });
        }
        const lastE = events[events.length - 1];
        if (lastE.index - marks[marks.length - 1].index >= gap && String(lastE.year) !== marks[marks.length - 1].label) marks.push({ index: lastE.index, label: String(lastE.year) });
        return marks;
    }

    // 时间轴色带：按阶段（建党与大革命、土地革命战争、全民族抗日战争、解放战争）
    function stageBands(events) {
        const bands = [];
        for (const event of events) {
            const last = bands[bands.length - 1];
            if (last && last.id === event.stage.id) last.end = event.index;
            else bands.push({ id: event.stage.id, label: event.stage.label, start: event.index, end: event.index });
        }
        return bands;
    }

    // 紧凑日期：'1945.8.15 / 9.2' → '1945.8'，'1933.9–1934.10' → '1933.9'
    function compactDate(event) {
        const p = parseEventDate(event.date);
        return p ? `${p.year}${p.month && !/年底/.test(event.date) ? `.${p.month}` : ''}` : String(event.date || '');
    }

    /* ---------- 浏览器端 ---------- */
    const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function mount(opts) {
        const { data, root: rootEl, articleLink } = opts;
        const $ = (sel) => rootEl.querySelector(sel);
        const events = buildMapEvents(data);
        const scene = buildScene(events);
        const N = events.length;
        const range = $('[data-tm="range"]');
        const view = $('[data-tm="view"]');
        const card = $('[data-tm="card"]');
        const caption = $('[data-tm="caption"]');
        const nowBox = $('[data-tm="now"]');
        const playBtn = $('[data-tm="play"]');
        const followBox = $('[data-tm="follow"]');
        let sandbox = null;
        let T = 0;
        let playing = false;
        let hold = 0;
        let last = performance.now();
        let current = -1;
        let mounted = false;
        let cardIndex = -1;

        range.max = String(N - 1);
        range.step = '0.01';

        // 时间轴：时期色带、事件刻度、年代标签
        const pct = (i) => `${(i / (N - 1) * 100).toFixed(3)}%`;
        $('[data-tm="bands"]').innerHTML = stageBands(events).map((b) =>
            `<span class="tm-band tm-band-${escapeHtml(b.id)}" style="left:${pct(b.start)};width:calc(${pct(b.end)} - ${pct(b.start)})" title="${escapeHtml(b.label)}"><em>${escapeHtml(b.label)}</em></span>`).join('');
        $('[data-tm="ticks"]').innerHTML = events.map((e) =>
            `<button type="button" class="tm-tick${e.major ? ' major' : ''}${e.places.length ? '' : ' no-place'}" style="left:${pct(e.index)}" data-index="${e.index}" title="${escapeHtml(`${e.date} ${e.title}`)}" aria-label="${escapeHtml(`${e.date} ${e.title}`)}"></button>`).join('');
        $('[data-tm="years"]').innerHTML = decadeMarks(events).map((m) => `<span style="left:${pct(m.index)}">${escapeHtml(m.label)}</span>`).join('');

        function placeText(e) {
            if (e.places.length) return e.places.map((p) => p.name).join('、');
            return e.placeNote || '全国';
        }

        function renderCard(i) {
            const e = events[i];
            cardIndex = i;
            const articles = (e.articles || []).map((t) => articleLink(t)).join('');
            const lesson = e.lesson ? `<p class="tm-lesson"><b>启示：</b>${escapeHtml(e.lesson)}</p>` : '';
            const sandboxLink = e.campaign ? `<a class="tm-link" href="campaign.html?id=${encodeURIComponent(e.campaign)}">▶ 进入长征沙盘推演</a>` : '';
            card.innerHTML = `<button type="button" class="tm-close" data-tm-close aria-label="关闭">×</button>
                <p class="tm-kicker">${escapeHtml(e.period.label)} · ${escapeHtml(e.stage.label)}</p>
                <h3>${escapeHtml(e.title)}</h3>
                <p class="tm-meta"><span>${escapeHtml(e.date)}</span><span>📍 ${escapeHtml(placeText(e))}</span></p>
                <p class="tm-summary">${escapeHtml(e.summary === '—' ? '' : e.summary)}</p>
                ${lesson}
                ${articles ? `<div class="tm-articles"><span>相关毛选：</span>${articles}</div>` : ''}
                <div class="tm-nav">
                    <button type="button" data-tm-step="-1"${i === 0 ? ' disabled' : ''}>← 上一件</button>
                    ${sandboxLink}
                    <button type="button" data-tm-step="1"${i === N - 1 ? ' disabled' : ''}>下一件 →</button>
                </div>`;
            card.hidden = false;
        }
        function closeCard() { card.hidden = true; cardIndex = -1; }

        function updateCurrent() {
            const i = Math.max(0, Math.min(N - 1, Math.round(T)));
            if (i === current) return;
            current = i;
            const e = events[i];
            nowBox.textContent = compactDate(e);
            caption.innerHTML = `<span class="tm-cap-date">${escapeHtml(compactDate(e))}</span><span class="tm-cap-title">${escapeHtml(e.title)}</span><span class="tm-cap-place">📍 ${escapeHtml(placeText(e))}</span><span class="tm-cap-more"><span class="tm-cap-more-text">查看简介</span> ›</span>`;
            caption.dataset.index = String(i);
            rootEl.querySelectorAll('.tm-tick.is-active').forEach((el) => el.classList.remove('is-active'));
            const tick = rootEl.querySelector(`.tm-tick[data-index="${i}"]`);
            if (tick) tick.classList.add('is-active');
            if (sandbox && followBox.checked && e.places.length) sandbox.focus(e.places[0].at);
            if (!card.hidden && cardIndex !== i) renderCard(i);
        }

        function seek(t, { snap } = {}) {
            T = Math.max(0, Math.min(N - 1, snap ? Math.round(t) : t));
            range.value = String(T);
            if (sandbox) sandbox.setTime(T);
            updateCurrent();
        }
        function setPlaying(p) {
            playing = p;
            if (p && T >= N - 1) seek(0);
            playBtn.textContent = p ? '❚❚ 暂停' : (T >= N - 1 ? '↺ 重播' : '▶ 播放');
            playBtn.setAttribute('aria-pressed', String(p));
        }
        function tick(now) {
            requestAnimationFrame(tick);
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            if (!playing || now < hold) return;
            const before = Math.floor(T);
            T += dt * 0.7;
            if (Math.floor(T) !== before) { T = Math.floor(T); hold = now + 1100; }
            if (T >= N - 1) { T = N - 1; setPlaying(false); }
            range.value = String(T);
            if (sandbox) sandbox.setTime(T);
            updateCurrent();
        }

        range.addEventListener('input', () => { setPlaying(false); seek(parseFloat(range.value)); });
        range.addEventListener('change', () => seek(parseFloat(range.value), { snap: true }));
        range.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); seek(Math.floor(T + 1e-6) + 1, { snap: true }); }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); seek(Math.ceil(T - 1e-6) - 1, { snap: true }); }
        });
        $('[data-tm="ticks"]').addEventListener('click', (e) => {
            const b = e.target.closest('[data-index]');
            if (!b) return;
            setPlaying(false);
            seek(Number(b.dataset.index));
            renderCard(Number(b.dataset.index));
        });
        playBtn.addEventListener('click', () => setPlaying(!playing));
        caption.addEventListener('click', () => renderCard(Number(caption.dataset.index)));
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-tm-close]')) { closeCard(); return; }
            const step = e.target.closest('[data-tm-step]');
            if (step) { const i = Math.max(0, Math.min(N - 1, cardIndex + Number(step.dataset.tmStep))); setPlaying(false); seek(i); renderCard(i); }
        });
        rootEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !card.hidden) closeCard(); });
        rootEl.querySelectorAll('[data-tm-preset]').forEach((b) => b.addEventListener('click', () => sandbox && sandbox.preset(b.dataset.tmPreset)));

        async function start() {
            if (mounted) return;
            mounted = true;
            const loading = $('[data-tm="loading"]');
            loading.hidden = false;
            let map = null;
            try { map = await window.RedWisdomSandbox.loadMap('overview'); } catch (error) { console.error('Map data failed to load:', error); }
            loading.hidden = true;
            if (!map) { view.insertAdjacentHTML('beforeend', '<div class="no-webgl">地图数据加载失败，请检查网络后刷新。时间轴和事件简介仍可使用。</div>'); return; }
            try {
                sandbox = window.RedWisdomSandbox.create({
                    canvas: $('[data-tm="canvas"]'),
                    labelLayer: $('[data-tm="labels"]'),
                    campaign: scene,
                    map,
                    onMarkerClick: (m) => { setPlaying(false); seek(m.eventIndex); renderCard(m.eventIndex); },
                });
            } catch (error) {
                console.error('Sandbox failed to start:', error);
            }
            if (!sandbox) { view.insertAdjacentHTML('beforeend', '<div class="no-webgl">当前浏览器无法显示立体地图（需要 WebGL2）。时间轴和事件简介仍可使用。</div>'); return; }
            const ins = $('[data-tm="inset"]');
            try {
                const vec = await window.RedWisdomSandbox.loadVectors('overview');
                ins.innerHTML = window.RedWisdomSandbox.insetSvg({ vec: vec.scs, width: 84, height: 116, title: '南海诸岛' });
                ins.hidden = false;
            } catch (error) { /* 附图可选 */ }
            sandbox.setTime(T);
        }

        seek(0);
        requestAnimationFrame(tick);
        return { start, seek, setPlaying, events, get sandbox() { return sandbox; }, open: renderCard };
    }

    return { MAP_START, MAP_END, parseEventDate, buildMapEvents, buildScene, shortTitle, compactDate, decadeMarks, stageBands, mount };
});
