(function (root) {
    'use strict';

    // 问题工作台里的三块主线功能：调查清单、矛盾分析画布、实践—认识螺旋。
    // 每次操作直接写入问题档案，只重绘这三块，不覆盖表单里尚未保存的其他输入。

    const Store = root.RedWisdomProblemCases;
    const Spiral = root.RedWisdomCognitionSpiral;
    const VERDICTS = [['pending', '待核实'], ['confirmed', '证实'], ['partial', '部分证实'], ['refuted', '推翻']];

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function shortDate(value) {
        const d = new Date(value || '');
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    }
    function newId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function mount({ store, getCaseId, onActivitiesChanged = () => {}, doc = document }) {
        const $ = (id) => doc.getElementById(id);
        let current = null;
        let draftItems = [];
        let dragIndex = -1;

        function refresh(updated) {
            current = updated || store.getCase(getCaseId());
            if (!current) return;
            render(current);
            onActivitiesChanged(current);
        }

        /* ---------- 调查清单 ---------- */
        function renderInvestigations(problemCase) {
            const items = Store.getInvestigations(problemCase);
            const counts = Object.fromEntries(VERDICTS.map(([key]) => [key, items.filter((i) => i.verdict === key).length]));
            $('investigationStats').innerHTML = items.length
                ? VERDICTS.map(([key, label]) => `<span class="loop-chip">${label} ${counts[key]}</span>`).join('')
                : '';
            $('investigationList').innerHTML = items.length ? items.map((item) => `
                <article class="inv-card" data-verdict="${escapeHtml(item.verdict)}" data-inv="${escapeHtml(item.id)}">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <p class="font-bold leading-relaxed">${escapeHtml(item.question)}</p>
                        <button type="button" class="text-xs text-gray-400 hover:text-china-red" data-inv-remove>删除</button>
                    </div>
                    ${item.source || item.method ? `<p class="text-xs text-gray-500">${item.source ? `找谁 / 看什么：${escapeHtml(item.source)}` : ''}${item.source && item.method ? '　' : ''}${item.method ? `怎么问：${escapeHtml(item.method)}` : ''}</p>` : ''}
                    <textarea class="loop-input" rows="2" data-inv-finding placeholder="查到的事实：只写看到、听到、数到的材料">${escapeHtml(item.finding)}</textarea>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs text-gray-500">这个判断</span>
                        <div class="verdict-group" role="group" aria-label="核实结果">
                            ${VERDICTS.map(([key, label]) => `<button type="button" data-verdict="${key}" aria-pressed="${item.verdict === key}">${label}</button>`).join('')}
                        </div>
                        ${item.resolvedAt ? `<span class="text-xs text-gray-400">${shortDate(item.resolvedAt)} 核实</span>` : ''}
                    </div>
                </article>`).join('')
                : '<p class="text-sm text-gray-500">还没有调查条目。先写下一个你最没把握、但又影响最大的判断。</p>';
        }

        $('addInvestigationBtn').addEventListener('click', () => {
            const id = getCaseId();
            const question = $('invQuestion').value.trim();
            if (!id) return;
            if (!question) { $('investigationStatus').textContent = '先写下要核实的判断。'; $('invQuestion').focus(); return; }
            refresh(store.addInvestigation(id, { question, source: $('invSource').value, method: $('invMethod').value }));
            ['invQuestion', 'invSource', 'invMethod'].forEach((fid) => { $(fid).value = ''; });
            $('investigationStatus').textContent = '已加入调查清单。';
            $('invQuestion').focus();
        });
        $('invQuestion').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('addInvestigationBtn').click(); } });
        $('investigationList').addEventListener('click', (e) => {
            const card = e.target.closest('[data-inv]');
            if (!card) return;
            const id = getCaseId();
            const invId = card.dataset.inv;
            const finding = card.querySelector('[data-inv-finding]').value;
            const verdictBtn = e.target.closest('[data-verdict]');
            if (verdictBtn) {
                refresh(store.updateInvestigation(id, invId, { finding, verdict: verdictBtn.dataset.verdict }));
                $('investigationStatus').textContent = verdictBtn.dataset.verdict === 'pending' ? '已改回待核实。' : '核实结果已记入过程记录。';
            } else if (e.target.closest('[data-inv-remove]')) {
                refresh(store.removeInvestigation(id, invId));
            }
        });
        $('investigationList').addEventListener('change', (e) => {
            if (!e.target.matches('[data-inv-finding]')) return;
            const card = e.target.closest('[data-inv]');
            current = store.updateInvestigation(getCaseId(), card.dataset.inv, { finding: e.target.value });
            $('investigationStatus').textContent = '已保存查到的事实。';
        });

        /* ---------- 矛盾分析 ---------- */
        function renderContradictions(problemCase) {
            const map = Store.sanitizeContradictionMap(problemCase.contradictionMap);
            if (!map.items.length && problemCase.mainContradiction) {
                map.items = [{ id: newId('con'), text: problemCase.mainContradiction, note: '' }];
            }
            draftItems = map.items;
            drawContradictionList();
            $('conMainAspect').value = map.mainAspect || '';
            const versions = [...map.versions].reverse();
            $('versionList').innerHTML = versions.length ? `<p class="mb-1 text-xs tracking-widest text-gray-500">判断的变化</p>${versions.map((v, i) => {
                const older = versions[i + 1];
                const shift = older && older.mainText !== v.mainText;
                return `<div class="version-row${shift ? ' is-shift' : ''}"><time class="text-gray-500">${shortDate(v.at)}</time><div>${shift ? `<b>主要矛盾转移：</b>“${escapeHtml(older.mainText)}” → ` : '<b>主要矛盾：</b>'}“${escapeHtml(v.mainText)}”${v.note ? `<span class="block text-xs text-gray-500">依据：${escapeHtml(v.note)}</span>` : ''}</div></div>`;
            }).join('')}` : '';
        }
        function drawContradictionList() {
            $('contradictionList').innerHTML = draftItems.length ? draftItems.map((item, index) => `
                <li class="con-item${index === 0 ? ' is-main' : ''}" draggable="true" data-con-index="${index}">
                    <span class="con-handle" aria-hidden="true">⋮⋮</span>
                    <div class="min-w-0">
                        <span class="con-rank">${index === 0 ? '主要矛盾' : `次要 ${index}`}</span>
                        <input data-con-text value="${escapeHtml(item.text)}" aria-label="矛盾 ${index + 1}">
                    </div>
                    <span class="con-actions">
                        <button type="button" data-con-move="-1" aria-label="上移"${index === 0 ? ' disabled' : ''}>↑</button>
                        <button type="button" data-con-move="1" aria-label="下移"${index === draftItems.length - 1 ? ' disabled' : ''}>↓</button>
                        <button type="button" data-con-remove aria-label="删除">×</button>
                    </span>
                </li>`).join('')
                : '<li class="text-sm text-gray-500">还没有列出矛盾。一个问题里通常同时存在好几对矛盾，先都写下来。</li>';
        }
        function persistContradictions(options = {}) {
            const id = getCaseId();
            if (!id) return;
            const updated = store.saveContradictionMap(id, { items: draftItems, mainAspect: $('conMainAspect').value }, options);
            if (options.recordVersion) refresh(updated);
            else current = updated;
        }
        function move(from, to) {
            if (to < 0 || to >= draftItems.length || from === to) return;
            const [item] = draftItems.splice(from, 1);
            draftItems.splice(to, 0, item);
            drawContradictionList();
            persistContradictions();
            $('contradictionStatus').textContent = to === 0 ? `主要矛盾改为：${item.text}` : '已调整顺序。';
        }
        $('addContradictionBtn').addEventListener('click', () => {
            const text = $('conInput').value.trim();
            if (!text) { $('conInput').focus(); return; }
            draftItems.push({ id: newId('con'), text, note: '' });
            $('conInput').value = '';
            drawContradictionList();
            persistContradictions();
            $('contradictionStatus').textContent = draftItems.length === 1 ? '已添加。排在第一位的就是主要矛盾。' : '已添加。拖动或用箭头调整先后。';
        });
        $('conInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('addContradictionBtn').click(); } });
        $('contradictionList').addEventListener('click', (e) => {
            const li = e.target.closest('[data-con-index]');
            if (!li) return;
            const index = Number(li.dataset.conIndex);
            const mover = e.target.closest('[data-con-move]');
            if (mover) move(index, index + Number(mover.dataset.conMove));
            else if (e.target.closest('[data-con-remove]')) {
                draftItems.splice(index, 1);
                drawContradictionList();
                persistContradictions();
            }
        });
        $('contradictionList').addEventListener('change', (e) => {
            if (!e.target.matches('[data-con-text]')) return;
            const index = Number(e.target.closest('[data-con-index]').dataset.conIndex);
            draftItems[index].text = e.target.value.trim() || draftItems[index].text;
            persistContradictions();
        });
        $('contradictionList').addEventListener('dragstart', (e) => {
            const li = e.target.closest('[data-con-index]');
            if (!li) return;
            dragIndex = Number(li.dataset.conIndex);
            li.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        $('contradictionList').addEventListener('dragover', (e) => {
            const li = e.target.closest('[data-con-index]');
            if (!li || dragIndex < 0) return;
            e.preventDefault();
            $('contradictionList').querySelectorAll('.is-over').forEach((el) => el.classList.remove('is-over'));
            li.classList.add('is-over');
        });
        $('contradictionList').addEventListener('drop', (e) => {
            const li = e.target.closest('[data-con-index]');
            if (!li || dragIndex < 0) return;
            e.preventDefault();
            const to = Number(li.dataset.conIndex);
            const from = dragIndex;
            dragIndex = -1;
            move(from, to);
        });
        $('contradictionList').addEventListener('dragend', () => {
            dragIndex = -1;
            $('contradictionList').querySelectorAll('.is-dragging, .is-over').forEach((el) => el.classList.remove('is-dragging', 'is-over'));
        });
        $('conMainAspect').addEventListener('change', () => persistContradictions());
        $('recordVersionBtn').addEventListener('click', () => {
            if (!draftItems.length) { $('contradictionStatus').textContent = '先列出至少一对矛盾。'; return; }
            persistContradictions({ recordVersion: true, note: $('conVersionNote').value });
            $('conVersionNote').value = '';
            $('contradictionStatus').textContent = '已记录这一版判断，并写入过程记录。';
        });

        /* ---------- 实践—认识螺旋 ---------- */
        function renderSpiral(problemCase) {
            const spiral = Spiral.buildCognitionSpiral({ ...problemCase, investigations: Store.getInvestigations(problemCase) });
            const { rounds, stats, shifts } = spiral;
            $('spiralStats').textContent = `已完成 ${stats.rounds} 轮复盘 · 核实 ${stats.checked} 个判断（推翻 ${stats.refuted} 个） · 主要矛盾转移 ${shifts.length} 次`;
            drawSpiralSvg(rounds);
            $('roundGrid').innerHTML = rounds.map((round) => {
                const k = round.knowing; const pr = round.practice; const t = round.test; const r = round.rethink;
                const actions = pr.actions.slice(-3).map((a) => escapeHtml(a.title || a.type)).join('；');
                const checked = t.checked.map((c) => `${escapeHtml(c.question)}（${c.verdictLabel}）`).join('；');
                const none = '<span class="text-gray-400">暂无记录</span>';
                return `<article class="round-card${round.status === 'ongoing' ? ' is-ongoing' : ''}">
                    <h3>第 ${round.index} 轮${round.status === 'ongoing' ? ' · 进行中' : ` · ${shortDate(round.endedAt)} 复盘`}</h3>
                    <dl>
                        <dt>认识</dt><dd>${k.mainContradiction ? `主要矛盾：${escapeHtml(k.mainContradiction)}` : ''}${k.questions.length ? `${k.mainContradiction ? '<br>' : ''}待核实：${k.questions.map(escapeHtml).join('；')}` : ''}${!k.mainContradiction && !k.questions.length ? none : ''}</dd>
                        <dt>实践</dt><dd>${pr.expected ? `预期：${escapeHtml(pr.expected)}` : ''}${actions ? `${pr.expected ? '<br>' : ''}做了：${actions}` : ''}${!pr.expected && !actions ? none : ''}</dd>
                        <dt>检验</dt><dd>${t.actual ? `结果：${escapeHtml(t.actual)}` : ''}${t.evidence ? `${t.actual ? '<br>' : ''}证据：${escapeHtml(t.evidence)}` : ''}${checked ? `${t.actual || t.evidence ? '<br>' : ''}核实：${checked}` : ''}${!t.actual && !t.evidence && !checked ? none : ''}</dd>
                        <dt>再认识</dt><dd>${r.shift ? `<b class="text-china-red">主要矛盾转移</b>：${escapeHtml(r.shift.from)} → ${escapeHtml(r.shift.to)}<br>` : ''}${r.reflection ? `认识修正：${escapeHtml(r.reflection)}` : ''}${r.nextAction ? `${r.reflection ? '<br>' : ''}下一步：${escapeHtml(r.nextAction)}` : ''}${!r.shift && !r.reflection && !r.nextAction ? (round.status === 'ongoing' ? '<span class="text-gray-400">做完行动后，在上方「行动复盘」记录结果，这一轮就完成了。</span>' : none) : ''}</dd>
                    </dl>
                </article>`;
            }).join('');
        }

        function drawSpiralSvg(rounds) {
            const svg = $('spiralSvg');
            const n = Math.max(rounds.length, 1);
            const R = 44, gap = 190, rise = 26, padX = 96;
            const base = 64 + R + rise * (n - 1);
            const W = padX * 2 + (n - 1) * gap;
            const H = base + R + 58;
            const center = (i) => [padX + i * gap, base - i * rise];
            // 四个节点：认识（左）→ 实践（上）→ 检验（右）→ 再认识（下），顺时针一圈
            const node = (i, q) => {
                const [cx, cy] = center(i);
                const angle = Math.PI + q * Math.PI / 2;
                return [cx + R * Math.cos(angle), cy + R * Math.sin(angle)];
            };
            const labels = ['认识', '实践', '检验', '再认识'];
            const parts = [];
            rounds.forEach((round, i) => {
                const done = round.status === 'done';
                const color = done ? '#BC2D22' : '#9ca3af';
                const [cx, cy] = center(i);
                parts.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${done ? 'rgba(188,45,34,.05)' : 'none'}" stroke="${color}" stroke-width="${done ? 3 : 2}"${done ? '' : ' stroke-dasharray="5 5"'}/>`);
                if (i < rounds.length - 1) {
                    const [x1, y1] = node(i, 3);
                    const [x2, y2] = node(i + 1, 0);
                    const nextDone = rounds[i + 1].status === 'done';
                    parts.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + 40).toFixed(1)} ${(y1 + 34).toFixed(1)} ${(x2 - 46).toFixed(1)} ${(y2 + 6).toFixed(1)} ${(x2 - 8).toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${nextDone ? '#BC2D22' : '#9ca3af'}" stroke-width="2"${nextDone ? '' : ' stroke-dasharray="5 5"'}/>`);
                    parts.push(`<path d="M${(x2 - 15).toFixed(1)} ${(y2 - 5).toFixed(1)} L${(x2 - 7).toFixed(1)} ${y2.toFixed(1)} L${(x2 - 15).toFixed(1)} ${(y2 + 5).toFixed(1)}" fill="none" stroke="${nextDone ? '#BC2D22' : '#9ca3af'}" stroke-width="2"/>`);
                }
                const filled = [
                    Boolean(round.knowing.mainContradiction || round.knowing.questions.length),
                    Boolean(round.practice.expected || round.practice.actions.length),
                    Boolean(round.test.actual || round.test.evidence || round.test.checked.length),
                    Boolean(round.rethink.reflection || round.rethink.nextAction || round.rethink.shift),
                ];
                labels.forEach((label, q) => {
                    const [x, y] = node(i, q);
                    const on = filled[q];
                    const pos = [[x - 12, y + 4, 'end'], [x, y - 13, 'middle'], [x + 12, y + 4, 'start'], [x, y + 22, 'middle']][q];
                    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="${on ? color : '#fff'}" stroke="${color}" stroke-width="2"/>`);
                    parts.push(`<text x="${pos[0].toFixed(1)}" y="${pos[1].toFixed(1)}" text-anchor="${pos[2]}" font-size="12" fill="${on ? '#2B2B2B' : '#9ca3af'}">${label}</text>`);
                });
                parts.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="14" font-weight="700" fill="${color}">第 ${round.index} 轮</text>`);
                parts.push(`<text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="11" fill="#6b7280">${round.status === 'done' ? `${shortDate(round.endedAt)} 复盘` : '进行中'}</text>`);
                if (round.rethink.shift) parts.push(`<text x="${cx}" y="${cy + R + 40}" text-anchor="middle" font-size="11" fill="#BC2D22">主要矛盾转移</text>`);
            });
            svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            svg.setAttribute('width', String(W));
            svg.setAttribute('height', String(H));
            svg.innerHTML = parts.join('');
        }

        function render(problemCase) {
            current = problemCase;
            if (!problemCase) return;
            renderInvestigations(problemCase);
            renderContradictions(problemCase);
            renderSpiral(problemCase);
        }

        return { render };
    }

    root.RedWisdomPracticeLoopUI = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
