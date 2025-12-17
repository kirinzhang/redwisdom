document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('cards-container');
    const startBtn = document.getElementById('start-btn');
    const startArea = document.getElementById('start-area');
    const controlsArea = document.getElementById('controls-area');
    const retryBtn = document.getElementById('retry-btn');
    const promptArea = document.getElementById('projection-prompt');

    let allQuotes = [];

    // Load Data
    if (window.quotesData) {
        allQuotes = window.quotesData;
    } else {
        console.error('Error: quotesData not found');
    }

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
        container.innerHTML = '';

        // Deal new card
        dealCard();
    });

    function dealCard() {
        if (allQuotes.length === 0) return;

        // Pick 1 random
        const quote = getRandomQuotes(1)[0];

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

        // Main Content Container
        const content = document.createElement('div');
        content.className = 'card-front-content';

        // Quote Text (Main Red)
        const text = document.createElement('p');
        text.className = 'quote-text';
        text.innerText = quote.content;

        content.appendChild(text);

        // Footer Section REMOVED as requested
        // Save Btn REMOVED as requested

        front.appendChild(portrait);
        front.appendChild(content); // Quote
        // front.appendChild(footer);  
        // front.appendChild(saveIcon);

        cardInner.appendChild(back);
        cardInner.appendChild(front);
        cardScene.appendChild(cardInner);

        // FLIP INTERACTION
        let isFlipped = false;
        cardScene.addEventListener('click', () => {
            if (!isFlipped) {
                // STATE 3: Flip & Reveal
                cardScene.classList.add('flipped');
                isFlipped = true;

                // Show Controls after delay
                setTimeout(() => {
                    controlsArea.style.opacity = '1';
                    controlsArea.style.pointerEvents = 'auto';
                    saveIcon.style.opacity = '1';
                }, 800);
            }
        });

        return cardScene;
    }

    function saveCardAsImage(element) {
        const clone = element.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.position = 'fixed';
        clone.style.top = '0';
        clone.style.left = '0';
        clone.style.zIndex = '-9999';
        // Remove opacity class from save icon in clone if needed, but we don't need the icon in the image usually. 
        // Let's remove the save icon from the generated image for cleanliness.
        const icon = clone.querySelector('button');
        if (icon) icon.remove();

        document.body.appendChild(clone);

        html2canvas(clone, {
            useCORS: true,
            backgroundColor: null
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `red-wisdom-card-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(clone);
        }).catch(err => {
            console.error('Save failed', err);
            document.body.removeChild(clone);
        });
    }
});
