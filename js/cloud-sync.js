(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomCloudSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const LOCAL_ARCHIVE_STORAGE_KEYS = {
        problemCases: 'redwisdom.problemCases.v1',
        practices: 'redwisdom.practices.v1',
        conversations: 'redwisdom.conversations.v1',
        readingNotes: 'redwisdom.readingNotes.v1',
        readingProgress: 'redwisdom.readingProgress.v1',
        highlights: 'redwisdom.highlights.v1',
        savedQuotes: 'redwisdom.savedQuotes.v1',
        savedAnswers: 'redwisdom.savedAnswers.v1',
    };

    function mapProblemCaseToCloudRow(userId, problemCase) {
        return {
            user_id: userId,
            local_id: problemCase.id,
            title: problemCase.title || '',
            real_problem: problemCase.realProblem || '',
            goal: problemCase.goal || '',
            facts: problemCase.facts || '',
            judgments: problemCase.judgments || '',
            emotions: problemCase.emotions || '',
            main_contradiction: problemCase.mainContradiction || '',
            investigation_tasks: problemCase.investigationTasks || [],
            available_forces: problemCase.availableForces || '',
            next_action: problemCase.nextAction || '',
            methodology_tags: problemCase.methodologyTags || [],
            stage: problemCase.stage || 'define',
            status: problemCase.status || 'active',
            activities: problemCase.activities || [],
            created_at: problemCase.createdAt,
            updated_at: problemCase.updatedAt,
        };
    }

    function mapCloudRowToProblemCase(row) {
        return {
            id: row.local_id,
            title: row.title || '',
            realProblem: row.real_problem || '',
            goal: row.goal || '',
            facts: row.facts || '',
            judgments: row.judgments || '',
            emotions: row.emotions || '',
            mainContradiction: row.main_contradiction || '',
            investigationTasks: row.investigation_tasks || [],
            availableForces: row.available_forces || '',
            nextAction: row.next_action || '',
            methodologyTags: row.methodology_tags || [],
            stage: row.stage || 'define',
            status: row.status || 'active',
            activities: row.activities || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function mapPracticeToCloudRow(userId, practice) {
        return {
            user_id: userId,
            local_id: practice.id,
            problem_case_id: practice.problemCaseId || '',
            title: practice.title || '',
            real_problem: practice.realProblem || '',
            source_type: practice.sourceType || 'manual',
            source_title: practice.sourceTitle || '',
            source_href: practice.sourceHref || '',
            related_quote: practice.relatedQuote || '',
            methodology_tags: practice.methodologyTags || [],
            main_contradiction: practice.mainContradiction || '',
            investigation_todo: practice.investigationTodo || '',
            available_forces: practice.availableForces || '',
            action_plan: practice.actionPlan || '',
            expected_result: practice.expectedResult || '',
            actual_result: practice.actualResult || '',
            reflection: practice.reflection || '',
            next_action: practice.nextAction || '',
            status: practice.status || 'draft',
            due_date: practice.dueDate || null,
            created_at: practice.createdAt,
            updated_at: practice.updatedAt,
        };
    }

    function mapCloudRowToPractice(row) {
        return {
            id: row.local_id,
            problemCaseId: row.problem_case_id || '',
            title: row.title || '',
            realProblem: row.real_problem || '',
            sourceType: row.source_type || 'manual',
            sourceTitle: row.source_title || '',
            sourceHref: row.source_href || '',
            relatedQuote: row.related_quote || '',
            methodologyTags: row.methodology_tags || [],
            mainContradiction: row.main_contradiction || '',
            investigationTodo: row.investigation_todo || '',
            availableForces: row.available_forces || '',
            actionPlan: row.action_plan || '',
            expectedResult: row.expected_result || '',
            actualResult: row.actual_result || '',
            reflection: row.reflection || '',
            nextAction: row.next_action || '',
            status: row.status || 'draft',
            dueDate: row.due_date || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function mapCloudRowToMessage(row) {
        return {
            role: ['user', 'assistant', 'system'].includes(row.role) ? row.role : 'user',
            content: row.content || '',
            createdAt: row.created_at,
        };
    }

    function mapCloudRowsToConversations(conversationRows, messageRows) {
        const messagesByConversation = new Map();

        (messageRows || []).forEach((row) => {
            const conversationLocalId = row.conversation_local_id;
            if (!conversationLocalId) return;

            const messages = messagesByConversation.get(conversationLocalId) || [];
            messages.push(mapCloudRowToMessage(row));
            messagesByConversation.set(conversationLocalId, messages);
        });

        return (conversationRows || []).map((row) => ({
            id: row.local_id,
            problemCaseId: row.problem_case_id || '',
            title: row.title || '',
            source: row.source || 'chat',
            methodologyTags: row.methodology_tags || [],
            messages: (messagesByConversation.get(row.local_id) || [])
                .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0)),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })).sort(sortByUpdatedAtDesc);
    }

    function mergeCloudPractices(localPractices, cloudRows) {
        const merged = new Map();

        localPractices.forEach((practice) => {
            merged.set(practice.id, practice);
        });

        cloudRows.forEach((row) => {
            const practice = mapCloudRowToPractice(row);
            const existing = merged.get(practice.id);

            if (!existing || Date.parse(practice.updatedAt || 0) > Date.parse(existing.updatedAt || 0)) {
                merged.set(practice.id, practice);
            }
        });

        return [...merged.values()].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function mapConversationToCloudRows(userId, conversation) {
        return {
            conversation: {
                user_id: userId,
                local_id: conversation.id,
                problem_case_id: conversation.problemCaseId || '',
                title: conversation.title || '',
                source: conversation.source || 'chat',
                methodology_tags: conversation.methodologyTags || [],
                created_at: conversation.createdAt,
                updated_at: conversation.updatedAt,
            },
            messages: (conversation.messages || []).map((message, index) => ({
                user_id: userId,
                conversation_local_id: conversation.id,
                local_id: `${conversation.id}-message-${index}`,
                role: message.role || 'user',
                content: message.content || '',
                created_at: message.createdAt || conversation.createdAt,
            })),
        };
    }

    function mapReadingNoteToCloudRow(userId, note) {
        return {
            user_id: userId,
            local_id: note.id,
            problem_case_id: note.problemCaseId || '',
            article_id: note.articleId,
            article_title: note.articleTitle || '',
            content: note.content || '',
            created_at: note.createdAt,
            updated_at: note.updatedAt,
        };
    }

    function mapCloudRowToReadingNote(row) {
        return {
            id: row.local_id,
            problemCaseId: row.problem_case_id || '',
            articleId: row.article_id,
            articleTitle: row.article_title || '',
            content: row.content || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function mapReadingProgressToCloudRow(userId, progress) {
        return {
            user_id: userId,
            local_id: progress.id,
            article_id: progress.articleId,
            article_title: progress.articleTitle || '',
            progress_percent: progress.progressPercent || 0,
            last_position: progress.lastPosition || 0,
            bookmarked: !!progress.bookmarked,
            created_at: progress.createdAt,
            updated_at: progress.updatedAt,
        };
    }

    function mapCloudRowToReadingProgress(row) {
        return {
            id: row.local_id,
            articleId: row.article_id,
            articleTitle: row.article_title || '',
            progressPercent: row.progress_percent || 0,
            lastPosition: row.last_position || 0,
            bookmarked: !!row.bookmarked,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function mapHighlightToCloudRow(userId, highlight) {
        return {
            user_id: userId,
            local_id: highlight.id,
            article_id: highlight.articleId,
            article_title: highlight.articleTitle || '',
            selected_text: highlight.selectedText || '',
            note: highlight.note || '',
            created_at: highlight.createdAt,
            updated_at: highlight.updatedAt,
        };
    }

    function mapCloudRowToHighlight(row) {
        return {
            id: row.local_id,
            articleId: row.article_id,
            articleTitle: row.article_title || '',
            selectedText: row.selected_text || '',
            note: row.note || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function mapSavedQuoteToCloudRow(userId, savedQuote) {
        return {
            user_id: userId,
            local_id: savedQuote.id,
            quote_id: savedQuote.quoteId || '',
            content: savedQuote.content || '',
            source: savedQuote.source || '',
            date: savedQuote.date || '',
            category: savedQuote.category || '',
            methodology_tags: savedQuote.methodologyTags || [],
            article_title: savedQuote.articleTitle || '',
            article_href: savedQuote.articleHref || '',
            created_at: savedQuote.createdAt,
            updated_at: savedQuote.updatedAt,
        };
    }

    function mapCloudRowToSavedQuote(row) {
        return {
            id: row.local_id,
            quoteId: row.quote_id || '',
            content: row.content || '',
            source: row.source || '',
            date: row.date || '',
            category: row.category || '',
            methodologyTags: row.methodology_tags || [],
            articleTitle: row.article_title || '',
            articleHref: row.article_href || 'reading.html',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function mapSavedAnswerToCloudRow(userId, savedAnswer) {
        return {
            user_id: userId,
            local_id: savedAnswer.id,
            answer_id: savedAnswer.answerId || '',
            conversation_local_id: savedAnswer.conversationId || '',
            title: savedAnswer.title || '',
            user_message: savedAnswer.userMessage || '',
            assistant_message: savedAnswer.assistantMessage || '',
            methodology_tags: savedAnswer.methodologyTags || [],
            created_at: savedAnswer.createdAt,
            updated_at: savedAnswer.updatedAt,
        };
    }

    function mapCloudRowToSavedAnswer(row) {
        return {
            id: row.local_id,
            answerId: row.answer_id || '',
            conversationId: row.conversation_local_id || '',
            title: row.title || '',
            userMessage: row.user_message || '',
            assistantMessage: row.assistant_message || '',
            methodologyTags: row.methodology_tags || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function buildExportPayload({
        profile,
        problemCases,
        practices,
        conversations,
        readingNotes,
        readingProgress,
        highlights,
        savedQuotes,
        savedAnswers,
    }, now = () => new Date().toISOString()) {
        return {
            version: 2,
            exportedAt: now(),
            profile: profile || null,
            problemCases: problemCases || [],
            practices: practices || [],
            conversations: conversations || [],
            readingNotes: readingNotes || [],
            readingProgress: readingProgress || [],
            highlights: highlights || [],
            savedQuotes: savedQuotes || [],
            savedAnswers: savedAnswers || [],
        };
    }

    function summarizeArchive(archive) {
        const practices = archive?.practices || [];
        const problemCases = archive?.problemCases || [];
        const conversations = archive?.conversations || [];
        const readingNotes = archive?.readingNotes || [];
        const readingProgress = archive?.readingProgress || [];
        const highlights = archive?.highlights || [];
        const savedQuotes = archive?.savedQuotes || [];
        const savedAnswers = archive?.savedAnswers || [];

        const counts = {
            problemCases: problemCases.length,
            practices: practices.length,
            conversations: conversations.length,
            messages: conversations.reduce((total, conversation) => total + (conversation.messages || []).length, 0),
            readingNotes: readingNotes.length,
            readingProgress: readingProgress.length,
            bookmarkedArticles: readingProgress.filter((entry) => entry.bookmarked).length,
            highlights: highlights.length,
            savedQuotes: savedQuotes.length,
            savedAnswers: savedAnswers.length,
        };
        const totalRecords = counts.problemCases
            + counts.practices
            + counts.conversations
            + counts.readingNotes
            + counts.readingProgress
            + counts.highlights
            + counts.savedQuotes
            + counts.savedAnswers;
        const statusText = [
            ['问题', counts.problemCases],
            ['实践', counts.practices],
            ['问答', counts.conversations],
            ['消息', counts.messages],
            ['笔记', counts.readingNotes],
            ['阅读', counts.readingProgress],
            ['摘录', counts.highlights],
            ['语录', counts.savedQuotes],
            ['回答', counts.savedAnswers],
        ].map(([label, count]) => `${label} ${count}`).join(' · ');

        return {
            counts,
            totalRecords,
            hasRecords: totalRecords > 0,
            statusText,
        };
    }

    function mergeArchives(localArchive, cloudArchive) {
        return {
            problemCases: mergeByKey(localArchive?.problemCases, cloudArchive?.problemCases, (problemCase) => problemCase.id),
            practices: mergeByKey(localArchive?.practices, cloudArchive?.practices, (practice) => practice.id),
            conversations: mergeByKey(localArchive?.conversations, cloudArchive?.conversations, (conversation) => conversation.id),
            readingNotes: mergeByKey(localArchive?.readingNotes, cloudArchive?.readingNotes, (note) => note.articleId || note.id),
            readingProgress: mergeByKey(localArchive?.readingProgress, cloudArchive?.readingProgress, (progress) => progress.articleId || progress.id),
            highlights: mergeByKey(localArchive?.highlights, cloudArchive?.highlights, (highlight) => highlight.id),
            savedQuotes: mergeByKey(localArchive?.savedQuotes, cloudArchive?.savedQuotes, (quote) => quote.quoteId || quote.id),
            savedAnswers: mergeByKey(localArchive?.savedAnswers, cloudArchive?.savedAnswers, (answer) => answer.answerId || answer.id),
        };
    }

    function mergeByKey(localRecords, cloudRecords, getKey) {
        const merged = new Map();

        (localRecords || []).forEach((record) => {
            const key = getKey(record);
            if (key) merged.set(key, record);
        });

        (cloudRecords || []).forEach((record) => {
            const key = getKey(record);
            if (!key) return;

            const existing = merged.get(key);
            if (!existing || getRecordTime(record) > getRecordTime(existing)) {
                merged.set(key, record);
            }
        });

        return [...merged.values()].sort(sortByUpdatedAtDesc);
    }

    function saveArchiveToLocalStorage(storage, archive) {
        const normalizedArchive = {
            problemCases: archive?.problemCases || [],
            practices: archive?.practices || [],
            conversations: archive?.conversations || [],
            readingNotes: archive?.readingNotes || [],
            readingProgress: archive?.readingProgress || [],
            highlights: archive?.highlights || [],
            savedQuotes: archive?.savedQuotes || [],
            savedAnswers: archive?.savedAnswers || [],
        };

        Object.entries(LOCAL_ARCHIVE_STORAGE_KEYS).forEach(([key, storageKey]) => {
            storage.setItem(storageKey, JSON.stringify(normalizedArchive[key]));
        });

        return {
            problemCases: normalizedArchive.problemCases.length,
            practices: normalizedArchive.practices.length,
            conversations: normalizedArchive.conversations.length,
            readingNotes: normalizedArchive.readingNotes.length,
            readingProgress: normalizedArchive.readingProgress.length,
            highlights: normalizedArchive.highlights.length,
            savedQuotes: normalizedArchive.savedQuotes.length,
            savedAnswers: normalizedArchive.savedAnswers.length,
        };
    }

    async function pushPracticesToSupabase(client, userId, practices) {
        if (!client || !userId) {
            throw new Error('需要登录后才能同步实践记录');
        }

        const rows = practices.map((practice) => mapPracticeToCloudRow(userId, practice));
        const { error } = await client
            .from('practices')
            .upsert(rows, { onConflict: 'user_id,local_id' });

        if (error) throw error;
        return rows.length;
    }

    async function pushArchiveToSupabase(client, userId, archive) {
        if (!client || !userId) {
            throw new Error('需要登录后才能同步档案记录');
        }

        const counts = {
            problemCases: 0,
            practices: 0,
            conversations: 0,
            messages: 0,
            readingNotes: 0,
            readingProgress: 0,
            highlights: 0,
            savedQuotes: 0,
            savedAnswers: 0,
        };

        counts.problemCases = await upsertRows(
            client,
            'problem_cases',
            (archive.problemCases || []).map((problemCase) => mapProblemCaseToCloudRow(userId, problemCase)),
            { onConflict: 'user_id,local_id' }
        );

        counts.practices = await upsertRows(
            client,
            'practices',
            (archive.practices || []).map((practice) => mapPracticeToCloudRow(userId, practice)),
            { onConflict: 'user_id,local_id' }
        );

        const conversationRows = (archive.conversations || []).map((conversation) => mapConversationToCloudRows(userId, conversation));
        counts.conversations = await upsertRows(
            client,
            'conversations',
            conversationRows.map((rows) => rows.conversation),
            { onConflict: 'user_id,local_id' }
        );

        counts.messages = await upsertRows(
            client,
            'messages',
            conversationRows.flatMap((rows) => rows.messages),
            { onConflict: 'user_id,local_id' }
        );

        counts.readingNotes = await upsertRows(
            client,
            'reading_notes',
            (archive.readingNotes || []).map((note) => mapReadingNoteToCloudRow(userId, note)),
            { onConflict: 'user_id,article_id' }
        );

        counts.readingProgress = await upsertRows(
            client,
            'reading_progress',
            (archive.readingProgress || []).map((progress) => mapReadingProgressToCloudRow(userId, progress)),
            { onConflict: 'user_id,article_id' }
        );

        counts.highlights = await upsertRows(
            client,
            'highlights',
            (archive.highlights || []).map((highlight) => mapHighlightToCloudRow(userId, highlight)),
            { onConflict: 'user_id,local_id' }
        );

        counts.savedQuotes = await upsertRows(
            client,
            'saved_quotes',
            (archive.savedQuotes || []).map((savedQuote) => mapSavedQuoteToCloudRow(userId, savedQuote)),
            { onConflict: 'user_id,quote_id' }
        );

        counts.savedAnswers = await upsertRows(
            client,
            'saved_answers',
            (archive.savedAnswers || []).map((savedAnswer) => mapSavedAnswerToCloudRow(userId, savedAnswer)),
            { onConflict: 'user_id,answer_id' }
        );

        return counts;
    }

    async function upsertRows(client, table, rows, options) {
        if (rows.length === 0) return 0;

        const { error } = await client
            .from(table)
            .upsert(rows, options);

        if (error) throw error;
        return rows.length;
    }

    async function pullPracticesFromSupabase(client, userId) {
        if (!client || !userId) {
            throw new Error('需要登录后才能读取云端实践记录');
        }

        const { data, error } = await client
            .from('practices')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async function pullArchiveFromSupabase(client, userId) {
        if (!client || !userId) {
            throw new Error('需要登录后才能读取云端档案记录');
        }

        const [
            problemCases,
            practices,
            conversations,
            messages,
            readingNotes,
            readingProgress,
            highlights,
            savedQuotes,
            savedAnswers,
        ] = await Promise.all([
            selectRows(client, 'problem_cases', userId, 'updated_at', false),
            selectRows(client, 'practices', userId, 'updated_at', false),
            selectRows(client, 'conversations', userId, 'updated_at', false),
            selectRows(client, 'messages', userId, 'created_at', true),
            selectRows(client, 'reading_notes', userId, 'updated_at', false),
            selectRows(client, 'reading_progress', userId, 'updated_at', false),
            selectRows(client, 'highlights', userId, 'updated_at', false),
            selectRows(client, 'saved_quotes', userId, 'updated_at', false),
            selectRows(client, 'saved_answers', userId, 'updated_at', false),
        ]);

        return {
            problemCases: problemCases.map(mapCloudRowToProblemCase).sort(sortByUpdatedAtDesc),
            practices: practices.map(mapCloudRowToPractice).sort(sortByUpdatedAtDesc),
            conversations: mapCloudRowsToConversations(conversations, messages),
            readingNotes: readingNotes.map(mapCloudRowToReadingNote).sort(sortByUpdatedAtDesc),
            readingProgress: readingProgress.map(mapCloudRowToReadingProgress).sort(sortByUpdatedAtDesc),
            highlights: highlights.map(mapCloudRowToHighlight).sort(sortByUpdatedAtDesc),
            savedQuotes: savedQuotes.map(mapCloudRowToSavedQuote).sort(sortByUpdatedAtDesc),
            savedAnswers: savedAnswers.map(mapCloudRowToSavedAnswer).sort(sortByUpdatedAtDesc),
        };
    }

    async function selectRows(client, table, userId, orderColumn, ascending) {
        const { data, error } = await client
            .from(table)
            .select('*')
            .eq('user_id', userId)
            .order(orderColumn, { ascending });

        if (error) throw error;
        return data || [];
    }

    function sortByUpdatedAtDesc(a, b) {
        return getRecordTime(b) - getRecordTime(a);
    }

    function getRecordTime(record) {
        return Date.parse(record?.updatedAt || record?.updated_at || record?.createdAt || record?.created_at || 0) || 0;
    }

    function readArchiveFromLocalStorage(storage) {
        return Object.entries(LOCAL_ARCHIVE_STORAGE_KEYS).reduce((archive, [key, storageKey]) => {
            try {
                const parsed = JSON.parse(storage.getItem(storageKey) || '[]');
                archive[key] = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                archive[key] = [];
            }
            return archive;
        }, {});
    }

    return {
        buildExportPayload,
        LOCAL_ARCHIVE_STORAGE_KEYS,
        mapConversationToCloudRows,
        mapCloudRowToProblemCase,
        mapCloudRowToHighlight,
        mapCloudRowToPractice,
        mapCloudRowToReadingNote,
        mapCloudRowToReadingProgress,
        mapCloudRowToSavedAnswer,
        mapCloudRowToSavedQuote,
        mapCloudRowsToConversations,
        mapHighlightToCloudRow,
        mapProblemCaseToCloudRow,
        mapPracticeToCloudRow,
        mapReadingNoteToCloudRow,
        mapReadingProgressToCloudRow,
        mapSavedAnswerToCloudRow,
        mapSavedQuoteToCloudRow,
        mergeArchives,
        mergeCloudPractices,
        pullArchiveFromSupabase,
        pushArchiveToSupabase,
        pullPracticesFromSupabase,
        pushPracticesToSupabase,
        saveArchiveToLocalStorage,
        readArchiveFromLocalStorage,
        summarizeArchive,
    };
});
