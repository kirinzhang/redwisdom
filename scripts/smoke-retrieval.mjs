import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('retrieval.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const rw = sandbox.window.RedWisdomRetrieval;
if (!rw) throw new Error('RedWisdomRetrieval global missing');

const skills = JSON.parse(fs.readFileSync('data/mao-skills.json', 'utf8'));
const index = JSON.parse(fs.readFileSync('data/search-index.json', 'utf8'));

const selected = rw.selectSkills('我最近很焦虑，事情太多，不知道先做什么', skills, 3);
if (selected.length !== 3) throw new Error(`expected 3 skills, got ${selected.length}`);
if (!selected.some((skill) => skill.id === 'main-contradiction')) throw new Error('main-contradiction should be selected for anxiety and priority query');

const chunks = rw.rankChunks('我最近很焦虑，事情太多，不知道先做什么', selected, index.chunks, 5);
if (chunks.length !== 5) throw new Error(`expected 5 chunks, got ${chunks.length}`);
for (const chunk of chunks) {
  if (!chunk.title || !chunk.filename || !chunk.excerpt) throw new Error('ranked chunk missing display fields');
}

const url = rw.articleUrl('016-实践论.md', '实践论');
if (url !== 'reading.html#016-%E5%AE%9E%E8%B7%B5%E8%AE%BA.md?source=%E5%AE%9E%E8%B7%B5%E8%AE%BA') {
  throw new Error(`unexpected article url ${url}`);
}

console.log('Retrieval smoke passed');
