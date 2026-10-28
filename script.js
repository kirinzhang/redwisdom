document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('cards-container');
    const startBtn = document.getElementById('start-btn');
    const startArea = document.getElementById('start-area');
    const controlsArea = document.getElementById('controls-area');
    const retryBtn = document.getElementById('retry-btn');
    const sourceLink = document.getElementById('result-source-link');
    const askLink = document.getElementById('result-ask-link');
    const promptArea = document.getElementById('projection-prompt');

    let allQuotes = [];
    const quoteUtils = window.RedWisdomQuoteUtils;
    // 语言由 js/lang-switch.js 决定；英文版卡片取自外文出版社英译本语录
    const locale = window.RedWisdomLangSwitch?.locale === 'en' ? 'en' : 'zh-CN';
    const t = (key) => window.RedWisdomI18n?.translate(locale, key) || key;
    if (window.RedWisdomI18n) window.RedWisdomI18n.applyTranslations(document, locale);

    startBtn.disabled = true;
    startBtn.textContent = t('home.loading');

    loadQuoteData();

    // STATE 1: Start
    startBtn.addEventListener('click', () => {
        // Hide Start Button
        startArea.classList.add('hidden'); // Add fade out logic if preferred, but hidden is instant
        startArea.style.display = 'none';

        // Show Prompt firmly
        promptArea.classList.remove('animate-pulse');

        // Deal One Card
        dealCard();
    });

    // STATE 4: Retry (Same as Start but from end state)
    retryBtn.addEventListener('click', () => {
        // Reset UI
        controlsArea.style.opacity = '0';
        controlsArea.style.pointerEvents = 'none';
        controlsArea.classList.add('controls-pending');
        container.innerHTML = '';

        // Deal new card
        dealCard();
    });

    async function loadQuoteData() {
        try {
            const base = locale === 'en' ? 'data/en/' : 'data/';
            const [quotesResponse, catalogResponse] = await Promise.all([
                fetch(`${base}quotes.json`),
                fetch(`${base}catalog.json`),
            ]);

            const [quotesPayload, catalog] = await Promise.all([
                quotesResponse.json(),
                catalogResponse.json(),
            ]);

            allQuotes = locale === 'en'
                ? quoteUtils.normalizeEnglishQuotes(quotesPayload, catalog)
                : quoteUtils.normalizeQuotes(quotesPayload, catalog);
        } catch (error) {
            console.warn('Falling back to inline quote data:', error);
            allQuotes = locale === 'en' ? [] : quoteUtils.normalizeQuotes(window.quotesData || [], null);
        }

        startBtn.disabled = allQuotes.length === 0;
        startBtn.textContent = allQuotes.length === 0 ? t('home.loadFailed') : t('home.draw');
    }

    function dealCard() {
        if (allQuotes.length === 0) return;

        container.classList.remove('hidden');
        container.classList.add('flex');

        // Pick 1 random
        const quote = getRandomQuotes(1)[0];

        sourceLink.href = quote.articleHref || (locale === 'en' ? 'reading.html?lang=en' : 'reading.html');
        const askParams = new URLSearchParams({
            quote: quote.content,
            source: quote.source || t('card.defaultSource'),
        });
        if (locale === 'en') askParams.set('lang', 'en');
        askLink.href = `chat.html?${askParams.toString()}`;

        // Create Card Element
        const card = createCardElement(quote);
        container.appendChild(card);
        if (locale === 'en') fitCurrentCard();
    }

    function getRandomQuotes(count) {
        const shuffled = [...allQuotes].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // 英文语录较长，按卡片实际高度自动缩小字号；字体加载完成或窗口尺寸变化后重新计算
    function fitCurrentCard() {
        const content = container.querySelector('.card-front-content');
        const text = content && content.querySelector('.quote-text');
        if (text) quoteUtils.fitQuoteText(content, text);
    }
    if (locale === 'en') {
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitCurrentCard);
        let resizeTimer = null;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCurrentCard, 120); });
    }

    function createCardElement(quote) {
        const cardScene = document.createElement('div');
        cardScene.className = `card fade-in-up`;
        cardScene.tabIndex = 0;
        cardScene.setAttribute('role', 'button');
        cardScene.setAttribute('aria-label', t('card.ariaClosed'));
        // Card starts face down (default style)

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        // Back
        const back = document.createElement('div');
        back.className = 'card-face card-back';
        back.innerHTML = `
            <div class="vertical-text card-back-text">${t('card.backTitle')}</div>
            <div class="card-back-sub">${t('card.backSub')}</div>
        `;

        // Front
        const front = document.createElement('div');
        front.className = 'card-face card-front';

        // Portrait (Painting Style) - Now background layer bottom right
        const portrait = document.createElement('img');
        portrait.src = 'assets/portrait_color.jpg';
        portrait.className = 'portrait-container';
        portrait.alt = '';
        portrait.setAttribute('aria-hidden', 'true');

        // Main Content Container
        const content = document.createElement('div');
        content.className = 'card-front-content';

        const { fontSizeClass, layoutClass } = quoteUtils.getQuotePresentation(quote.content, locale);

        content.classList.add(layoutClass);

        // Quote Text (Main Red)
        const text = document.createElement('p');
        text.className = `quote-text ${fontSizeClass}`;
        text.innerText = quote.content;

        content.appendChild(text);

        const metadata = document.createElement('div');
        metadata.className = 'quote-meta';

        const source = document.createElement('p');
        source.className = 'quote-source-line';
        source.innerText = locale === 'en' ? `— ${quote.source}` : `《${quote.source}》`;
        if (locale === 'en') {
            source.title = quote.source; // 出处太长时卡片上最多显示三到四行
            if (quote.source.length > 48) metadata.classList.add('quote-meta-long');
        }
        metadata.appendChild(source);

        if (quote.date) {
            const date = document.createElement('p');
            date.className = 'quote-date-line';
            date.innerText = quote.date;
            metadata.appendChild(date);
        }

        content.appendChild(metadata);

        front.appendChild(portrait);
        front.appendChild(content); // Quote

        cardInner.appendChild(back);
        cardInner.appendChild(front);
        cardScene.appendChild(cardInner);

        // FLIP INTERACTION
        let isFlipped = false;
        function revealCard() {
            if (!isFlipped) {
                // STATE 3: Flip & Reveal
                cardScene.classList.add('flipped');
                cardScene.setAttribute('aria-label', t('card.ariaOpen'));
                isFlipped = true;

                // Show Controls after delay
                setTimeout(() => {
                    controlsArea.classList.remove('controls-pending');
                    window.requestAnimationFrame(() => {
                        controlsArea.style.opacity = '1';
                        controlsArea.style.pointerEvents = 'auto';
                    });
                }, 800);
            }
        }

        cardScene.addEventListener('click', revealCard);
        cardScene.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                revealCard();
            }
        });

        return cardScene;
    }

});
