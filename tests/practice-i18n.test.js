const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { translate } = require('../js/i18n.js');

const rootDir = path.resolve(__dirname, '..');

test('translate exposes practice page labels in English', () => {
    assert.equal(translate('en', 'practice.title'), 'Practice');
    assert.equal(translate('en', 'practice.newTitle'), 'New Practice');
    assert.equal(translate('en', 'practice.reviewPrompts'), 'Review Prompts');
    assert.equal(translate('en', 'practice.saveReview'), 'Save Review');
    assert.equal(translate('en', 'practice.status.reviewed'), 'Reviewed');
});

test('practice page wires locale preference into static and dynamic practice UI', () => {
    const page = fs.readFileSync(path.join(rootDir, 'practice.html'), 'utf8');

    assert.match(page, /<script src="js\/i18n\.js"><\/script>/);
    assert.match(page, /id="practiceLocaleSelect"/);
    assert.match(page, /data-i18n="practice\.title"/);
    assert.match(page, /data-i18n="practice\.newTitle"/);
    assert.match(page, /data-i18n-placeholder="practice\.titlePlaceholder"/);
    assert.match(page, /let currentLocale = window\.RedWisdomI18n\.getStoredLocale\(localStorage\)/);
    assert.match(page, /window\.RedWisdomI18n\.applyTranslations\(document, currentLocale\)/);
    assert.match(page, /practiceLocaleSelect\.addEventListener\('change'/);
    assert.match(page, /function t\(key\)/);
    assert.match(page, /statusOption\('reviewed', t\('practice\.status\.reviewed'\), practice\.status\)/);
    assert.match(page, /reviewPromptBlock\(practice, currentLocale\)/);
});
