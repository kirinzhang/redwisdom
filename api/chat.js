// Vercel Serverless Function - 毛选 Chatbot API 代理
// 路由: /api/chat

export default async function handler(req, res) {
    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(200).end();
    }

    // GET 请求用于测试
    if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({
            status: 'ok',
            message: 'Vercel Serverless Function 正常工作',
            hasApiKey: !!process.env.OPENROUTER_API_KEY
        });
    }

    // 只接受 POST 请求
    if (req.method !== 'POST') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(405).json({ error: '仅支持 POST 请求' });
    }

    // 检查 API Key
    if (!process.env.OPENROUTER_API_KEY) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({
            error: '服务器未配置 API Key，请在 Vercel 环境变量中设置 OPENROUTER_API_KEY'
        });
    }

    try {
        // 调用 OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://redwisdom.xyz',
                'X-Title': 'Red Wisdom Chat'
            },
            body: JSON.stringify(req.body)
        });

        // 设置响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 流式传输响应
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }

        res.end();

    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ error: error.message });
    }
}

// Vercel 配置
export const config = {
    api: {
        bodyParser: true,
    },
};
