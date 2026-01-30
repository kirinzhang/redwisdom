// Cloudflare Worker - 毛选 Chatbot API 代理
// 将此代码部署到 Cloudflare Workers，设置环境变量 OPENROUTER_API_KEY

export default {
    async fetch(request, env, ctx) {
        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                }
            });
        }

        // 只接受 POST 请求
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
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
};
