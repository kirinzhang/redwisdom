const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

test('practice page renders saved Maoist method context for each practice card', () => {
    const page = fs.readFileSync(path.join(rootDir, 'practice.html'), 'utf8');

    assert.match(page, /methodContextBlock\(practice\)/);
    assert.match(page, /function methodContextBlock\(practice\)/);
    assert.match(page, /方法分析/);
    assert.match(page, /主要矛盾/);
    assert.match(page, /缺少的调查/);
    assert.match(page, /可用力量/);
    assert.match(page, /复盘标准/);
    assert.match(page, /practice\.mainContradiction/);
    assert.match(page, /practice\.investigationTodo/);
    assert.match(page, /practice\.availableForces/);
    assert.match(page, /practice\.expectedResult/);
});
