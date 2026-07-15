const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { chooseReviewFocusSelector } = require('../js/practice-focus.js');

const rootDir = path.resolve(__dirname, '..');

test('chooseReviewFocusSelector returns the first empty review field', () => {
    assert.equal(chooseReviewFocusSelector({ actualResult: '', reflection: '', nextAction: '' }), '.actualInput');
    assert.equal(chooseReviewFocusSelector({ actualResult: '做完了', reflection: '', nextAction: '' }), '.reflectionInput');
    assert.equal(chooseReviewFocusSelector({ actualResult: '做完了', reflection: '原因清楚', nextAction: '' }), '.nextInput');
    assert.equal(chooseReviewFocusSelector({ actualResult: '做完了', reflection: '原因清楚', nextAction: '明天继续' }), '.statusInput');
});

test('practice page focuses a hash-targeted practice after dynamic rendering', () => {
    const page = fs.readFileSync(path.join(rootDir, 'practice.html'), 'utf8');

    assert.match(page, /js\/practice-focus\.js/);
    assert.match(page, /focusPracticeFromHash\(practices\)/);
    assert.match(page, /practice-focus-ring/);
    assert.match(page, /chooseReviewFocusSelector/);
});
