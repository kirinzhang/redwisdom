import fs from 'node:fs';

const file = 'data/mao-skills.json';
if (!fs.existsSync(file)) {
  throw new Error(`${file} does not exist`);
}

const skills = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(skills)) {
  throw new Error('mao-skills.json must be an array');
}
if (skills.length < 8) {
  throw new Error(`expected at least 8 skills, got ${skills.length}`);
}

const required = ['id', 'name', 'summary', 'appliesTo', 'keywords', 'answerMoves', 'actionTemplate', 'sourceHints'];
for (const skill of skills) {
  for (const key of required) {
    if (!(key in skill)) throw new Error(`${skill.id || 'unknown'} missing ${key}`);
  }
  if (!/^[a-z0-9-]+$/.test(skill.id)) throw new Error(`${skill.id} must be kebab-case`);
  for (const key of ['appliesTo', 'keywords', 'answerMoves', 'sourceHints']) {
    if (!Array.isArray(skill[key]) || skill[key].length === 0) {
      throw new Error(`${skill.id}.${key} must be a non-empty array`);
    }
  }
  if (typeof skill.actionTemplate !== 'string' || skill.actionTemplate.length < 12) {
    throw new Error(`${skill.id}.actionTemplate is too short`);
  }
}

const ids = new Set(skills.map((skill) => skill.id));
for (const id of ['main-contradiction', 'investigation-first', 'practice-test', 'seek-truth-from-facts', 'mass-line', 'strategic-patience', 'criticism-self-criticism', 'united-front']) {
  if (!ids.has(id)) throw new Error(`missing required skill ${id}`);
}

console.log(`Validated ${skills.length} Mao method skills`);
