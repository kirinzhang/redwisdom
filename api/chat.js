// Vercel Serverless Function - 毛选 Chatbot API 代理
// 路由: /api/chat

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
2. 原文引用只能来自 contextChunks，不要编造原文、篇名、日期或出处。
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
        const messages = buildMessages(req.body || {});

        // 调用 OpenRouter API
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

        if (!response.ok || !response.body) {
            const text = await response.text();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(response.status || 500).json({
                error: text || `OpenRouter error ${response.status}`
            });
        }

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
