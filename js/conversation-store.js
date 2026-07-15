(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomConversations = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const STORAGE_KEY = 'redwisdom.conversations.v1';

    function createConversationStore(storage, now = () => Date.now()) {
        return {
            listConversations() {
                return readConversations(storage);
            },

            listConversationSummaries() {
                return readConversations(storage).map((conversation) => ({
                    id: conversation.id,
                    problemCaseId: conversation.problemCaseId || '',
                    title: conversation.title,
                    source: conversation.source,
                    methodologyTags: conversation.methodologyTags || [],
                    messageCount: (conversation.messages || []).length,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                }));
            },

            getConversation(id) {
                return readConversations(storage).find((conversation) => conversation.id === id) || null;
            },

            createConversation(input) {
                const conversations = readConversations(storage);
                const timestamp = createTimestamp(now);
                const message = createMessage({
                    role: 'user',
                    content: input.userMessage,
                    createdAt: timestamp,
                });
                const conversation = {
                    id: `conversation-${now()}-${Math.random().toString(36).slice(2, 8)}`,
                    problemCaseId: sanitizeText(input.problemCaseId, 180),
                    title: sanitizeText(input.title || input.userMessage, 80) || '未命名问答',
                    source: sanitizeText(input.source, 40) || 'chat',
                    methodologyTags: normalizeTags(input.methodologyTags),
                    messages: [message],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                conversations.unshift(conversation);
                writeConversations(storage, conversations);
                return conversation;
            },

            appendMessage(id, input) {
                const conversations = readConversations(storage);
                const index = conversations.findIndex((conversation) => conversation.id === id);

                if (index === -1) {
                    throw new Error('问答记录不存在');
                }

                const timestamp = createTimestamp(now);
                const existing = conversations[index];
                const tags = mergeTags(existing.methodologyTags, input.methodologyTags);
                const updated = {
                    ...existing,
                    methodologyTags: tags,
                    messages: [
                        ...(existing.messages || []),
                        createMessage({
                            role: input.role,
                            content: input.content,
                            createdAt: timestamp,
                        }),
                    ],
                    updatedAt: timestamp,
                };

                conversations[index] = updated;
                writeConversations(storage, sortConversations(conversations));
                return updated;
            },

            deleteConversation(id) {
                writeConversations(storage, readConversations(storage).filter((conversation) => conversation.id !== id));
            },

            clearConversations() {
                storage.removeItem(STORAGE_KEY);
                markArchiveDirty(storage);
            },
        };
    }

    function summarizeConversationArchive(conversations) {
        const tagCounts = new Map();
        const tagOrder = new Map();
        let totalMessages = 0;

        conversations.forEach((conversation) => {
            totalMessages += (conversation.messages || []).length;
            (conversation.methodologyTags || []).forEach((tag) => {
                if (!tagOrder.has(tag)) {
                    tagOrder.set(tag, tagOrder.size);
                }
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });

        return {
            total: conversations.length,
            totalMessages,
            topMethodologyTags: [...tagCounts.entries()]
                .sort((a, b) => b[1] - a[1] || tagOrder.get(a[0]) - tagOrder.get(b[0]))
                .slice(0, 6),
        };
    }

    function createMessage({ role, content, createdAt }) {
        const safeRole = ['user', 'assistant', 'system'].includes(role) ? role : 'user';
        return {
            role: safeRole,
            content: sanitizeText(content, 12000),
            createdAt,
        };
    }

    function readConversations(storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? sortConversations(parsed) : [];
        } catch (error) {
            return [];
        }
    }

    function writeConversations(storage, conversations) {
        storage.setItem(STORAGE_KEY, JSON.stringify(sortConversations(conversations)));
        markArchiveDirty(storage);
    }

    function markArchiveDirty(storage) { storage.setItem('redwisdom.archiveDirtyAt.v1', new Date().toISOString()); }

    function sortConversations(conversations) {
        return [...conversations].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    }

    function createTimestamp(now) {
        return new Date(now()).toISOString();
    }

    function sanitizeText(value, limit = 5000) {
        return String(value || '').trim().slice(0, limit);
    }

    function normalizeTags(tags) {
        const list = Array.isArray(tags) ? tags : [];
        return [...new Set(list.map((tag) => sanitizeText(tag, 40)).filter(Boolean))].slice(0, 8);
    }

    function mergeTags(existingTags, nextTags) {
        return normalizeTags([...(existingTags || []), ...(nextTags || [])]);
    }

    return {
        STORAGE_KEY,
        createConversationStore,
        summarizeConversationArchive,
    };
});
