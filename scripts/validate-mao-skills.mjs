import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../data/mao-skills.json', import.meta.url));
if (!fs.existsSync(file)) {
  throw new Error(`${file} does not exist`);
}

const skills = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(skills)) {
  throw new Error('mao-skills.json must be an array');
}

const requiredSkillIds = [
  'main-contradiction',
  'investigation-first',
  'practice-test',
  'seek-truth-from-facts',
  'mass-line',
  'strategic-patience',
  'criticism-self-criticism',
  'united-front',
];
const requiredIdSet = new Set(requiredSkillIds);

if (skills.length !== requiredSkillIds.length) {
  throw new Error(`expected exactly ${requiredSkillIds.length} skills, got ${skills.length}`);
}

const scalarFields = ['id', 'name', 'summary', 'actionTemplate'];
const arrayFields = ['appliesTo', 'keywords', 'answerMoves', 'sourceHints'];
const seenIds = new Set();

function labelFor(skill, index) {
  if (typeof skill?.id === 'string' && skill.id.trim()) return skill.id;
  return `skill at index ${index}`;
}

function validateTrimmedString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error(`${label} must be a non-empty trimmed string`);
  }
}

for (const [index, skill] of skills.entries()) {
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    throw new Error(`skill at index ${index} must be an object`);
  }

  const skillLabel = labelFor(skill, index);

  for (const field of scalarFields) {
    if (!(field in skill)) throw new Error(`${skillLabel} missing ${field}`);
    validateTrimmedString(skill[field], `${skillLabel}.${field}`);
  }

  for (const field of arrayFields) {
    if (!(field in skill)) throw new Error(`${skillLabel} missing ${field}`);
    if (!Array.isArray(skill[field]) || skill[field].length === 0) {
      throw new Error(`${skillLabel}.${field} must be a non-empty array`);
    }

    for (const [itemIndex, value] of skill[field].entries()) {
      validateTrimmedString(value, `${skillLabel}.${field}[${itemIndex}]`);
    }
  }

  if (!/^[a-z0-9-]+$/.test(skill.id)) throw new Error(`${skill.id} must be kebab-case`);
  if (seenIds.has(skill.id)) throw new Error(`duplicate skill id ${skill.id}`);
  if (!requiredIdSet.has(skill.id)) throw new Error(`unexpected skill ${skill.id}`);
  seenIds.add(skill.id);
}

for (const id of requiredSkillIds) {
  if (!seenIds.has(id)) {
    throw new Error(`missing required skill ${id}`);
  }
}

console.log(`Validated ${skills.length} Mao method skills`);
