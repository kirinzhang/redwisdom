const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');

test('card front content preserves card design without internal scrollbars', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    const contentRule = extractCssRule(css, '.card-front-content');

    assert.doesNotMatch(contentRule, /overflow-y\s*:\s*(auto|scroll)\b/);
    assert.match(contentRule, /overflow(?:-y)?\s*:\s*(hidden|clip)\b/);
});

test('card quote is centered and its metadata stays clear of the portrait', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    const script = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
    const contentRule = extractCssRule(css, '.card-front-content');
    const longQuoteLayoutRule = extractCssRule(css, '.layout-top');
    const quoteRule = extractCssRule(css, '.quote-text');
    const metadataRule = extractCssRule(css, '.quote-meta');
    const portraitRule = extractCssRule(css, '.portrait-container');

    assert.match(contentRule, /align-items\s*:\s*center\b/);
    assert.match(contentRule, /justify-content\s*:\s*center\b/);
    assert.match(longQuoteLayoutRule, /justify-content\s*:\s*center\b/);
    assert.match(quoteRule, /text-align\s*:\s*center\b/);
    assert.match(metadataRule, /position\s*:\s*absolute\b/);
    assert.match(metadataRule, /bottom\s*:\s*0\b/);
    assert.match(metadataRule, /left\s*:\s*0\b/);
    assert.match(metadataRule, /width\s*:\s*54%\s*;/);
    assert.match(portraitRule, /max-width\s*:\s*40%\s*;/);
    assert.match(script, /metadata\.className = 'quote-meta'/);
    assert.match(script, /date\.className = 'quote-date-line'/);
});

test('home card front stays simple with quote and source only', () => {
    const page = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const script = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');

    assert.doesNotMatch(page, /js\/practice-store\.js|js\/saved-quotes-store\.js|js\/daily-training\.js/);
    assert.match(script, /quote-source-line/);
    assert.doesNotMatch(script, /quote-insight|quote-tags|quote-actions|save-quote|save-practice|buildPracticePrompt/);
    assert.match(page, /id="result-source-link"/);
    assert.match(page, /id="result-ask-link"/);
    assert.match(script, /cardScene\.setAttribute\('role', 'button'\)/);
});

function extractCssRule(css, selector) {
    const pattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{(?<body>[^}]*)\\}`, 'm');
    const match = css.match(pattern);
    assert.ok(match, `Missing CSS rule for ${selector}`);
    return match.groups.body;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
