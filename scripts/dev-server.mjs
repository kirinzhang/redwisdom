import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleChatRequest as chatHandler } from '../api/chat-core.mjs';
import publicConfigHandler from '../api/public-config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);

await loadEnv(path.join(root, '.env'));

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
        if (url.pathname === '/api/chat') {
            await handleChatRequest(req, res);
            return;
        }
        if (url.pathname === '/api/public-config') {
            await publicConfigHandler(req, createVercelResponse(res));
            return;
        }
        await serveStatic(url.pathname, req, res);
    } catch (error) {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
    }
});

server.listen(port, '127.0.0.1', () => {
    const provider = process.env.DEEPSEEK_API_KEY ? 'DeepSeek V4 Pro' : process.env.OPENROUTER_API_KEY ? 'OpenRouter fallback' : '未配置模型 Key';
    console.log(`Red Wisdom: http://127.0.0.1:${port} (${provider})`);
});

async function handleChatRequest(req, res) {
    if (req.method === 'POST') {
        const rawBody = await readRequestBody(req);
        try {
            req.body = rawBody ? JSON.parse(rawBody) : {};
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '请求 JSON 无效' }));
            return;
        }
    }
    await chatHandler(req, createVercelResponse(res));
}

function createVercelResponse(res) {
    res.status = (statusCode) => {
        res.statusCode = statusCode;
        return res;
    };
    res.json = (payload) => {
        if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
    };
    return res;
}

async function readRequestBody(req) {
    let body = '';
    for await (const chunk of req) {
        body += chunk;
        if (body.length > 1_000_000) throw new Error('请求体过大');
    }
    return body;
}

async function serveStatic(pathname, req, res) {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
        return;
    }

    const relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname).replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) throw new Error('Not a file');
        const content = await readFile(filePath);
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
    }
}

async function loadEnv(filePath) {
    try {
        const content = await readFile(filePath, 'utf8');
        content.split(/\r?\n/).forEach((line) => {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (!match || process.env[match[1]] !== undefined) return;
            process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
        });
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}
