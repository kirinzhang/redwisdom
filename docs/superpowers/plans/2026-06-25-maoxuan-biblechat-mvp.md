# Maoxuan BibleChat MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Red Wisdom MVP where "问道毛选" answers real-life problems by selecting distilled Mao Selected Works method skills, retrieving supporting source passages, streaming an AI answer, and linking citations back to original texts.

**Architecture:** Keep the existing static HTML + vanilla JavaScript + Vercel API shape. Add static `mao-skills.json` and generated `search-index.json`, run skill selection and lexical retrieval in the browser, and send `selectedSkills` plus `contextChunks` to `/api/chat` for a strict skill-first, context-backed OpenRouter call. Preserve the current red/rice-paper visual identity while upgrading the chat, card, reader, and docs flows.

**Tech Stack:** HTML5, Tailwind CDN, vanilla JavaScript, Node.js scripts, Vercel serverless function, OpenRouter API, existing Markdown source corpus.

---

## File Structure

- `data/mao-skills.json`: Static distilled Mao Selected Works method skills used by "问道毛选".
- `scripts/validate-mao-skills.mjs`: Validates skill data shape and minimum content.
- `scripts/build-search-index.mjs`: Builds paragraph chunks from `data/catalog.json` and `data/articles/*.md`.
- `scripts/verify-search-index.mjs`: Validates generated search index and runs retrieval smoke checks.
- `data/search-index.json`: Generated static retrieval index committed with the app.
- `retrieval.js`: Browser utilities for tokenization, skill selection, chunk ranking, URL helpers, and response safety checks.
- `api/chat.js`: Receives `{ message, history, selectedSkills, contextChunks }`, builds a skill-first prompt, and streams OpenRouter output.
- `chat.html`: Main "问道毛选" UI with skill chips, prompt chips, retrieval state, citation cards, and URL prompt prefill.
- `index.html`: Keeps the card ritual and adds post-reveal CTAs into chat/reader.
- `script.js`: Fixes card runtime bug, quote sizing, daily prompt CTA behavior.
- `reading.html`: Preserves reader and adds source-entry banner from citation links.
- `README.md`: Updates deployment, local usage, and MVP behavior.

---

### Task 0: Normalize Current Repository Baseline

**Files:**
- Stage existing project files currently untracked.
- Do not modify source behavior in this task.

- [ ] **Step 1: Verify current branch and status**

Run:

```bash
git status --short --branch
git log --oneline --decorate -3
```

Expected: branch is `codex/maoxuan-biblechat`; source files such as `chat.html`, `index.html`, `data/`, and `api/` are untracked; docs commits exist.

- [ ] **Step 2: Run baseline static checks**

Run:

```bash
node -e "const fs=require('fs'); for (const f of ['index.html','chat.html','reading.html','api/chat.js','data/catalog.json','data/articles/016-实践论.md']) { if (!fs.existsSync(f)) throw new Error('missing '+f); } console.log('baseline files present')"
```

Expected: `baseline files present`.

- [ ] **Step 3: Stage restored app snapshot**

Run:

```bash
git add .gitignore CNAME README.md api assets chat.html config.js data.js data icon1.jpg icon2.jpg index.html reading.html script.js style.css vercel.json
```

Expected: `git status --short` shows these files staged as added.

- [ ] **Step 4: Commit restored app snapshot**

Run:

```bash
git commit -m "chore: import existing red wisdom app snapshot"
```

Expected: commit succeeds. This separates the recovered upstream app from MVP changes.

---

### Task 1: Add Mao Method Skills Data And Validation

**Files:**
- Create: `data/mao-skills.json`
- Create: `scripts/validate-mao-skills.mjs`

- [ ] **Step 1: Write failing validation script**

Create `scripts/validate-mao-skills.mjs`:

```js
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
```

- [ ] **Step 2: Run validation to verify it fails**

Run:

```bash
node scripts/validate-mao-skills.mjs
```

Expected: FAIL with `data/mao-skills.json does not exist`.

- [ ] **Step 3: Create Mao skills data**

Create `data/mao-skills.json` with this exact array shape and the eight required skills:

```json
[
  {
    "id": "main-contradiction",
    "name": "抓主要矛盾",
    "summary": "在许多问题并存时，先找出最主要、最迫切、最能带动全局的矛盾。",
    "appliesTo": ["焦虑混乱", "选择困难", "问题太多", "推进卡住", "优先级判断"],
    "keywords": ["矛盾", "主要", "次要", "重点", "关键", "焦虑", "混乱", "优先级", "选择", "卡住"],
    "answerMoves": ["先把问题拆成几个矛盾", "判断哪一个矛盾最影响全局", "把行动集中到最小突破口"],
    "actionTemplate": "今天只处理一个最能带动全局的小动作，并写下它影响了哪些相关问题。",
    "sourceHints": ["矛盾论", "主要矛盾", "矛盾的主要方面"]
  },
  {
    "id": "investigation-first",
    "name": "没有调查就没有发言权",
    "summary": "当信息不足、判断过快或脑补过多时，先回到事实、现场和具体材料。",
    "appliesTo": ["信息不足", "误解他人", "判断过快", "担心未来", "团队沟通"],
    "keywords": ["调查", "研究", "事实", "材料", "情况", "了解", "访谈", "证据", "判断", "脑补"],
    "answerMoves": ["区分事实和猜测", "列出还缺哪些材料", "设计一次低成本调查"],
    "actionTemplate": "在做结论前，找一个相关人问三个具体问题，并记录事实而不是评价。",
    "sourceHints": ["反对本本主义", "调查研究", "没有调查没有发言权"]
  },
  {
    "id": "practice-test",
    "name": "实践检验",
    "summary": "把想法变成小实验，让行动和反馈校正判断，而不是困在空想里。",
    "appliesTo": ["想太多", "行动迟滞", "完美主义", "犹豫", "学习计划"],
    "keywords": ["实践", "行动", "检验", "经验", "认识", "试验", "反馈", "空想", "完美主义", "开始"],
    "answerMoves": ["把大判断改成小实验", "定义可观察结果", "用反馈修正下一步"],
    "actionTemplate": "把问题缩小成一个 30 分钟可完成的实验，完成后写下事实反馈。",
    "sourceHints": ["实践论", "认识和实践", "实践是真理的标准"]
  },
  {
    "id": "seek-truth-from-facts",
    "name": "实事求是",
    "summary": "把愿望、情绪和事实分开，按真实情况决定下一步。",
    "appliesTo": ["自我怀疑", "过度悲观", "过度乐观", "逃避现实", "复盘"],
    "keywords": ["事实", "实际", "真实", "求是", "幻想", "悲观", "乐观", "愿望", "情绪", "复盘"],
    "answerMoves": ["写下事实清单", "写下情绪解释", "从事实中找下一步"],
    "actionTemplate": "把当前问题分成事实、解释、愿望三列，只根据事实列决定下一步。",
    "sourceHints": ["改造我们的学习", "实事求是", "反对主观主义"]
  },
  {
    "id": "mass-line",
    "name": "群众路线/从反馈中来",
    "summary": "从真实反馈中发现问题，再把整理后的方法带回实践验证。",
    "appliesTo": ["团队协作", "产品反馈", "沟通问题", "关系修复", "管理"],
    "keywords": ["群众", "反馈", "沟通", "团队", "关系", "协作", "意见", "总结", "路线", "用户"],
    "answerMoves": ["找到受影响的人", "收集真实反馈", "把反馈整理成可执行调整"],
    "actionTemplate": "今天向两个相关人收集具体反馈，问他们最希望你改变的一件事。",
    "sourceHints": ["关于领导方法的若干问题", "从群众中来", "到群众中去"]
  },
  {
    "id": "strategic-patience",
    "name": "持久战与战略耐心",
    "summary": "面对长期目标和压力时，分阶段看局势，不用一时胜负判断全局。",
    "appliesTo": ["长期目标", "学习", "减肥", "职业转型", "压力积累", "低谷"],
    "keywords": ["持久", "阶段", "长期", "耐心", "战略", "低谷", "积累", "学习", "转型", "压力"],
    "answerMoves": ["判断当前处于哪个阶段", "降低短期胜负感", "设计可持续节奏"],
    "actionTemplate": "把目标拆成三阶段，只为当前阶段设一个可持续动作。",
    "sourceHints": ["论持久战", "战略防御", "战略相持", "战略反攻"]
  },
  {
    "id": "criticism-self-criticism",
    "name": "批评与自我批评",
    "summary": "把批评从羞耻感中拆出来，转化为修正机制和成长材料。",
    "appliesTo": ["被批评", "内疚", "失败复盘", "关系冲突", "自尊受挫"],
    "keywords": ["批评", "自我批评", "错误", "缺点", "复盘", "内疚", "失败", "改正", "冲突", "受挫"],
    "answerMoves": ["承认可改部分", "区分事实批评和情绪攻击", "给出改正动作"],
    "actionTemplate": "写下批评中可验证的一点，并在 24 小时内做一个修正动作。",
    "sourceHints": ["反对自由主义", "整顿党的作风", "批评和自我批评"]
  },
  {
    "id": "united-front",
    "name": "统一战线/团结可团结的人",
    "summary": "在资源不足或推进困难时，识别同盟、争取支持，减少无谓对抗。",
    "appliesTo": ["资源不足", "协作推进", "争取支持", "组织项目", "对抗太多"],
    "keywords": ["团结", "统一战线", "同盟", "支持", "资源", "协作", "争取", "对抗", "朋友", "力量"],
    "answerMoves": ["识别共同利益", "找可争取的人", "先建立最小合作"],
    "actionTemplate": "列出三个可以争取的人，今天先向最容易支持你的人发出一个具体请求。",
    "sourceHints": ["统一战线", "中国共产党在抗日时期的任务", "团结一切可以团结的力量"]
  }
]
```

- [ ] **Step 4: Run validation to verify it passes**

Run:

```bash
node scripts/validate-mao-skills.mjs
```

Expected: `Validated 8 Mao method skills`.

- [ ] **Step 5: Commit**

Run:

```bash
git add data/mao-skills.json scripts/validate-mao-skills.mjs
git commit -m "feat: add maoxuan method skills"
```

---

### Task 2: Build And Verify The Source Search Index

**Files:**
- Create: `scripts/build-search-index.mjs`
- Create: `scripts/verify-search-index.mjs`
- Generate: `data/search-index.json`

- [ ] **Step 1: Write failing search-index verifier**

Create `scripts/verify-search-index.mjs`:

```js
import fs from 'node:fs';

const indexFile = 'data/search-index.json';
if (!fs.existsSync(indexFile)) {
  throw new Error(`${indexFile} does not exist`);
}

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
if (!index || !Array.isArray(index.chunks)) throw new Error('search index must contain chunks array');
if (index.chunks.length < 1000) throw new Error(`expected at least 1000 chunks, got ${index.chunks.length}`);

const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const catalogFiles = Object.values(catalog.volumes).flat().map((article) => article.filename);
const indexedFiles = new Set(index.chunks.map((chunk) => chunk.filename));
for (const filename of catalogFiles) {
  if (!indexedFiles.has(filename)) throw new Error(`missing indexed chunks for ${filename}`);
  if (!fs.existsSync(`data/articles/${filename}`)) throw new Error(`missing article file ${filename}`);
}

for (const chunk of index.chunks.slice(0, 20)) {
  for (const key of ['id', 'title', 'filename', 'volume', 'text', 'tokens']) {
    if (!(key in chunk)) throw new Error(`chunk missing ${key}`);
  }
  if (!Array.isArray(chunk.tokens) || chunk.tokens.length === 0) throw new Error(`${chunk.id} has no tokens`);
}

const smokeQueries = ['焦虑', '行动', '批评', '调查研究', '主要矛盾'];
for (const query of smokeQueries) {
  const hasMatch = index.chunks.some((chunk) => chunk.text.includes(query) || chunk.tokens.includes(query));
  if (!hasMatch) throw new Error(`no smoke match for ${query}`);
}

console.log(`Verified ${index.chunks.length} chunks across ${indexedFiles.size} articles`);
```

- [ ] **Step 2: Run verifier to verify it fails**

Run:

```bash
node scripts/verify-search-index.mjs
```

Expected: FAIL with `data/search-index.json does not exist`.

- [ ] **Step 3: Create index builder**

Create `scripts/build-search-index.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const outFile = 'data/search-index.json';

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~-]/g, '')
    .replace(/\r/g, '')
    .trim();
}

function tokenize(text) {
  const normalized = text.toLowerCase();
  const ascii = normalized.match(/[a-z0-9]+/g) || [];
  const chinese = Array.from(normalized.replace(/[^\u4e00-\u9fff]/g, ''));
  const grams = [];
  for (let i = 0; i < chinese.length; i += 1) {
    grams.push(chinese[i]);
    if (i < chinese.length - 1) grams.push(chinese[i] + chinese[i + 1]);
  }
  return Array.from(new Set([...ascii, ...grams])).filter(Boolean);
}

function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 24);
}

const chunks = [];
let articleCount = 0;

for (const [volume, articles] of Object.entries(catalog.volumes)) {
  for (const article of articles) {
    const articlePath = path.join('data/articles', article.filename);
    const markdown = fs.readFileSync(articlePath, 'utf8');
    const paragraphs = splitParagraphs(stripMarkdown(markdown));
    articleCount += 1;
    paragraphs.forEach((text, paragraphIndex) => {
      const safeText = text.length > 900 ? `${text.slice(0, 900)}...` : text;
      chunks.push({
        id: `${article.index}-${paragraphIndex}`,
        articleIndex: article.index,
        paragraphIndex,
        title: article.title,
        filename: article.filename,
        volume,
        text: safeText,
        tokens: tokenize(`${article.title} ${volume} ${safeText}`)
      });
    });
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  articleCount,
  chunkCount: chunks.length,
  chunks
};

fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${chunks.length} chunks from ${articleCount} articles to ${outFile}`);
```

- [ ] **Step 4: Generate index**

Run:

```bash
node scripts/build-search-index.mjs
```

Expected: output starts with `Wrote ` and includes ` chunks from 229 articles to data/search-index.json`.

- [ ] **Step 5: Verify index**

Run:

```bash
node scripts/verify-search-index.mjs
```

Expected: output starts with `Verified ` and includes ` chunks across 229 articles`.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/build-search-index.mjs scripts/verify-search-index.mjs data/search-index.json
git commit -m "feat: build maoxuan source search index"
```

---

### Task 3: Add Browser Retrieval And Skill Selection Utilities

**Files:**
- Create: `retrieval.js`
- Create: `scripts/smoke-retrieval.mjs`

- [ ] **Step 1: Write retrieval smoke test**

Create `scripts/smoke-retrieval.mjs`:

```js
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
```

- [ ] **Step 2: Run smoke test to verify it fails**

Run:

```bash
node scripts/smoke-retrieval.mjs
```

Expected: FAIL because `retrieval.js` does not exist.

- [ ] **Step 3: Create retrieval utilities**

Create `retrieval.js` with a browser global API:

```js
(function () {
    function tokenize(text) {
        const normalized = String(text || '').toLowerCase();
        const ascii = normalized.match(/[a-z0-9]+/g) || [];
        const chinese = Array.from(normalized.replace(/[^\u4e00-\u9fff]/g, ''));
        const grams = [];
        for (let i = 0; i < chinese.length; i += 1) {
            grams.push(chinese[i]);
            if (i < chinese.length - 1) grams.push(chinese[i] + chinese[i + 1]);
        }
        return Array.from(new Set([...ascii, ...grams])).filter(Boolean);
    }

    function scoreByTokens(queryTokens, candidateTokens, weight) {
        const candidateSet = new Set(candidateTokens || []);
        return queryTokens.reduce((score, token) => score + (candidateSet.has(token) ? weight : 0), 0);
    }

    function selectSkills(message, skills, limit = 3) {
        const queryTokens = tokenize(message);
        return [...skills]
            .map((skill) => {
                const skillTokens = tokenize([
                    skill.name,
                    skill.summary,
                    ...(skill.appliesTo || []),
                    ...(skill.keywords || []),
                    ...(skill.answerMoves || []),
                    skill.actionTemplate
                ].join(' '));
                let score = scoreByTokens(queryTokens, skillTokens, 4);
                for (const keyword of skill.keywords || []) {
                    if (String(message).includes(keyword)) score += 8;
                }
                return { ...skill, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    function excerpt(text, queryTokens) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        const hit = queryTokens.find((token) => token.length >= 2 && clean.includes(token));
        const start = hit ? Math.max(0, clean.indexOf(hit) - 80) : 0;
        return clean.slice(start, start + 220);
    }

    function rankChunks(message, selectedSkills, chunks, limit = 6) {
        const queryTokens = tokenize(message);
        const skillTokens = tokenize(selectedSkills.map((skill) => [
            skill.name,
            skill.summary,
            ...(skill.keywords || []),
            ...(skill.sourceHints || [])
        ].join(' ')).join(' '));
        const allTokens = Array.from(new Set([...queryTokens, ...skillTokens]));
        return [...chunks]
            .map((chunk) => {
                const titleScore = queryTokens.some((token) => chunk.title.includes(token)) ? 12 : 0;
                const textScore = queryTokens.reduce((score, token) => score + (chunk.text.includes(token) ? 3 : 0), 0);
                const tokenScore = scoreByTokens(allTokens, chunk.tokens, 1);
                return {
                    ...chunk,
                    score: titleScore + textScore + tokenScore,
                    excerpt: excerpt(chunk.text, queryTokens)
                };
            })
            .filter((chunk) => chunk.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    function articleUrl(filename, title) {
        return `reading.html#${encodeURIComponent(filename)}?source=${encodeURIComponent(title || '')}`;
    }

    function hasCrisisSignal(message) {
        return /自杀|不想活|伤害自己|结束生命|活不下去|轻生/.test(String(message || ''));
    }

    window.RedWisdomRetrieval = {
        tokenize,
        selectSkills,
        rankChunks,
        articleUrl,
        hasCrisisSignal
    };
})();
```

- [ ] **Step 4: Run smoke test to verify it passes**

Run:

```bash
node scripts/smoke-retrieval.mjs
```

Expected: `Retrieval smoke passed`.

- [ ] **Step 5: Commit**

Run:

```bash
git add retrieval.js scripts/smoke-retrieval.mjs
git commit -m "feat: add client retrieval utilities"
```

---

### Task 4: Make The Chat API Skill-First And Context-Backed

**Files:**
- Modify: `api/chat.js`
- Create: `scripts/smoke-api-prompt.mjs`

- [ ] **Step 1: Write API source smoke test**

Create `scripts/smoke-api-prompt.mjs`:

```js
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
```

- [ ] **Step 2: Run API smoke test to verify it fails**

Run:

```bash
node scripts/smoke-api-prompt.mjs
```

Expected: FAIL because current API does not include `selectedSkills`.

- [ ] **Step 3: Update `api/chat.js` request handling**

Add a `buildMessages` helper near the top of `api/chat.js` and use it for POST requests:

```js
function formatSkill(skill, index) {
    return `${index + 1}. ${skill.name}: ${skill.summary}\n适用场景: ${(skill.appliesTo || []).join('、')}\n行动模板: ${skill.actionTemplate}`;
}

function formatChunk(chunk, index) {
    return `[${index + 1}] 《${chunk.title}》(${chunk.filename})\n${chunk.text}`;
}

function buildMessages(body) {
    const selectedSkills = Array.isArray(body.selectedSkills) ? body.selectedSkills.slice(0, 3) : [];
    const contextChunks = Array.isArray(body.contextChunks) ? body.contextChunks.slice(0, 6) : [];
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const message = String(body.message || '').trim();
    const hasContext = contextChunks.length > 0;

    const systemPrompt = `你是“问道毛选”的方法论咨询助手。你的回答必须 skill-first + context-backed。

硬性规则：
1. 先使用 selectedSkills 组织回答，不要临场发散成泛泛鸡汤。
2. 原文引用只能来自 contextChunks，不能编造原文、篇名、日期或出处。
3. 如果 contextChunks 为空或弱相关，必须明确写出“本次缺少原文检索支撑”或“本次原文匹配较弱”。
4. 回答不扮演毛泽东本人，只能说“用毛选方法论看”。
5. 当用户有自伤或危险信号时，先建议立刻联系现实中的可信任人员或专业帮助。

回答结构：
- 先稳住
- 调用方法
- 从原文看
- 怎么做
- 回到实践`;

    const contextPrompt = `selectedSkills:
${selectedSkills.map(formatSkill).join('\n\n') || '无'}

contextChunks:
${contextChunks.map(formatChunk).join('\n\n') || '无'}

contextStatus: ${hasContext ? '有原文检索支撑' : '本次缺少原文检索支撑'}`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: contextPrompt },
        ...history,
        { role: 'user', content: message }
    ];
}
```

Then change the OpenRouter request body from forwarding `req.body` to:

```js
const messages = buildMessages(req.body || {});
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://redwisdom.xyz',
        'X-Title': 'Red Wisdom Chat'
    },
    body: JSON.stringify({
        model: req.body?.model || 'deepseek/deepseek-chat',
        messages,
        stream: true
    })
});
```

- [ ] **Step 4: Handle upstream non-OK responses**

Before streaming, add:

```js
if (!response.ok || !response.body) {
    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status || 500).json({
        error: text || `OpenRouter error ${response.status}`
    });
}
```

- [ ] **Step 5: Run API smoke test**

Run:

```bash
node scripts/smoke-api-prompt.mjs
```

Expected: `API prompt smoke passed`.

- [ ] **Step 6: Commit**

Run:

```bash
git add api/chat.js scripts/smoke-api-prompt.mjs
git commit -m "feat: ground chat api in maoxuan skills"
```

---

### Task 5: Upgrade Chat UI To Select Skills, Retrieve Sources, And Render Cards

**Files:**
- Modify: `chat.html`

- [ ] **Step 1: Add script dependency**

In `chat.html`, load retrieval utilities before inline chat script:

```html
<script src="config.js"></script>
<script src="retrieval.js"></script>
<script>
```

- [ ] **Step 2: Add state and data loaders**

Inside the inline script, replace the old prompt-only state with:

```js
let conversationHistory = [];
let isGenerating = false;
let maoSkills = [];
let searchChunks = [];

async function loadKnowledgeBase() {
    const [skillsResponse, indexResponse] = await Promise.all([
        fetch('data/mao-skills.json'),
        fetch('data/search-index.json')
    ]);
    if (!skillsResponse.ok) throw new Error('无法加载毛选方法 skills');
    maoSkills = await skillsResponse.json();
    if (indexResponse.ok) {
        const index = await indexResponse.json();
        searchChunks = index.chunks || [];
    }
}
```

- [ ] **Step 3: Add prompt chips in the message area**

Add a compact prompt chip panel under the welcome message:

```html
<div id="promptChips" class="px-4 pb-2 flex flex-wrap gap-2">
    <button data-prompt="我最近很焦虑，事情太多，不知道先做什么" class="prompt-chip px-3 py-2 rounded-full border border-china-red/30 text-china-red bg-white/70 font-serif text-sm">我最近很焦虑</button>
    <button data-prompt="工作推进不下去，感觉大家都不配合" class="prompt-chip px-3 py-2 rounded-full border border-china-red/30 text-china-red bg-white/70 font-serif text-sm">工作推进不下去</button>
    <button data-prompt="我被批评后很受挫，开始怀疑自己" class="prompt-chip px-3 py-2 rounded-full border border-china-red/30 text-china-red bg-white/70 font-serif text-sm">被批评后很受挫</button>
    <button data-prompt="我想开始行动，但总是想太多" class="prompt-chip px-3 py-2 rounded-full border border-china-red/30 text-china-red bg-white/70 font-serif text-sm">如何开始行动</button>
</div>
```

- [ ] **Step 4: Add skill and citation card renderers**

Add helper functions:

```js
function renderSkillCards(skills) {
    return `
        <div class="mt-3 grid gap-2">
            ${skills.map(skill => `
                <div class="rounded-lg border border-china-red/20 bg-warm-rice/70 p-3">
                    <div class="font-mao text-lg text-china-red">${escapeHtml(skill.name)}</div>
                    <p class="font-serif text-sm text-ink-black/75">${escapeHtml(skill.summary)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCitationCards(chunks) {
    return `
        <div class="mt-3 space-y-2">
            ${chunks.map(chunk => `
                <a href="${RedWisdomRetrieval.articleUrl(chunk.filename, chunk.title)}" class="block rounded-lg border border-dark-beige/60 bg-warm-rice/80 p-3 hover:border-china-red transition">
                    <div class="font-serif font-bold text-china-red">《${escapeHtml(chunk.title)}》</div>
                    <p class="mt-1 font-serif text-sm text-ink-black/75 leading-relaxed">${escapeHtml(chunk.excerpt || chunk.text.slice(0, 160))}</p>
                    <span class="mt-2 inline-block text-xs text-china-red">读原文</span>
                </a>
            `).join('')}
        </div>
    `;
}
```

- [ ] **Step 5: Update `sendMessage` request payload**

Before `addUserMessage(userMessage)`, compute:

```js
const selectedSkills = RedWisdomRetrieval.selectSkills(userMessage, maoSkills, 3);
const contextChunks = searchChunks.length
    ? RedWisdomRetrieval.rankChunks(userMessage, selectedSkills, searchChunks, 6)
    : [];
```

Use request body:

```js
body: JSON.stringify({
    model: MODEL,
    message: userMessage,
    history: conversationHistory,
    selectedSkills,
    contextChunks,
    stream: true
})
```

After creating assistant message, render cards under the streaming content:

```js
const cardsWrapper = document.createElement('div');
cardsWrapper.innerHTML = renderSkillCards(selectedSkills) + renderCitationCards(contextChunks);
contentElement.parentElement.appendChild(cardsWrapper);
```

- [ ] **Step 6: Initialize data and URL prompt prefill**

At the bottom of the script, before event handlers or immediately after them, add:

```js
loadKnowledgeBase().catch((error) => {
    addErrorMessage(error.message);
});

const params = new URLSearchParams(window.location.search);
const presetPrompt = params.get('prompt');
if (presetPrompt) {
    userInput.value = presetPrompt;
    userInput.focus();
}

document.querySelectorAll('.prompt-chip').forEach((button) => {
    button.addEventListener('click', () => {
        userInput.value = button.dataset.prompt;
        userInput.focus();
    });
});
```

- [ ] **Step 7: Run static smoke checks**

Run:

```bash
node scripts/validate-mao-skills.mjs
node scripts/verify-search-index.mjs
node scripts/smoke-retrieval.mjs
node scripts/smoke-api-prompt.mjs
```

Expected: all pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add chat.html
git commit -m "feat: upgrade chat with maoxuan skills and citations"
```

---

### Task 6: Upgrade Homepage Card Flow Into Daily Companion CTAs

**Files:**
- Modify: `script.js`
- Modify: `index.html`

- [ ] **Step 1: Fix quote-size ordering and remove broken save icon reference**

In `script.js`, replace the length branch with:

```js
if (len < 20) {
    fontSizeClass = 'quote-size-large';
    layoutClass = 'layout-center';
} else if (len > 80) {
    fontSizeClass = 'quote-size-xs';
    layoutClass = 'layout-top';
} else if (len > 40) {
    fontSizeClass = 'quote-size-small';
    layoutClass = 'layout-top';
} else {
    layoutClass = 'layout-center';
}
```

Remove this line:

```js
saveIcon.style.opacity = '1';
```

- [ ] **Step 2: Add post-card CTA container**

In `index.html`, after `controls-area`, add:

```html
<div id="daily-actions" class="mt-2 flex flex-wrap justify-center gap-3 opacity-0 transition-opacity duration-500 pointer-events-none">
    <a id="ask-with-card" href="chat.html" class="px-6 py-3 bg-china-red text-warm-rice font-mao text-xl rounded-full hover:bg-red-800 transition-all duration-300 shadow-md">问问这件事</a>
    <a id="read-with-card" href="reading.html" class="px-6 py-3 border-2 border-china-red text-china-red font-mao text-xl rounded-full hover:bg-china-red hover:text-warm-rice transition-all duration-300 shadow-md">读相关原文</a>
</div>
```

- [ ] **Step 3: Wire CTAs in `script.js`**

Add DOM refs:

```js
const dailyActions = document.getElementById('daily-actions');
const askWithCard = document.getElementById('ask-with-card');
const readWithCard = document.getElementById('read-with-card');
```

When a quote is selected, set links:

```js
function buildPromptFromQuote(quote) {
    return `我抽到这句话：“${quote.content}”。请用毛选方法论帮我理解它，并联系我当下的问题给出行动建议。`;
}
```

Inside `dealCard()` after selecting `quote`:

```js
askWithCard.href = `chat.html?prompt=${encodeURIComponent(buildPromptFromQuote(quote))}`;
readWithCard.href = 'reading.html';
dailyActions.style.opacity = '0';
dailyActions.style.pointerEvents = 'none';
```

When the card flips, show daily actions:

```js
dailyActions.style.opacity = '1';
dailyActions.style.pointerEvents = 'auto';
```

- [ ] **Step 4: Reset CTAs on retry**

In retry click handler, add:

```js
dailyActions.style.opacity = '0';
dailyActions.style.pointerEvents = 'none';
```

- [ ] **Step 5: Run static smoke checks**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('script.js','utf8'); if (s.includes('saveIcon.style')) throw new Error('saveIcon reference remains'); if (!s.includes('buildPromptFromQuote')) throw new Error('missing quote prompt builder'); console.log('homepage smoke passed')"
```

Expected: `homepage smoke passed`.

- [ ] **Step 6: Commit**

Run:

```bash
git add index.html script.js
git commit -m "feat: turn card ritual into daily companion"
```

---

### Task 7: Add Reader Entry Banner From Citation Links

**Files:**
- Modify: `reading.html`

- [ ] **Step 1: Add source banner markup**

Inside `articleContent`, before `welcomeMessage`, add:

```html
<div id="sourceBanner" class="hidden mb-6 rounded-lg border border-china-red/20 bg-white/70 p-4 font-serif text-sm text-ink-black">
    <span class="text-china-red font-bold">来自问道引用：</span>
    <span id="sourceBannerTitle"></span>
</div>
```

- [ ] **Step 2: Parse hash and source query safely**

In `reading.html`, add helpers near existing script state:

```js
function parseArticleHash() {
    const raw = window.location.hash.slice(1);
    if (!raw) return { filename: '', source: '' };
    const [filenamePart, queryPart] = raw.split('?');
    const params = new URLSearchParams(queryPart || '');
    return {
        filename: decodeURIComponent(filenamePart),
        source: params.get('source') || ''
    };
}

function showSourceBanner(source) {
    const banner = document.getElementById('sourceBanner');
    const title = document.getElementById('sourceBannerTitle');
    if (!source) {
        banner.classList.add('hidden');
        title.textContent = '';
        return;
    }
    title.textContent = source;
    banner.classList.remove('hidden');
}
```

- [ ] **Step 3: Use parser during catalog load**

Replace direct hash handling:

```js
if (window.location.hash) {
    const { filename, source } = parseArticleHash();
    showSourceBanner(source);
    if (filename) loadArticle(filename);
}
```

- [ ] **Step 4: Run reader smoke check**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('reading.html','utf8'); for (const expected of ['sourceBanner','parseArticleHash','showSourceBanner']) { if (!s.includes(expected)) throw new Error('missing '+expected); } console.log('reader smoke passed')"
```

Expected: `reader smoke passed`.

- [ ] **Step 5: Commit**

Run:

```bash
git add reading.html
git commit -m "feat: link citations into reader"
```

---

### Task 8: Update README And Run Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README product description**

Replace the feature and tech-stack sections with copy that includes these exact facts:

```md
### 2. 问道毛选 - Skill-first 原文支撑咨询
- **毛选方法论 Skills**: 先从 `data/mao-skills.json` 选择 2-3 个方法论 skill，例如抓主要矛盾、调查研究、实践检验、群众路线。
- **原文出处支撑**: 再从 `data/search-index.json` 检索毛选原文段落，回答附带引用卡片和“读原文”入口。
- **现实问题咨询**: 面向焦虑、工作推进、被批评、行动迟滞、学习计划等现实问题，输出安慰、分析和下一步行动。
- **基于 DeepSeek / OpenRouter**: 通过 `/api/chat` 的 Vercel Serverless Function 代理调用模型。
```

Also replace the deployment note with:

````md
### Vercel 部署

1. Fork 本仓库到 GitHub。
2. 在 Vercel 中导入仓库。
3. 在 Environment Variables 中添加 `OPENROUTER_API_KEY`。
4. 部署后访问站点，`/api/chat` 会使用服务端环境变量代理 OpenRouter。

### 本地运行

```bash
python3 -m http.server 8080
```

本地静态服务器可以验证首页、阅读页、skill 选择和原文检索。`/api/chat` 需要 Vercel Serverless 环境或自行配置兼容的本地 API 代理。
````

- [ ] **Step 2: Run all script checks**

Run:

```bash
node scripts/validate-mao-skills.mjs
node scripts/verify-search-index.mjs
node scripts/smoke-retrieval.mjs
node scripts/smoke-api-prompt.mjs
node -e "const fs=require('fs'); const s=fs.readFileSync('script.js','utf8'); if (s.includes('saveIcon.style')) throw new Error('saveIcon reference remains'); console.log('script smoke passed')"
node -e "const fs=require('fs'); const s=fs.readFileSync('reading.html','utf8'); if (!s.includes('sourceBanner')) throw new Error('reader banner missing'); console.log('reader smoke passed')"
```

Expected: every command exits 0.

- [ ] **Step 3: Run local static server**

Run:

```bash
python3 -m http.server 8080
```

Expected: server starts and prints a local URL. In the Codex sandbox, port binding may require running the same command with escalated permissions.

- [ ] **Step 4: Manually verify URLs**

Open:

```text
http://127.0.0.1:8080/
http://127.0.0.1:8080/chat.html?prompt=%E6%88%91%E6%9C%80%E8%BF%91%E5%BE%88%E7%84%A6%E8%99%91
http://127.0.0.1:8080/reading.html#016-%E5%AE%9E%E8%B7%B5%E8%AE%BA.md?source=%E5%AE%9E%E8%B7%B5%E8%AE%BA
```

Expected:

- Homepage card flips without console error and reveals CTAs.
- Chat page pre-fills prompt, loads skill chips/source citations after send.
- Reader loads `实践论` and shows the source banner.

- [ ] **Step 5: Commit docs and final fixes**

Run:

```bash
git add README.md
git commit -m "docs: document skill-first maoxuan mvp"
```

- [ ] **Step 6: Final status**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: working tree clean. Recent commits show task-by-task implementation.
