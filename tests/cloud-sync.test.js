const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildExportPayload,
    mapConversationToCloudRows,
    mapHighlightToCloudRow,
    mapPracticeToCloudRow,
    mapCloudRowsToConversations,
    mapCloudRowToProblemCase,
    mapProblemCaseToCloudRow,
    mapSavedAnswerToCloudRow,
    mapSavedQuoteToCloudRow,
    mapReadingNoteToCloudRow,
    mapReadingProgressToCloudRow,
    mergeArchives,
    mergeCloudPractices,
    pullArchiveFromSupabase,
    pushArchiveToSupabase,
    saveArchiveToLocalStorage,
    summarizeArchive,
} = require('../js/cloud-sync.js');

test('mapPracticeToCloudRow converts local practice into Supabase row shape', () => {
    const row = mapPracticeToCloudRow('user-1', {
        id: 'practice-1',
        title: '用实践论处理拖延',
        realProblem: '我拖延写方案。',
        sourceType: 'quote',
        sourceTitle: '实践论',
        methodologyTags: ['实践检验'],
        actionPlan: '今天写第一段。',
        status: 'reviewed',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
    });

    assert.equal(row.user_id, 'user-1');
    assert.equal(row.local_id, 'practice-1');
    assert.equal(row.real_problem, '我拖延写方案。');
    assert.deepEqual(row.methodology_tags, ['实践检验']);
    assert.equal(row.created_at, '2026-06-29T00:00:00.000Z');
});

test('mergeCloudPractices keeps newest version by local id', () => {
    const merged = mergeCloudPractices([
        {
            id: 'practice-1',
            title: '旧',
            updatedAt: '2026-06-29T00:00:00.000Z',
        },
    ], [
        {
            local_id: 'practice-1',
            title: '新',
            updated_at: '2026-06-29T01:00:00.000Z',
        },
    ]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, '新');
    assert.equal(merged[0].id, 'practice-1');
});

test('buildExportPayload includes practices and metadata for account migration', () => {
    const payload = buildExportPayload({
        profile: { email: 'reader@example.com' },
        problemCases: [{ id: 'problem-1', title: '问题一' }],
        practices: [{ id: 'practice-1', title: '实践一' }],
        conversations: [{ id: 'conversation-1', title: '问答一' }],
        readingNotes: [{ id: 'note-1', articleTitle: '实践论' }],
        readingProgress: [{ articleId: '016-实践论.md', progressPercent: 55 }],
        highlights: [{ id: 'highlight-1', selectedText: '没有调查，没有发言权。' }],
        savedQuotes: [{ id: 'quote-1', content: '没有调查就没有发言权。' }],
        savedAnswers: [{ id: 'answer-1', assistantMessage: '先调查事实。' }],
    }, () => '2026-06-29T00:00:00.000Z');

    assert.equal(payload.exportedAt, '2026-06-29T00:00:00.000Z');
    assert.equal(payload.version, 2);
    assert.equal(payload.profile.email, 'reader@example.com');
    assert.equal(payload.problemCases[0].title, '问题一');
    assert.equal(payload.practices[0].title, '实践一');
    assert.equal(payload.conversations[0].title, '问答一');
    assert.equal(payload.readingNotes[0].articleTitle, '实践论');
    assert.equal(payload.readingProgress[0].progressPercent, 55);
    assert.equal(payload.highlights[0].selectedText, '没有调查，没有发言权。');
    assert.equal(payload.savedQuotes[0].content, '没有调查就没有发言权。');
    assert.equal(payload.savedAnswers[0].assistantMessage, '先调查事实。');
});

test('summarizeArchive counts the full learning archive for account UI', () => {
    const summary = summarizeArchive({
        problemCases: [{ id: 'problem-1' }],
        practices: [{ id: 'practice-1' }],
        conversations: [{
            id: 'conversation-1',
            messages: [
                { role: 'user', content: '问题' },
                { role: 'assistant', content: '回答' },
            ],
        }],
        readingNotes: [{ id: 'note-1' }],
        readingProgress: [
            { id: 'progress-1', bookmarked: true },
            { id: 'progress-2', bookmarked: false },
        ],
        highlights: [{ id: 'highlight-1' }],
        savedQuotes: [{ id: 'quote-1' }],
        savedAnswers: [{ id: 'answer-1' }],
    });

    assert.deepEqual(summary.counts, {
        problemCases: 1,
        practices: 1,
        conversations: 1,
        messages: 2,
        readingNotes: 1,
        readingProgress: 2,
        bookmarkedArticles: 1,
        highlights: 1,
        savedQuotes: 1,
        savedAnswers: 1,
    });
    assert.equal(summary.totalRecords, 9);
    assert.equal(summary.hasRecords, true);
    assert.equal(summary.statusText, '问题 1 · 实践 1 · 问答 1 · 消息 2 · 笔记 1 · 阅读 2 · 摘录 1 · 语录 1 · 回答 1');
});

test('problem case mapper preserves analysis fields and activities', () => {
    const row = mapProblemCaseToCloudRow('user-1', {
        id: 'problem-1', title: '是否换工作', facts: '收入没变', stage: 'investigate',
        activities: [{ id: 'activity-1', type: 'reading' }], createdAt: '2026-06-29T00:00:00.000Z', updatedAt: '2026-06-29T01:00:00.000Z',
    });
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.stage, 'investigate');
    assert.equal(mapCloudRowToProblemCase(row).activities[0].type, 'reading');
});

test('mapConversationToCloudRows splits conversation summary and messages for Supabase', () => {
    const rows = mapConversationToCloudRows('user-1', {
        id: 'conversation-1',
        title: '如何处理拖延',
        source: 'chat',
        methodologyTags: ['实践检验'],
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
        messages: [
            { role: 'user', content: '我拖延。', createdAt: '2026-06-29T00:00:00.000Z' },
            { role: 'assistant', content: '先调查事实。', createdAt: '2026-06-29T00:01:00.000Z' },
        ],
    });

    assert.equal(rows.conversation.user_id, 'user-1');
    assert.equal(rows.conversation.local_id, 'conversation-1');
    assert.deepEqual(rows.conversation.methodology_tags, ['实践检验']);
    assert.equal(rows.messages.length, 2);
    assert.equal(rows.messages[0].conversation_local_id, 'conversation-1');
    assert.equal(rows.messages[1].content, '先调查事实。');
});

test('reading archive mappers convert local records to Supabase row shapes', () => {
    const note = mapReadingNoteToCloudRow('user-1', {
        id: 'note-1',
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        content: '认识来自实践。',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
    });
    const progress = mapReadingProgressToCloudRow('user-1', {
        id: 'progress-1',
        articleId: '016-实践论.md',
        articleTitle: '实践论',
        progressPercent: 55,
        lastPosition: 1200,
        bookmarked: true,
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
    });
    const highlight = mapHighlightToCloudRow('user-1', {
        id: 'highlight-1',
        articleId: '006-反对本本主义.md',
        articleTitle: '反对本本主义',
        selectedText: '没有调查，没有发言权。',
        note: '判断前先调查。',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
    });

    assert.equal(note.article_id, '016-实践论.md');
    assert.equal(note.article_title, '实践论');
    assert.equal(progress.progress_percent, 55);
    assert.equal(progress.bookmarked, true);
    assert.equal(highlight.selected_text, '没有调查，没有发言权。');
});

test('mapSavedQuoteToCloudRow converts saved quotes into Supabase row shape', () => {
    const row = mapSavedQuoteToCloudRow('user-1', {
        id: 'quote-1',
        quoteId: '1',
        content: '没有调查就没有发言权。',
        source: '反对本本主义',
        date: '一九三〇年五月',
        category: '调查研究',
        methodologyTags: ['调查研究', '实事求是'],
        articleTitle: '反对本本主义',
        articleHref: 'reading.html#006.md',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
    });

    assert.equal(row.user_id, 'user-1');
    assert.equal(row.local_id, 'quote-1');
    assert.equal(row.quote_id, '1');
    assert.equal(row.content, '没有调查就没有发言权。');
    assert.deepEqual(row.methodology_tags, ['调查研究', '实事求是']);
    assert.equal(row.article_href, 'reading.html#006.md');
});

test('mapSavedAnswerToCloudRow converts saved AI answers into Supabase row shape', () => {
    const row = mapSavedAnswerToCloudRow('user-1', {
        id: 'answer-1',
        answerId: 'conversation-1-answer-1',
        conversationId: 'conversation-1',
        title: '如何处理拖延',
        userMessage: '我拖延。',
        assistantMessage: '先调查事实，再做一步。',
        methodologyTags: ['调查研究', '实践检验'],
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T01:00:00.000Z',
    });

    assert.equal(row.user_id, 'user-1');
    assert.equal(row.local_id, 'answer-1');
    assert.equal(row.answer_id, 'conversation-1-answer-1');
    assert.equal(row.conversation_local_id, 'conversation-1');
    assert.equal(row.user_message, '我拖延。');
    assert.equal(row.assistant_message, '先调查事实，再做一步。');
    assert.deepEqual(row.methodology_tags, ['调查研究', '实践检验']);
});

test('pushArchiveToSupabase upserts every local archive table and returns per-table counts', async () => {
    const calls = [];
    const client = createMockSupabaseClient(calls);

    const result = await pushArchiveToSupabase(client, 'user-1', {
        problemCases: [{ id: 'problem-1', title: '问题一' }],
        practices: [{ id: 'practice-1', title: '实践一' }],
        conversations: [{
            id: 'conversation-1',
            title: '问答一',
            messages: [{ role: 'user', content: '问题', createdAt: '2026-06-29T00:00:00.000Z' }],
        }],
        readingNotes: [{ id: 'note-1', articleId: '016-实践论.md', articleTitle: '实践论', content: '笔记' }],
        readingProgress: [{ id: 'progress-1', articleId: '016-实践论.md', articleTitle: '实践论', progressPercent: 50 }],
        highlights: [{ id: 'highlight-1', articleId: '016-实践论.md', articleTitle: '实践论', selectedText: '摘录' }],
        savedQuotes: [{ id: 'quote-1', quoteId: '1', content: '没有调查就没有发言权。', source: '反对本本主义' }],
        savedAnswers: [{ id: 'answer-1', answerId: 'answer-1', assistantMessage: '先调查。' }],
    });

    assert.deepEqual(result, {
        problemCases: 1,
        practices: 1,
        conversations: 1,
        messages: 1,
        readingNotes: 1,
        readingProgress: 1,
        highlights: 1,
        savedQuotes: 1,
        savedAnswers: 1,
    });
    assert.deepEqual(calls.map(call => call.table), [
        'problem_cases',
        'practices',
        'conversations',
        'messages',
        'reading_notes',
        'reading_progress',
        'highlights',
        'saved_quotes',
        'saved_answers',
    ]);
    assert.equal(calls[3].rows[0].conversation_local_id, 'conversation-1');
});

test('mapCloudRowsToConversations reconstructs local conversations with ordered messages', () => {
    const conversations = mapCloudRowsToConversations([
        {
            local_id: 'conversation-1',
            title: '如何处理拖延',
            source: 'chat',
            methodology_tags: ['实践检验'],
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        },
    ], [
        {
            conversation_local_id: 'conversation-1',
            role: 'assistant',
            content: '先调查事实。',
            created_at: '2026-06-29T00:02:00.000Z',
        },
        {
            conversation_local_id: 'conversation-1',
            role: 'user',
            content: '我拖延。',
            created_at: '2026-06-29T00:01:00.000Z',
        },
    ]);

    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].id, 'conversation-1');
    assert.deepEqual(conversations[0].methodologyTags, ['实践检验']);
    assert.deepEqual(conversations[0].messages.map(message => message.role), ['user', 'assistant']);
    assert.equal(conversations[0].messages[1].content, '先调查事实。');
});

test('mergeArchives keeps the newest local or cloud record for every archive type', () => {
    const merged = mergeArchives({
        problemCases: [{ id: 'problem-1', title: '本机问题', updatedAt: '2026-06-29T02:00:00.000Z' }],
        practices: [{ id: 'practice-1', title: '本机旧实践', updatedAt: '2026-06-29T00:00:00.000Z' }],
        conversations: [{ id: 'conversation-1', title: '本机新问答', messages: [], updatedAt: '2026-06-29T03:00:00.000Z' }],
        readingNotes: [{ id: 'note-local', articleId: '016-实践论.md', content: '本机旧笔记', updatedAt: '2026-06-29T00:00:00.000Z' }],
        readingProgress: [{ id: 'progress-local', articleId: '017-矛盾论.md', progressPercent: 20, updatedAt: '2026-06-29T02:00:00.000Z' }],
        highlights: [{ id: 'highlight-local', selectedText: '本机摘录', updatedAt: '2026-06-29T00:00:00.000Z' }],
        savedQuotes: [{ id: 'quote-local', quoteId: '1', content: '本机旧收藏', updatedAt: '2026-06-29T00:00:00.000Z' }],
        savedAnswers: [{ id: 'answer-local', answerId: 'answer-1', assistantMessage: '本机旧回答', updatedAt: '2026-06-29T00:00:00.000Z' }],
    }, {
        problemCases: [{ id: 'problem-1', title: '云端问题', updatedAt: '2026-06-29T01:00:00.000Z' }],
        practices: [{ id: 'practice-1', title: '云端新实践', updatedAt: '2026-06-29T01:00:00.000Z' }],
        conversations: [{ id: 'conversation-1', title: '云端旧问答', messages: [], updatedAt: '2026-06-29T01:00:00.000Z' }],
        readingNotes: [{ id: 'note-cloud', articleId: '016-实践论.md', content: '云端新笔记', updatedAt: '2026-06-29T01:00:00.000Z' }],
        readingProgress: [{ id: 'progress-cloud', articleId: '017-矛盾论.md', progressPercent: 80, updatedAt: '2026-06-29T01:00:00.000Z' }],
        highlights: [{ id: 'highlight-cloud', selectedText: '云端摘录', updatedAt: '2026-06-29T01:00:00.000Z' }],
        savedQuotes: [{ id: 'quote-cloud', quoteId: '1', content: '云端新收藏', updatedAt: '2026-06-29T01:00:00.000Z' }],
        savedAnswers: [{ id: 'answer-cloud', answerId: 'answer-1', assistantMessage: '云端新回答', updatedAt: '2026-06-29T01:00:00.000Z' }],
    });

    assert.equal(merged.problemCases[0].title, '本机问题');
    assert.equal(merged.practices[0].title, '云端新实践');
    assert.equal(merged.conversations[0].title, '本机新问答');
    assert.equal(merged.readingNotes[0].content, '云端新笔记');
    assert.equal(merged.readingProgress[0].progressPercent, 20);
    assert.deepEqual(merged.highlights.map(highlight => highlight.id), ['highlight-cloud', 'highlight-local']);
    assert.equal(merged.savedQuotes[0].content, '云端新收藏');
    assert.equal(merged.savedAnswers[0].assistantMessage, '云端新回答');
});

test('pullArchiveFromSupabase fetches and maps every cloud archive table', async () => {
    const calls = [];
    const client = createMockSelectClient(calls, {
        problem_cases: [{
            local_id: 'problem-1', title: '云端问题', stage: 'analyze', status: 'active', activities: [],
            created_at: '2026-06-29T00:00:00.000Z', updated_at: '2026-06-29T01:00:00.000Z',
        }],
        practices: [{
            local_id: 'practice-1',
            title: '云端实践',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
        conversations: [{
            local_id: 'conversation-1',
            title: '云端问答',
            source: 'chat',
            methodology_tags: ['矛盾分析'],
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
        messages: [{
            conversation_local_id: 'conversation-1',
            role: 'user',
            content: '问题',
            created_at: '2026-06-29T00:01:00.000Z',
        }],
        reading_notes: [{
            local_id: 'note-1',
            article_id: '016-实践论.md',
            article_title: '实践论',
            content: '云端笔记',
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
        reading_progress: [{
            local_id: 'progress-1',
            article_id: '017-矛盾论.md',
            article_title: '矛盾论',
            progress_percent: 66,
            last_position: 900,
            bookmarked: true,
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
        highlights: [{
            local_id: 'highlight-1',
            article_id: '006-反对本本主义.md',
            article_title: '反对本本主义',
            selected_text: '没有调查，没有发言权。',
            note: '先调查',
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
        saved_quotes: [{
            local_id: 'quote-1',
            quote_id: '1',
            content: '没有调查就没有发言权。',
            source: '反对本本主义',
            date: '一九三〇年五月',
            category: '调查研究',
            methodology_tags: ['调查研究'],
            article_title: '反对本本主义',
            article_href: 'reading.html#006.md',
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
        saved_answers: [{
            local_id: 'answer-1',
            answer_id: 'conversation-1-answer-1',
            conversation_local_id: 'conversation-1',
            title: '云端收藏回答',
            user_message: '问题',
            assistant_message: '先调查。',
            methodology_tags: ['调查研究'],
            created_at: '2026-06-29T00:00:00.000Z',
            updated_at: '2026-06-29T01:00:00.000Z',
        }],
    });

    const archive = await pullArchiveFromSupabase(client, 'user-1');

    assert.deepEqual(calls.map(call => call.table), [
        'problem_cases',
        'practices',
        'conversations',
        'messages',
        'reading_notes',
        'reading_progress',
        'highlights',
        'saved_quotes',
        'saved_answers',
    ]);
    assert.equal(archive.problemCases[0].stage, 'analyze');
    assert.equal(archive.practices[0].id, 'practice-1');
    assert.equal(archive.conversations[0].messages[0].content, '问题');
    assert.equal(archive.readingNotes[0].articleId, '016-实践论.md');
    assert.equal(archive.readingProgress[0].bookmarked, true);
    assert.equal(archive.highlights[0].selectedText, '没有调查，没有发言权。');
    assert.equal(archive.savedQuotes[0].quoteId, '1');
    assert.equal(archive.savedAnswers[0].assistantMessage, '先调查。');
});

test('saveArchiveToLocalStorage writes merged archive arrays to local storage keys', () => {
    const storage = createMemoryStorage();
    const counts = saveArchiveToLocalStorage(storage, {
        problemCases: [{ id: 'problem-1', title: '问题一' }],
        practices: [{ id: 'practice-1', title: '实践一' }],
        conversations: [{ id: 'conversation-1', title: '问答一', messages: [] }],
        readingNotes: [{ id: 'note-1', articleId: '016-实践论.md', content: '笔记' }],
        readingProgress: [{ id: 'progress-1', articleId: '016-实践论.md', progressPercent: 30 }],
        highlights: [{ id: 'highlight-1', articleId: '016-实践论.md', selectedText: '摘录' }],
        savedQuotes: [{ id: 'quote-1', quoteId: '1', content: '收藏' }],
        savedAnswers: [{ id: 'answer-1', answerId: 'answer-1', assistantMessage: '收藏回答' }],
    });

    assert.deepEqual(counts, {
        problemCases: 1,
        practices: 1,
        conversations: 1,
        readingNotes: 1,
        readingProgress: 1,
        highlights: 1,
        savedQuotes: 1,
        savedAnswers: 1,
    });
    assert.equal(JSON.parse(storage.getItem('redwisdom.problemCases.v1'))[0].title, '问题一');
    assert.equal(JSON.parse(storage.getItem('redwisdom.practices.v1'))[0].title, '实践一');
    assert.equal(JSON.parse(storage.getItem('redwisdom.conversations.v1'))[0].title, '问答一');
    assert.equal(JSON.parse(storage.getItem('redwisdom.readingNotes.v1'))[0].content, '笔记');
    assert.equal(JSON.parse(storage.getItem('redwisdom.readingProgress.v1'))[0].progressPercent, 30);
    assert.equal(JSON.parse(storage.getItem('redwisdom.highlights.v1'))[0].selectedText, '摘录');
    assert.equal(JSON.parse(storage.getItem('redwisdom.savedQuotes.v1'))[0].content, '收藏');
    assert.equal(JSON.parse(storage.getItem('redwisdom.savedAnswers.v1'))[0].assistantMessage, '收藏回答');
});

function createMockSupabaseClient(calls) {
    return {
        from(table) {
            return {
                upsert(rows, options) {
                    calls.push({ table, rows, options });
                    return Promise.resolve({ error: null });
                },
            };
        },
    };
}

function createMockSelectClient(calls, rowsByTable) {
    return {
        from(table) {
            const query = {
                select(columns) {
                    calls.push({ table, columns });
                    return query;
                },
                eq(column, value) {
                    calls[calls.length - 1].eq = { column, value };
                    return query;
                },
                order(column, options) {
                    calls[calls.length - 1].order = { column, options };
                    return Promise.resolve({ data: rowsByTable[table] || [], error: null });
                },
            };

            return query;
        },
    };
}

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}
