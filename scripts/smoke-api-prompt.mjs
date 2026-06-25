import fs from 'node:fs';

const source = fs.readFileSync('api/chat.js', 'utf8');
for (const expected of [
  'selectedSkills',
  'contextChunks',
  'buildMessages',
  'skill-first',
  '不要编造原文',
  '本次缺少原文检索支撑'
]) {
  if (!source.includes(expected)) throw new Error(`api/chat.js missing ${expected}`);
}
console.log('API prompt smoke passed');
