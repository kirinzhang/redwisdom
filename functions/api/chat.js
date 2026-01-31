// Cloudflare Pages Function - 毛选 Chatbot API 代理
// 路由: /api/chat

export async function onRequestPost(context) {
    const { request, env } = context;

    // 检查 API Key 是否存在
    if (!env.OPENROUTER_API_KEY) {
        return new Response(JSON.stringify({
            error: '服务器未配置 API Key，请在 Cloudflare 环境变量中设置 OPENROUTER_API_KEY'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }

    try {
        // 获取请求体
        const body = await request.json();

        // 调用 OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://redwisdom.pages.dev',
                'X-Title': 'Red Wisdom Chat'
            },
            body: JSON.stringify(body)
        });

        // 创建流式响应
        const { readable, writable } = new TransformStream();
        response.body.pipeTo(writable);

        return new Response(readable, {
            status: response.status,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
}

// 处理 GET 请求 - 用于测试 Function 是否正常工作
export async function onRequestGet(context) {
    const { env } = context;

    return new Response(JSON.stringify({
        status: 'ok',
        message: 'Pages Function 正常工作',
        hasApiKey: !!env.OPENROUTER_API_KEY
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        }
    });
}

// 处理 OPTIONS 预检请求
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        }
    });
}
