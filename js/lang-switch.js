(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomLangSwitch = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    'use strict';

    // 中/EN 切换。英文版目前提供三项功能：卡片（首页）、阅读毛选、问道毛选。
    // - 语言保存在 localStorage（与 RedWisdomI18n 同一个键），链接上的 ?lang=en / ?lang=zh 优先并会被记住。
    // - 页面中放一个 <div data-lang-switch></div> 即显示切换按钮；切换后整页重新载入。
    // - 英文模式下，底部导航与首页侧栏只保留已有英文版的入口。

    const ENGLISH_PAGES = ['index.html', 'reading.html', 'chat.html'];
    const ENGLISH_NAV_ITEMS = ['home', 'reading', 'chat'];

    function normalize(value) {
        const v = String(value || '').toLowerCase();
        if (v === 'en' || v.startsWith('en-')) return 'en';
        if (v === 'zh' || v.startsWith('zh')) return 'zh-CN';
        return null;
    }

    // 当前页面语言：URL 参数 > 本机记录 > 中文
    function resolveLocale(search, storage, storageKey) {
        const fromUrl = normalize(new URLSearchParams(search || '').get('lang'));
        if (fromUrl) {
            try { storage?.setItem(storageKey, fromUrl); } catch (error) { /* 无本机存储时只对当前页生效 */ }
            return fromUrl;
        }
        let stored = null;
        try { stored = normalize(storage?.getItem(storageKey)); } catch (error) { stored = null; }
        return stored || 'zh-CN';
    }

    function pageName(pathname) {
        const name = String(pathname || '').split('/').pop();
        return name || 'index.html';
    }

    function supportsEnglish(pathname) {
        return ENGLISH_PAGES.includes(pageName(pathname));
    }

    // 切换语言后要去的地址：去掉 lang 参数；阅读页的文章编号中英文不同，交给阅读页按对照表换算
    function switchUrl(href, locale) {
        const url = new URL(href);
        url.searchParams.set('lang', locale === 'en' ? 'en' : 'zh');
        return url.toString();
    }

    const CSS = `.lang-switch{display:inline-flex;flex-shrink:0;overflow:hidden;border:1px solid rgba(188,45,34,.55);border-radius:9999px;background:rgba(250,247,240,.92);box-shadow:0 1px 4px rgba(0,0,0,.08)}
.lang-switch button{white-space:nowrap;min-width:2.4rem;padding:.25rem .7rem;font-size:.8125rem;line-height:1.4;color:#9c1f15;font-family:'Noto Serif SC',Georgia,serif;background:transparent;border:0;cursor:pointer}
.lang-switch button[aria-pressed="true"]{background:#BC2D22;color:#fff;font-weight:700}
.lang-switch button:not([aria-pressed="true"]):hover{background:rgba(188,45,34,.08)}
[data-zh-only][hidden],[data-mobile-nav-item][hidden]{display:none!important}`;

    // 英文排版：正文用 Source Serif 4（为屏幕阅读设计，字面大、长文不累），
    // 标题与语录卡用 EB Garamond（古典书籍感，和外文出版社旧版选集的气质接近）。只在英文模式下加载。
    const EN_FONT_URL = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&display=swap';
    const EN_CSS = `html[data-locale="en"]{--en-text:'Source Serif 4',Georgia,'Times New Roman',serif;--en-display:'EB Garamond',Garamond,Georgia,serif}
html[data-locale="en"] .font-serif,html[data-locale="en"] .article-content,html[data-locale="en"] .article-content p,html[data-locale="en"] .article-content h2,html[data-locale="en"] .article-content h3,html[data-locale="en"] .article-content blockquote,html[data-locale="en"] .message-content,html[data-locale="en"] .selected-text-preview,html[data-locale="en"] textarea{font-family:var(--en-text)}
html[data-locale="en"] .article-content p{hyphens:auto;-webkit-hyphens:auto;line-height:1.8}
@media (max-width:640px){html[data-locale="en"] .article-content p{text-align:left;line-height:1.7}}
html[data-locale="en"] #readerToolsArticleTitle{font-style:italic}
html[data-locale="en"] .reading-toolbar-button,html[data-locale="en"] .reading-font-popover span{white-space:nowrap}
html[data-locale="en"] .article-content h1,html[data-locale="en"] .font-mao{font-family:var(--en-display);font-weight:600;letter-spacing:0}
html[data-locale="en"] .article-content h1{font-size:2.25rem;line-height:1.2}
html[data-locale="en"] .article-content h2{font-weight:600;line-height:1.45}`;

    function injectEnglishFonts(doc) {
        if (doc.getElementById('lang-en-fonts')) return;
        const link = doc.createElement('link');
        link.id = 'lang-en-fonts';
        link.rel = 'stylesheet';
        link.href = EN_FONT_URL;
        doc.head.appendChild(link);
        const style = doc.createElement('style');
        style.id = 'lang-en-style';
        style.textContent = EN_CSS;
        doc.head.appendChild(style);
    }

    function injectStyle(doc) {
        if (doc.getElementById('lang-switch-style')) return;
        const style = doc.createElement('style');
        style.id = 'lang-switch-style';
        style.textContent = CSS;
        doc.head.appendChild(style);
    }

    function renderSwitch(container, locale, onChange) {
        const doc = container.ownerDocument;
        injectStyle(doc);
        container.classList.add('lang-switch');
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', locale === 'en' ? 'Language' : '语言');
        container.innerHTML = '';
        [['zh-CN', '中'], ['en', 'EN']].forEach(([value, label]) => {
            const button = doc.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.lang = value === 'en' ? 'en' : 'zh-CN';
            button.setAttribute('aria-pressed', String(value === locale));
            button.title = value === 'en' ? 'English' : '中文';
            button.addEventListener('click', () => { if (value !== locale) onChange(value); });
            container.appendChild(button);
        });
    }

    // 英文模式：导航只保留卡片、阅读、问道
    function trimNavigation(doc, locale) {
        if (locale !== 'en') return;
        doc.querySelectorAll('[data-mobile-nav-item]').forEach((item) => {
            if (!ENGLISH_NAV_ITEMS.includes(item.dataset.mobileNavItem)) item.hidden = true;
        });
        doc.querySelectorAll('.mobile-bottom-nav .grid').forEach((grid) => {
            const visible = [...grid.children].filter((el) => !el.hidden).length;
            grid.style.gridTemplateColumns = `repeat(${visible}, minmax(0, 1fr))`;
        });
        doc.querySelectorAll('[data-zh-only]').forEach((el) => { el.hidden = true; });
    }

    const STORAGE_KEY = 'redwisdom.locale.v1';

    // 尽早执行（放在 <head> 里）：先把 URL 上的语言写进本机，再让页面脚本读取
    function boot(win) {
        let storage = null;
        try { storage = win.localStorage; } catch (error) { storage = null; }
        const locale = resolveLocale(win.location.search, storage, STORAGE_KEY);
        const pageLocale = locale === 'en' && supportsEnglish(win.location.pathname) ? 'en' : 'zh-CN';
        win.document.documentElement.lang = pageLocale === 'en' ? 'en' : 'zh-CN';
        win.document.documentElement.dataset.locale = pageLocale;
        if (pageLocale === 'en' && win.document.head) injectEnglishFonts(win.document);
        return { storage, locale, pageLocale };
    }

    function init(win = window) {
        const doc = win.document;
        const key = STORAGE_KEY;
        const { storage, pageLocale } = boot(win);
        injectStyle(doc);
        trimNavigation(doc, pageLocale);
        doc.querySelectorAll('[data-lang-switch]').forEach((container) => {
            renderSwitch(container, pageLocale, (next) => {
                try { storage?.setItem(key, next); } catch (error) { /* 无本机存储时靠 URL 参数 */ }
                win.location.href = switchUrl(win.location.href, next);
            });
        });
        return pageLocale;
    }

    const api = { EN_FONT_URL, ENGLISH_PAGES, ENGLISH_NAV_ITEMS, STORAGE_KEY, normalize, resolveLocale, supportsEnglish, switchUrl, boot, init };
    if (typeof window !== 'undefined' && window.document) {
        const state = boot(window);
        api.locale = state.pageLocale;
        if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', () => init(window));
        else init(window);
    }
    return api;
});
