const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

test('manual practice form captures Maoist method analysis fields', () => {
    const page = fs.readFileSync(path.join(rootDir, 'practice.html'), 'utf8');

    assert.match(page, /id="mainContradictionInput"/);
    assert.match(page, /id="investigationTodoInput"/);
    assert.match(page, /id="availableForcesInput"/);
    assert.match(page, /id="expectedResultInput"/);
    assert.match(page, /主要矛盾/);
    assert.match(page, /缺少的调查/);
    assert.match(page, /可用力量/);
    assert.match(page, /复盘标准/);

    assert.match(page, /mainContradiction:\s*document\.getElementById\('mainContradictionInput'\)\.value/);
    assert.match(page, /investigationTodo:\s*document\.getElementById\('investigationTodoInput'\)\.value/);
    assert.match(page, /availableForces:\s*document\.getElementById\('availableForcesInput'\)\.value/);
    assert.match(page, /expectedResult:\s*document\.getElementById\('expectedResultInput'\)\.value/);
});
