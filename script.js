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

    startBtn.disabled = true;
    startBtn.textContent = '载入毛选...';

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
            const [quotesResponse, catalogResponse] = await Promise.all([
                fetch('data/quotes.json'),
                fetch('data/catalog.json'),
            ]);

            const [quotesPayload, catalog] = await Promise.all([
                quotesResponse.json(),
                catalogResponse.json(),
            ]);

            allQuotes = quoteUtils.normalizeQuotes(quotesPayload, catalog);
        } catch (error) {
            console.warn('Falling back to inline quote data:', error);
            allQuotes = quoteUtils.normalizeQuotes(window.quotesData || [], null);
        }

        startBtn.disabled = allQuotes.length === 0;
        startBtn.textContent = allQuotes.length === 0 ? '语录载入失败' : '抽一张';
    }

    function dealCard() {
        if (allQuotes.length === 0) return;

        container.classList.remove('hidden');
        container.classList.add('flex');

        // Pick 1 random
        const quote = getRandomQuotes(1)[0];

        sourceLink.href = quote.articleHref || 'reading.html';
        const askParams = new URLSearchParams({
            quote: quote.content,
            source: quote.source || '毛选',
        });
        askLink.href = `chat.html?${askParams.toString()}`;

        // Create Card Element
        const card = createCardElement(quote);
        container.appendChild(card);
    }

    function getRandomQuotes(count) {
        const shuffled = [...allQuotes].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    function createCardElement(quote) {
        const cardScene = document.createElement('div');
        cardScene.className = `card fade-in-up`;
        cardScene.tabIndex = 0;
        cardScene.setAttribute('role', 'button');
        cardScene.setAttribute('aria-label', '翻开语录卡');
        // Card starts face down (default style)

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        // Back
        const back = document.createElement('div');
        back.className = 'card-face card-back';
        back.innerHTML = `
            <div class="vertical-text card-back-text">毛选</div>
            <div class="card-back-sub">学习毛选中的顶层治愈</div>
        `;

        // Front
        const front = document.createElement('div');
        front.className = 'card-face card-front';

        // Portrait (Painting Style) - Now background layer bottom right
        const portrait = document.createElement('img');
        portrait.src = 'assets/portrait_color.png';
        portrait.className = 'portrait-container';
        portrait.alt = '';
        portrait.setAttribute('aria-hidden', 'true');

        // Main Content Container
        const content = document.createElement('div');
        content.className = 'card-front-content';

        const { fontSizeClass, layoutClass } = quoteUtils.getQuotePresentation(quote.content);

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
        source.innerText = `《${quote.source}》`;
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
                cardScene.setAttribute('aria-label', '语录卡已翻开');
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
