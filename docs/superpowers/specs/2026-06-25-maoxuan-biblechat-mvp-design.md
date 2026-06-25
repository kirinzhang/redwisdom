# Maoxuan BibleChat MVP Design

## Summary

Build Red Wisdom into a Mao Selected Works and Mao Zedong Thought version of BibleChat. The MVP keeps the current Red Wisdom visual language: china red, warm rice paper, Mao Selected Works atmosphere, card ritual, and serif/calligraphic typography. The product structure becomes BibleChat-like: ask about real life problems, receive grounded counsel with cited source passages, read the original works, and return daily through a lightweight companion hook.

The first version prioritizes citation trust over breadth. Answers should retrieve relevant local source passages from the existing Mao Selected Works Markdown corpus before calling the AI model. The AI response should be framed as method-based counsel, psychological comfort, and practical action, with visible citations and links back to the original text.

## Goals

- Help users bring real anxieties, decisions, work, study, relationship, and self-discipline problems to a Mao Selected Works style advisor.
- Ground answers in local Mao Selected Works source passages instead of relying only on model memory.
- Preserve a clear path from answer to source: every answer shows cited excerpts and can open the relevant original article.
- Keep the daily card/daily prompt as a fun retention hook that feeds into asking and reading.
- Ship as a full MVP inside the existing static/Vercel-style codebase without adding accounts, payments, cloud sync, or a heavy framework.

## Non-Goals

- No user login, personal cloud history, or multi-device sync in this MVP.
- No fine-tuned model or external vector database.
- No claim that the assistant is an authoritative political, medical, legal, or clinical mental health advisor.
- No full learning-plan system beyond a simple daily prompt/card entry point.
- No redesign into BibleChat's visual identity; BibleChat is a structural reference only.

## Product Structure

### 1. Ask: Reality Counsel

The primary screen becomes a more purposeful "问道毛选" experience. Users can describe a real problem in natural language. The answer format should be consistent:

1. **先稳住**: a short comforting reframe that acknowledges the user's concern.
2. **抓主要矛盾**: identify the central tension or decision point.
3. **从原文看**: cite two or three retrieved Mao Selected Works passages with article titles.
4. **怎么做**: give concrete next actions for the next day or week.
5. **回到实践**: end with a small experiment or reflection question.

The assistant should avoid pretending certainty when retrieved context is weak. If the local search finds little relevant material, the answer should say it is using broad method references and invite the user to provide more detail.

### 2. Read: Original Text And Source Tracing

The existing reading page remains the source library. It should support links from AI citations:

- `reading.html#<encoded filename>` opens the article.
- Citation cards in chat show article title, short excerpt, and an "读原文" action.
- The MVP links to the article level only. Exact paragraph highlighting is deferred to a later extension.

The reader should continue to support catalog navigation and previous/next article navigation.

### 3. Daily Companion

The current card ritual becomes the daily hook rather than the whole product:

- Homepage shows a "今日一问" or "今日方法" card.
- Users can draw a card, then choose "带着这个问题去问道" or "读相关原文".
- Daily prompts should connect to common problems: anxiety, action paralysis, criticism, discipline, work pressure, learning, and relationships.
- The hook should feel playful and ceremonial, but it should funnel into the grounded chat and source reading.

## Recommended MVP Approach

Use a local lexical retrieval pipeline before the AI call:

1. Build a client-side or server-side source index from the existing `data/catalog.json` and `data/articles/*.md`.
2. Split articles into paragraph-sized chunks with metadata:
   - article title
   - filename
   - volume name
   - chunk text
   - rough paragraph index
3. Search chunks using simple Chinese-friendly lexical scoring:
   - tokenize by Chinese character bigrams and meaningful ASCII words
   - boost exact query terms
   - boost article titles and known method keywords such as `矛盾`, `实践`, `调查`, `群众`, `路线`, `主要`, `次要`, `困难`, `批评`, `学习`, `工作`
4. Send the top 4-6 chunks to `/api/chat` with the user's question.
5. The server calls OpenRouter with a system prompt that requires answering only from the provided context plus general method synthesis.
6. Return the streamed answer plus citation metadata to the browser.

For speed and reliability, pre-generate a compact JSON index during development if the browser fetching all Markdown files is too slow. A generated `data/search-index.json` is acceptable for the MVP because the source corpus is static.

## Architecture

### Existing Files To Preserve

- `index.html`: homepage and card ritual.
- `chat.html`: chat UI, to be upgraded into the main counsel interface.
- `reading.html`: source reader, to remain the original text library.
- `api/chat.js`: Vercel serverless proxy for OpenRouter.
- `data/catalog.json`: article catalog.
- `data/articles/*.md`: source corpus.
- `data.js` and `data/quotes.json`: quote/card data.
- `assets/*` and `style.css`: current visual system.

### New Or Changed Modules

- `data/search-index.json`: generated source chunks for retrieval.
- `scripts/build-search-index.mjs`: builds `search-index.json` from catalog and Markdown files.
- `retrieval.js`: browser-side retrieval utilities if retrieval runs in the client.
- `chat.html`: upgraded layout, answer rendering, citation cards, daily prompt shortcuts.
- `api/chat.js`: accepts `{ message, history, contextChunks }`, injects retrieved context into the OpenRouter prompt, and streams the response.
- `index.html` and `script.js`: make the card flow feed into chat and fix the existing `saveIcon` runtime error.

The simplest MVP can run retrieval in the browser to avoid server filesystem assumptions on Vercel. The browser loads `data/search-index.json`, ranks chunks locally, sends only top chunks to `/api/chat`, and renders the same citation cards it sent. This keeps server code small and transparent.

## Data Flow

### Chat Query

1. User enters a problem on `chat.html`.
2. Browser loads `data/search-index.json` once and caches it in memory.
3. Browser ranks chunks for the user message.
4. Browser displays a "正在查找原文" state and then shows selected source cards.
5. Browser POSTs to `/api/chat` with:
   - user message
   - conversation history
   - selected source chunks and metadata
6. Server injects a strict context-first prompt and calls OpenRouter.
7. Browser streams the answer and keeps citation cards attached to the response.
8. User can click "读原文" on any citation card.

### Daily Card To Chat

1. User draws a card on `index.html`.
2. The card reveals a quote or method prompt.
3. User chooses a CTA:
   - "带着这个问题去问道" opens `chat.html?prompt=<encoded prompt>`.
   - "读相关原文" opens `reading.html#<filename>` when a source is known.
4. Chat pre-fills the prompt and lets the user press send, so the transition feels intentional instead of surprising.

## Prompting Requirements

The AI system prompt should make the assistant:

- speak in a warm, steady, method-oriented tone;
- call the user "同志" sparingly, not mechanically in every paragraph;
- use Mao Selected Works concepts such as contradiction analysis, practice, investigation, mass line, and seeking truth from facts;
- ground claims in the supplied source excerpts;
- separate source citation from interpretation;
- avoid fabricating article titles, dates, or direct quotes;
- recommend practical next actions;
- include a safety line for severe distress: encourage contacting trusted people or professional help when the user indicates self-harm, danger, or crisis.

The response should not impersonate Mao as if he is personally speaking. It should be "using Mao Selected Works methods" rather than roleplaying Mao as a living advisor.

## UI Design

### Visual Language

Keep the current palette and material:

- china red for primary actions and emphasis;
- warm rice paper background;
- dark ink text;
- subtle paper/card texture from existing assets;
- Mao portrait art where already used;
- restrained calligraphy for display labels, readable serif for body text.

Avoid making the app feel like a generic SaaS dashboard. It should feel like a reading room plus counsel desk: calm, serious, warm, and ritualized.

### Chat Screen

The chat screen should include:

- top navigation back to home and reading;
- a compact intro panel explaining that answers are based on retrieved original text;
- prompt chips for common use cases, such as:
  - "我最近很焦虑"
  - "工作推进不下去"
  - "被批评后很受挫"
  - "如何开始行动"
- streaming answer area;
- citation cards under each assistant answer;
- clear error states when API key is missing, retrieval fails, or model call fails.

### Homepage

The homepage should still open with the card ritual, but after reveal it should offer:

- "问问这件事"
- "读相关原文"
- "再抽一次"

The old save-card code should either be fully restored or removed. For MVP, remove broken save references unless explicitly restoring image saving.

### Reader

The reader should support existing catalog browsing and direct article links from citation cards. If there is time, show a small banner when opened from chat: "来自问道引用：<article title>".

## Error Handling

- If `search-index.json` cannot load, show a non-blocking warning and allow direct AI chat only if configured.
- If retrieval returns weak matches, label the citations as "相关参考" and ask for more detail.
- If `/api/chat` returns missing API key, show an actionable setup message.
- If OpenRouter fails mid-stream, preserve the user's message and selected citations so retry is possible.
- If the user message suggests self-harm or immediate danger, answer with supportive language and encourage immediate real-world help before any ideological analysis.

## Testing And Verification

Manual verification for MVP:

- `python3 -m http.server 8080` serves static pages.
- `index.html` card flow does not throw `saveIcon` errors.
- `chat.html` loads `search-index.json`, retrieves source cards, and sends the top chunks to `/api/chat`.
- Chat answers show streamed markdown and citation cards.
- Citation "读原文" opens the expected article in `reading.html`.
- `reading.html#016-实践论.md`, `reading.html#017-矛盾论.md`, and `reading.html#026-论持久战.md` load correctly.
- Missing API key produces a clear error.
- Mobile widths keep navigation, input, and cards usable without overlapping text.

Automated checks where practical:

- Run the index builder and assert it creates chunks for all catalog articles.
- Validate every generated citation filename exists in `data/articles`.
- Run a simple retrieval smoke test for queries like `焦虑`, `行动`, `批评`, `调查研究`, `主要矛盾`.

## MVP Acceptance Criteria

- A user can ask a real problem and receive a grounded answer with at least two source cards when relevant passages are found.
- Every source card has article title, excerpt, and a working "读原文" link.
- The daily card experience leads naturally into chat or reading.
- The app keeps the Red Wisdom visual identity.
- The broken homepage flip flow is fixed.
- README/deployment language is updated enough that local and Vercel usage are not misleading.

## Later Extensions

- User accounts, saved history, favorites, and notes.
- Highlight exact cited paragraphs in the reader.
- Better retrieval with embeddings or a local vector index.
- Topic courses: contradiction, practice, investigation, mass line, criticism, discipline.
- Daily streaks and personalized practice plans.
- A stricter source QA layer that rejects unsupported generated citations.
