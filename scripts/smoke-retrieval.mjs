import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('retrieval.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const rw = sandbox.window.RedWisdomRetrieval;
if (!rw) throw new Error('RedWisdomRetrieval global missing');
for (const name of ['tokenize', 'selectSkills', 'rankChunks', 'articleUrl', 'hasCrisisSignal']) {
  if (typeof rw[name] !== 'function') throw new Error(`${name} API member should be a function`);
}

const skills = JSON.parse(fs.readFileSync('data/mao-skills.json', 'utf8'));
const index = JSON.parse(fs.readFileSync('data/search-index.json', 'utf8'));

const tokens = rw.tokenize('主要矛盾');
if (!tokens.includes('主要') && !tokens.includes('矛盾')) throw new Error('tokenize should produce useful Chinese tokens');

if (!rw.hasCrisisSignal('我想死')) throw new Error('hasCrisisSignal should catch common crisis phrasing');
if (rw.hasCrisisSignal('我想先读实践论')) throw new Error('hasCrisisSignal should ignore normal phrases');

const emptySelected = rw.selectSkills('', skills, 3);
if (!Array.isArray(emptySelected)) throw new Error('selectSkills should return an array for empty input');
if (emptySelected.length !== 0) throw new Error('selectSkills should not return arbitrary skills for empty input');
if (rw.selectSkills(undefined).length !== 0) throw new Error('selectSkills should tolerate missing skills');
if (rw.selectSkills('天气晴朗散步吃饭', skills, 3).length !== 0) {
  throw new Error('selectSkills should not return arbitrary skills for unrelated Chinese input');
}
if (rw.rankChunks('天气晴朗散步吃饭', [], index.chunks, 5).length !== 0) {
  throw new Error('rankChunks should not return chunks when no skills are selected');
}

const emptyChunks = rw.rankChunks('', [], index.chunks, 5);
if (!Array.isArray(emptyChunks)) throw new Error('rankChunks should return an array for empty input');
if (emptyChunks.length !== 0) throw new Error('rankChunks should not return arbitrary chunks for empty input');
if (rw.rankChunks(undefined).length !== 0) throw new Error('rankChunks should tolerate missing chunks');

const anxietyPriorityQuery = '我最近很焦虑，事情太多，不知道先做什么';
const selected = rw.selectSkills(anxietyPriorityQuery, skills, 3);
if (selected.length !== 3) throw new Error(`expected 3 skills, got ${selected.length}`);
if (!selected.some((skill) => skill.id === 'main-contradiction')) throw new Error('main-contradiction should be selected for anxiety and priority query');

const shortAnxietySelected = rw.selectSkills('我最近很焦虑', skills, 3);
if (shortAnxietySelected.length < 2) {
  throw new Error(`short anxiety prompt should select at least 2 skills, got ${shortAnxietySelected.length}`);
}
if (!shortAnxietySelected.some((skill) => skill.id === 'main-contradiction')) {
  throw new Error('main-contradiction should be selected for short anxiety prompt');
}

const chunks = rw.rankChunks(anxietyPriorityQuery, selected, index.chunks, 5);
if (chunks.length !== 5) throw new Error(`expected 5 chunks, got ${chunks.length}`);
for (const chunk of chunks) {
  if (!chunk.title || !chunk.filename || !chunk.excerpt) throw new Error('ranked chunk missing display fields');
}
if (!chunks.some((chunk) => chunk.title === '矛盾论')) throw new Error('top ranked chunks should include 矛盾论 for anxiety and priority query');

const url = rw.articleUrl('016-实践论.md', '实践论');
if (url !== 'reading.html#016-%E5%AE%9E%E8%B7%B5%E8%AE%BA.md?source=%E5%AE%9E%E8%B7%B5%E8%AE%BA') {
  throw new Error(`unexpected article url ${url}`);
}

console.log('Retrieval smoke passed');
