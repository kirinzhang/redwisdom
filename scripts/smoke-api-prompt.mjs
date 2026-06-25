import fs from 'node:fs';

const source = fs.readFileSync('api/chat.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const expected of [
  'selectedSkills',
  'contextChunks',
  'buildMessages',
  'skill-first',
  '不要编造原文',
  '本次缺少原文检索支撑'
]) {
  assert(source.includes(expected), `api/chat.js missing ${expected}`);
}

assert(!source.includes('...history'), 'api/chat.js must not spread raw history into messages');
assert(
  /\{\s*role:\s*['"]user['"]\s*,\s*content:\s*contextPrompt\s*\}/.test(source),
  'client selectedSkills/contextChunks reference prompt must be a user message'
);
assert(
  /role\s*===\s*['"]user['"][\s\S]*role\s*===\s*['"]assistant['"]/.test(source)
    || /role\s*===\s*['"]assistant['"][\s\S]*role\s*===\s*['"]user['"]/.test(source)
    || /role\s*!==\s*['"]user['"][\s\S]*role\s*!==\s*['"]assistant['"]/.test(source)
    || /role\s*!==\s*['"]assistant['"][\s\S]*role\s*!==\s*['"]user['"]/.test(source),
  'history must be filtered to user/assistant roles'
);
assert(
  /!response\.body[\s\S]{0,500}status\(502\)/.test(source),
  'missing upstream response body must return HTTP 502'
);

console.log('API prompt smoke passed');
