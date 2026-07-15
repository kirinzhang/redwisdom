// Vercel Serverless Function - 毛选 Chatbot API 代理
// 路由: /api/chat

export default async function handler(req, res) {
    const { handleChatRequest } = await import('./chat-core.mjs');
    return handleChatRequest(req, res, process.env);
}

// Vercel 配置
export const config = {
    api: {
        bodyParser: true,
    },
};
