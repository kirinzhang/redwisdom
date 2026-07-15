const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyTranslations,
    createLocaleInstructionMessage,
    getStoredLocale,
    setStoredLocale,
    translate,
} = require('../js/i18n.js');

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}

test('locale storage defaults to Chinese and rejects unsupported locales', () => {
    const storage = createMemoryStorage();

    assert.equal(getStoredLocale(storage), 'zh-CN');
    assert.equal(setStoredLocale(storage, 'en'), 'en');
    assert.equal(getStoredLocale(storage), 'en');
    assert.equal(setStoredLocale(storage, 'fr'), 'zh-CN');
});

test('translate falls back to Chinese key when English copy is missing', () => {
    assert.equal(translate('en', 'nav.reading'), 'Read');
    assert.equal(translate('en', 'nav.cards'), 'Cards');
    assert.equal(translate('en', 'missing.key'), 'missing.key');
});

test('translate exposes reading page labels in English', () => {
    assert.equal(translate('en', 'reading.welcomeHint'), 'Choose an article from the catalog to start reading');
    assert.equal(translate('en', 'reading.guideTitle'), 'Guide: How to Use This Article');
    assert.equal(translate('en', 'reading.savePractice'), 'Save as Practice');
    assert.equal(translate('en', 'reading.notesTitle'), 'Reading Notes');
});

test('translate exposes analysis guide labels in English', () => {
    assert.equal(translate('en', 'guide.title'), 'Maoist Method Guide');
    assert.equal(translate('en', 'guide.usePrompt'), 'Use as Prompt');
    assert.equal(translate('en', 'guide.practiceSaved'), 'Practice task saved.');
});

test('translate exposes saved answer actions in both locales', () => {
    assert.equal(translate('zh-CN', 'chat.saveAnswer'), '收藏回答');
    assert.equal(translate('zh-CN', 'chat.answerSaved'), '回答已收藏。');
    assert.equal(translate('en', 'chat.saveAnswer'), 'Save answer');
    assert.equal(translate('en', 'chat.answerSaved'), 'Answer saved.');
});

test('applyTranslations updates text and placeholders from data attributes', () => {
    const title = { dataset: { i18n: 'chat.title' }, textContent: '' };
    const input = { dataset: { i18nPlaceholder: 'chat.placeholder' }, setAttribute(name, value) { this[name] = value; } };
    const root = {
        querySelectorAll(selector) {
            if (selector === '[data-i18n]') return [title];
            if (selector === '[data-i18n-placeholder]') return [input];
            return [];
        },
        documentElement: {
            lang: '',
        },
    };

    applyTranslations(root, 'en');

    assert.equal(title.textContent, 'Ask Red Wisdom');
    assert.equal(input.placeholder, 'Describe the problem you are facing...');
    assert.equal(root.documentElement.lang, 'en');
});

test('createLocaleInstructionMessage constrains AI answer language without translating source titles', () => {
    const message = createLocaleInstructionMessage('en');

    assert.equal(message.role, 'system');
    assert.match(message.content, /Answer in English/);
    assert.match(message.content, /Keep Chinese article titles/);
});
