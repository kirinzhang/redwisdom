(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomAnnotations = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    // 阅读页的注释就地弹出与概念层。
    // 纯函数（parseNotes / markerNumber / findConceptMatch）可在 Node 中测试；
    // enhanceArticle / createPopover 只在浏览器中使用。

    const NOTE_HEADING = /^\s*注\s*释\s*$/;
    const NOTE_LINE = /^\s*(?:〔(\d+)〕|\[(\d+)\]|［(\d+)］|（(\d+)）)\s*(.*)$/;
    const INLINE_MARKER = /[⑴-⒇]|〔\d+〕|（\d+）|\(\d+\)/g;
    const MAX_CONCEPT_LINKS = 12;

    function stripMarkdown(line) {
        return String(line || '').replace(/[*_`>#]/g, '').replace(/\s+$/g, '').trim();
    }

    // 从 Markdown 原文解析文末注释：{ 1: '……', 2: '……' }
    function parseNotes(markdown) {
        const lines = String(markdown || '').replace(/\r/g, '').split('\n');
        const start = lines.findIndex((line) => NOTE_HEADING.test(stripMarkdown(line)));
        const notes = {};
        if (start < 0) return notes;
        let current = null;
        for (const raw of lines.slice(start + 1)) {
            const line = stripMarkdown(raw);
            if (!line) continue;
            const match = line.match(NOTE_LINE);
            if (match) {
                current = Number(match[1] || match[2] || match[3] || match[4]);
                notes[current] = match[5].trim();
            } else if (current != null && !/^-{3,}$/.test(line)) {
                notes[current] = `${notes[current]}${line}`;
            }
        }
        return notes;
    }

    function markerNumber(token) {
        const code = token.codePointAt(0);
        if (code >= 0x2474 && code <= 0x2487) return code - 0x2474 + 1;
        const digits = token.match(/\d+/);
        return digits ? Number(digits[0]) : null;
    }

    // 在一段文字中找第一个出现的概念词（术语或别名），返回 { index, length } 或 null
    function findConceptMatch(text, concept) {
        let best = null;
        for (const word of [concept.term, ...(concept.aliases || [])]) {
            if (!word) continue;
            const index = text.indexOf(word);
            if (index >= 0 && (!best || index < best.index || (index === best.index && word.length > best.length))) best = { index, length: word.length };
        }
        return best;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function bookTitle(title) {
        // 篇名本身含书名号时，按排版规范把内层改为〈〉。
        return `《${String(title || '').replace(/《/g, '〈').replace(/》/g, '〉')}》`;
    }

    function quoted(text) {
        const t = String(text || '');
        return /^[“"]/.test(t) ? t : `“${t}”`;
    }

    function readingHref(articleId, anchor) {
        const params = new URLSearchParams({ article: articleId });
        if (anchor) params.set('anchor', anchor);
        return `reading.html?${params.toString()}`;
    }

    function renderConceptCard(concept) {
        const passages = concept.keyPassages.map((p) => `<a class="concept-quote" href="${readingHref(p.articleId, p.anchor)}">${escapeHtml(quoted(p.quote))}<span>${escapeHtml(bookTitle(p.title))} 读原文 →</span></a>`).join('');
        const articles = concept.articles.slice(0, 6).map((a) => `<a href="${readingHref(a.articleId)}">${escapeHtml(bookTitle(a.title))}<small>${a.count}处</small></a>`).join('');
        const cases = concept.historyCases.map((c) => `<li><a href="${readingHref(c.articleId, c.anchor)}">${escapeHtml(c.title)}</a><span>${escapeHtml(c.period)} · ${escapeHtml(c.transferMethod)}</span></li>`).join('');
        const campaigns = (concept.campaigns || []).map((c) => `<a class="concept-campaign" href="campaign.html?id=${encodeURIComponent(c.id)}">▶ 沙盘：${escapeHtml(c.title)}</a>`).join('');
        const ask = new URLSearchParams({
            prompt: `我想用“${concept.term}”的方法分析我的问题。我的处境是：`,
            quote: concept.keyPassages[0]?.quote || '',
            source: concept.keyPassages[0]?.title || '',
        });
        return `<div class="concept-card">
            <p class="concept-kicker">概念</p>
            <h3>${escapeHtml(concept.term)}</h3>
            <p class="concept-summary">${escapeHtml(concept.summary)}<span class="concept-note">编辑概括</span></p>
            ${passages ? `<p class="concept-label">原文出处</p><div class="concept-quotes">${passages}</div>` : ''}
            ${articles ? `<p class="concept-label">常见于</p><div class="concept-articles">${articles}</div>` : ''}
            ${cases ? `<p class="concept-label">党史案例</p><ul class="concept-cases">${cases}</ul>` : ''}
            ${campaigns ? `<div class="concept-campaigns">${campaigns}</div>` : ''}
            <a class="concept-ask" href="chat.html?${ask.toString()}">带着这个概念去问道 →</a>
        </div>`;
    }

    function renderNoteCard(number, text) {
        return `<div class="note-card"><p class="concept-kicker">注释 ${number}</p><p>${escapeHtml(text)}</p></div>`;
    }

    /* ---------- 浏览器端 ---------- */
    function createPopover(doc = document) {
        const el = doc.createElement('div');
        el.className = 'annotation-popover';
        el.setAttribute('role', 'dialog');
        el.hidden = true;
        el.innerHTML = '<button type="button" class="annotation-close" aria-label="关闭">×</button><div class="annotation-body"></div>';
        doc.body.appendChild(el);
        let anchorEl = null;
        const body = el.querySelector('.annotation-body');
        function close() {
            el.hidden = true;
            if (anchorEl) anchorEl.setAttribute('aria-expanded', 'false');
            anchorEl = null;
        }
        function open(target, html) {
            if (anchorEl) anchorEl.setAttribute('aria-expanded', 'false');
            anchorEl = target || null;
            body.innerHTML = html;
            el.hidden = false;
            el.classList.toggle('is-centered', !target);
            if (target) {
                target.setAttribute('aria-expanded', 'true');
                const view = doc.defaultView;
                const rect = target.getBoundingClientRect();
                const width = Math.min(380, view.innerWidth - 24);
                el.style.width = `${width}px`;
                if (view.innerWidth < 640) {
                    el.classList.add('is-sheet');
                    el.style.left = ''; el.style.top = '';
                } else {
                    el.classList.remove('is-sheet');
                    const left = Math.max(12, Math.min(rect.left + view.scrollX - 20, view.scrollX + view.innerWidth - width - 12));
                    el.style.left = `${left}px`;
                    const below = rect.bottom + view.scrollY + 8;
                    el.style.top = `${below}px`;
                    const h = el.offsetHeight;
                    if (rect.bottom + 8 + h > view.innerHeight && rect.top - h - 8 > 0) el.style.top = `${rect.top + view.scrollY - h - 8}px`;
                }
            } else {
                el.classList.remove('is-sheet');
                el.style.left = ''; el.style.top = ''; el.style.width = '';
            }
            el.querySelector('.annotation-close').focus({ preventScroll: true });
        }
        el.querySelector('.annotation-close').addEventListener('click', close);
        doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) { const back = anchorEl; close(); back?.focus(); } });
        doc.addEventListener('click', (e) => {
            if (el.hidden || el.contains(e.target) || e.target.closest('.fn-ref, .concept-ref, [data-open-concept]')) return;
            close();
        });
        return { open, close, element: el };
    }

    function textNodesBefore(rootEl, stopEl, skipSelector) {
        const doc = rootEl.ownerDocument;
        const walker = doc.createTreeWalker(rootEl, 4 /* SHOW_TEXT */, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || parent.closest(skipSelector)) return 2; // FILTER_REJECT
                if (stopEl && (stopEl === parent || stopEl.contains(parent) || (stopEl.compareDocumentPosition(node) & 4))) return 2;
                return 1;
            },
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    // 给文章正文加注释按钮和概念链接；返回统计信息
    function enhanceArticle(rootEl, { notes = {}, concepts = [], popover, skipSelector = '.reading-guide' } = {}) {
        const doc = rootEl.ownerDocument;
        const blocks = [...rootEl.querySelectorAll('p, h2, h3, h4')];
        const stopEl = blocks.find((el) => NOTE_HEADING.test(el.textContent.split('\n')[0].trim()) || /^注\s*释/.test(el.textContent.trim())) || null;
        const skip = `${skipSelector}, .fn-ref, .concept-ref, a, button, code`;
        let footnotes = 0;
        for (const node of textNodesBefore(rootEl, stopEl, skip)) {
            const text = node.nodeValue;
            INLINE_MARKER.lastIndex = 0;
            if (!INLINE_MARKER.test(text)) continue;
            INLINE_MARKER.lastIndex = 0;
            const frag = doc.createDocumentFragment();
            let last = 0; let changed = false; let m;
            while ((m = INLINE_MARKER.exec(text))) {
                const n = markerNumber(m[0]);
                if (!n || !notes[n]) continue;
                frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
                const btn = doc.createElement('button');
                btn.type = 'button'; btn.className = 'fn-ref'; btn.dataset.note = String(n);
                btn.textContent = m[0]; btn.setAttribute('aria-label', `查看注释 ${n}`); btn.setAttribute('aria-expanded', 'false');
                frag.appendChild(btn);
                last = m.index + m[0].length; changed = true; footnotes += 1;
            }
            if (!changed) continue;
            frag.appendChild(doc.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        }

        let conceptLinks = 0;
        const ordered = [...concepts].sort((a, b) => b.term.length - a.term.length);
        for (const concept of ordered) {
            if (conceptLinks >= MAX_CONCEPT_LINKS) break;
            for (const node of textNodesBefore(rootEl, stopEl, skip)) {
                const hit = findConceptMatch(node.nodeValue, concept);
                if (!hit) continue;
                const text = node.nodeValue;
                const span = doc.createElement('button');
                span.type = 'button'; span.className = 'concept-ref'; span.dataset.concept = concept.id;
                span.textContent = text.slice(hit.index, hit.index + hit.length);
                span.setAttribute('aria-label', `概念：${concept.term}`); span.setAttribute('aria-expanded', 'false');
                const frag = doc.createDocumentFragment();
                frag.appendChild(doc.createTextNode(text.slice(0, hit.index)));
                frag.appendChild(span);
                frag.appendChild(doc.createTextNode(text.slice(hit.index + hit.length)));
                node.parentNode.replaceChild(frag, node);
                conceptLinks += 1;
                break;
            }
        }

        if (popover && !rootEl.dataset.annotationsBound) {
            rootEl.dataset.annotationsBound = 'true';
            rootEl.addEventListener('click', (e) => {
                const fn = e.target.closest('.fn-ref');
                if (fn) { e.preventDefault(); popover.open(fn, renderNoteCard(fn.dataset.note, rootEl.__notes?.[fn.dataset.note] || '')); return; }
                const cr = e.target.closest('.concept-ref');
                if (cr) { e.preventDefault(); const c = (rootEl.__concepts || []).find((x) => x.id === cr.dataset.concept); if (c) popover.open(cr, renderConceptCard(c)); }
            });
        }
        rootEl.__notes = notes;
        rootEl.__concepts = concepts;
        return { footnotes, conceptLinks, hasNotes: Boolean(stopEl) };
    }

    return { bookTitle, parseNotes, markerNumber, findConceptMatch, renderConceptCard, renderNoteCard, enhanceArticle, createPopover };
});
