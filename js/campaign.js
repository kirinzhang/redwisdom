(function () {
    'use strict';

    const data = window.RedWisdomCampaignData;
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = (n) => String(n).padStart(2, '0');

    let campaign = null;
    let sandbox = null;
    let T = 0;
    let playing = false;
    let hold = 0;
    let currentChapter = -1;
    let lastFrame = performance.now();
    let chapterButtons = [];

    function articleTitle(articleId) {
        return String(articleId).replace(/^\d+-/, '').replace(/\.md$/, '');
    }
    function readingHref(ref) {
        return `reading.html?article=${encodeURIComponent(ref.articleId)}&anchor=${encodeURIComponent(ref.anchor)}`;
    }
    function refCard(ref, chapterTitle) {
        const meta = chapterTitle ? `${escapeHtml(chapterTitle)} · ` : '';
        return `<a class="ref-card" href="${readingHref(ref)}">
            <span class="block text-sm leading-7">“${escapeHtml(ref.quote)}”</span>
            <span class="mt-1 block text-xs text-china-red">${meta}《${escapeHtml(articleTitle(ref.articleId))}》 读原文 →</span>
        </a>`;
    }
    function factionName(key) {
        return (campaign.factions[key] && campaign.factions[key].name) || key;
    }
    function factionDot(key) {
        const color = (campaign.factions[key] && campaign.factions[key].color) || '#999';
        return `<i class="faction-dot" style="background:${color}"></i>`;
    }

    function renderSwitcher() {
        const active = data.CAMPAIGNS.map((c) => `<a class="campaign-chip${c.id === campaign.id ? ' is-active' : ''}" href="campaign.html?id=${encodeURIComponent(c.id)}" data-campaign="${escapeHtml(c.id)}"${c.id === campaign.id ? ' aria-current="true"' : ''}>${escapeHtml(c.shortTitle || c.title)}<small>${escapeHtml(c.startDate.slice(0, 7).replace('-', '.'))}</small></a>`);
        const planned = data.PLANNED.map((p) => `<span class="campaign-chip" aria-disabled="true">${escapeHtml(p.title)}<small>筹备中</small></span>`);
        $('campaignSwitcher').innerHTML = active.concat(planned).join('');
    }

    function renderIntro() {
        document.title = `${campaign.title} · 长征沙盘 | Red Wisdom`;
        $('campaignTitle').textContent = campaign.title;
        $('campaignPeriod').textContent = campaign.period;
        $('campaignSummary').textContent = campaign.summary;
        const review = campaign.review || {};
        $('reviewBadge').textContent = review.status === 'editor-approved' ? '已编辑终审' : '史实初核 · 待编辑终审';
        $('reviewBadge').title = review.note || '';
        $('campaignForces').innerHTML = campaign.forces.map((f) => `<div><b class="block text-lg leading-tight" style="color:${f.faction === 'red' ? '#BC2D22' : '#2B2B2B'}">${escapeHtml(f.value)}</b>${escapeHtml(f.label)}</div>`).join('');
        $('sandboxLegend').innerHTML = Object.keys(campaign.factions)
            .filter((key) => key === 'red' || campaign.units.some((u) => u.faction === key))
            .map((key) => `<span>${factionDot(key)}${escapeHtml(factionName(key))}</span>`).join('');
        $('timeRange').max = campaign.maxDay;
        $('controlTicks').innerHTML = (campaign.markers || []).filter((m) => m.type === 'crossing').map((m) =>
            `<button type="button" class="control-tick" style="left:${(m.day / campaign.maxDay * 100).toFixed(2)}%" data-seek="${m.day}" title="${escapeHtml(m.label)}">${escapeHtml(m.label.split(' · ')[0])}</button>`).join('');
        chapterButtons = campaign.chapters.map((c) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'chapter-btn';
            b.innerHTML = `${escapeHtml(c.title)}<small>${escapeHtml(c.date)}</small>`;
            b.addEventListener('click', () => seek(c.day + 0.01));
            return b;
        });
        $('chapterRow').replaceChildren(...chapterButtons);
        $('paneProfiles').innerHTML = campaign.profiles.map(([key, rows]) => `<section class="profile-block" id="profile-${escapeHtml(key)}">
            <h4 class="flex items-center gap-2 text-[15px] font-bold">${factionDot(key)}${escapeHtml(factionName(key))}</h4>
            <dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
        </section>`).join('');
        const refs = campaign.chapters.flatMap((c) => (c.refs || []).map((r) => ({ ...r, chapter: c.title })));
        $('paneRefs').innerHTML = refs.length
            ? `<p class="mb-3 text-xs leading-6 text-gray-500">战役中的决策与《毛选》中对战争规律的总结对照阅读。点击直达原文段落。</p><div class="grid gap-2">${refs.map((r) => refCard(r, r.chapter)).join('')}</div>`
            : '<p class="text-sm text-gray-500">暂无对照原文。</p>';
        const m = campaign.method;
        $('methodContradiction').textContent = m.contradiction;
        $('methodJudgments').innerHTML = m.judgments.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
        $('methodTransfer').innerHTML = m.transfer.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
        $('methodLimits').textContent = m.limits;
        $('askLink').href = `chat.html?${new URLSearchParams({ prompt: m.askPrompt, quote: m.askQuote, source: m.askSource }).toString()}`;
        $('campaignSources').innerHTML = (campaign.sources || []).map((s) => `<a class="underline hover:text-china-red" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.publisher)}：${escapeHtml(s.title)}</a>`).join('；');
        currentChapter = -1;
    }

    function updateBrief() {
        const d = data.dateForDay(campaign, T);
        $('dateBox').textContent = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
        $('briefDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 第${Math.floor(T) + 1}天`;
        const k = data.chapterAt(campaign, T);
        if (k === currentChapter) return;
        currentChapter = k;
        const c = campaign.chapters[k];
        $('briefTitle').textContent = c.title;
        $('briefText').textContent = c.text;
        $('briefMoves').innerHTML = c.moves.map(([f, tag, text]) => `<li class="move-item">
            <div class="move-head">${factionDot(f)}${escapeHtml(factionName(f))}<span class="move-tag">${escapeHtml(tag)}</span></div>
            <p class="ml-[18px] text-sm leading-7">${escapeHtml(text)}</p>
        </li>`).join('');
        $('briefRefs').innerHTML = (c.refs || []).length
            ? `<p class="text-xs tracking-widest text-gray-500">对照原文</p>${c.refs.map((r) => refCard(r)).join('')}`
            : '';
        chapterButtons.forEach((b, i) => { b.classList.toggle('is-active', i === k); b.classList.toggle('is-done', i < k); });
        chapterButtons[k].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function seek(t) {
        T = Math.max(0, Math.min(campaign.maxDay, t));
        hold = 0;
        $('timeRange').value = T;
        if (sandbox) sandbox.setTime(T);
        updateBrief();
    }
    function setPlaying(p) {
        playing = p;
        if (p && T >= campaign.maxDay) seek(0);
        $('playBtn').textContent = p ? '❚❚ 暂停' : (T >= campaign.maxDay ? '↺ 重演' : '▶ 推演');
        if (p && sandbox && !sandbox.isFollowing()) sandbox.setFollow(true);
    }
    function tick(now) {
        requestAnimationFrame(tick);
        const dt = Math.min(0.1, (now - lastFrame) / 1000);
        lastFrame = now;
        if (!playing || !campaign || now < hold) return;
        const before = data.chapterAt(campaign, T);
        T += dt * (campaign.maxDay / 70) * parseFloat($('speedSelect').value);
        if (T >= campaign.maxDay) { T = campaign.maxDay; setPlaying(false); }
        if (data.chapterAt(campaign, T) !== before) hold = now + 2200;
        $('timeRange').value = T;
        if (sandbox) sandbox.setTime(T);
        updateBrief();
    }

    function showTab(name) {
        document.querySelectorAll('.brief-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
        $('paneSituation').hidden = name !== 'situation';
        $('paneProfiles').hidden = name !== 'profiles';
        $('paneRefs').hidden = name !== 'refs';
    }
    function showProfile(key) {
        showTab('profiles');
        document.querySelectorAll('.profile-block').forEach((el) => el.classList.toggle('is-highlight', el.id === `profile-${key}`));
        const el = document.getElementById(`profile-${key}`);
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function mountSandbox() {
        if (sandbox) { sandbox.destroy(); sandbox = null; }
        $('sandboxView').querySelector('.no-webgl')?.remove();
        try {
            sandbox = window.RedWisdomSandbox.create({
                canvas: $('sandboxCanvas'),
                labelLayer: $('sandboxLabels'),
                campaign,
                onUnitClick: showProfile,
                onFollowChange: (v) => $('followBtn').setAttribute('aria-pressed', String(v)),
            });
        } catch (error) {
            console.error('Sandbox failed to start:', error);
            sandbox = null;
        }
        if (!sandbox) {
            $('sandboxView').insertAdjacentHTML('beforeend', '<div class="no-webgl">当前浏览器无法显示立体沙盘（需要 WebGL2）。右侧的战况与决策仍可随时间轴阅读。</div>');
            return;
        }
        const ex = parseFloat($('exaggeration').value);
        if (ex !== 1) sandbox.setExaggeration(ex);
        $('exaggerationValue').textContent = `×${sandbox.exaggerationFactor(ex)}`;
        sandbox.setLayers(currentLayers());
        sandbox.setTime(T);
    }
    function currentLayers() {
        return { enemy: $('layerEnemy').checked, trail: $('layerTrail').checked, ghost: $('layerGhost').checked, place: $('layerPlace').checked };
    }

    function loadCampaign(id, { push } = {}) {
        campaign = data.getCampaign(id) || data.CAMPAIGNS[0];
        setPlaying(false);
        T = 0;
        renderSwitcher();
        renderIntro();
        mountSandbox();
        seek(0);
        if (push) history.pushState({ id: campaign.id }, '', `campaign.html?id=${encodeURIComponent(campaign.id)}`);
    }

    function bind() {
        $('playBtn').addEventListener('click', () => setPlaying(!playing));
        $('timeRange').addEventListener('input', (e) => seek(parseFloat(e.target.value)));
        $('controlTicks').addEventListener('click', (e) => { const b = e.target.closest('[data-seek]'); if (b) seek(parseFloat(b.dataset.seek) - campaign.maxDay / 140); });
        ['layerEnemy', 'layerTrail', 'layerGhost', 'layerPlace'].forEach((id) => $(id).addEventListener('change', () => sandbox && sandbox.setLayers(currentLayers())));
        $('exaggeration').addEventListener('change', (e) => { if (sandbox) sandbox.setExaggeration(parseFloat(e.target.value)); });
        $('exaggeration').addEventListener('input', (e) => { if (sandbox) $('exaggerationValue').textContent = `×${sandbox.exaggerationFactor(parseFloat(e.target.value))}`; });
        document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => sandbox && sandbox.preset(b.dataset.preset)));
        $('followBtn').addEventListener('click', () => sandbox && sandbox.setFollow(!sandbox.isFollowing()));
        document.querySelectorAll('.brief-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
        $('campaignSwitcher').addEventListener('click', (e) => {
            const a = e.target.closest('[data-campaign]');
            if (!a || e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            if (a.dataset.campaign !== campaign.id) loadCampaign(a.dataset.campaign, { push: true });
        });
        window.addEventListener('popstate', () => loadCampaign(new URLSearchParams(location.search).get('id')));
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.key.startsWith('Arrow')) return;
            if (e.code === 'Space' && !['BUTTON', 'A', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); setPlaying(!playing); }
            else if (e.key === 'ArrowRight') { const k = Math.min(campaign.chapters.length - 1, data.chapterAt(campaign, T) + 1); seek(campaign.chapters[k].day + 0.01); }
            else if (e.key === 'ArrowLeft') { const k = data.chapterAt(campaign, T); const c = T - campaign.chapters[k].day > campaign.maxDay / 80 ? k : Math.max(0, k - 1); seek(campaign.chapters[c].day + 0.01); }
        });
    }

    bind();
    loadCampaign(new URLSearchParams(location.search).get('id'));
    requestAnimationFrame(tick);
    window.__campaignPage = { seek, setPlaying, get sandbox() { return sandbox; }, loadCampaign };
})();
