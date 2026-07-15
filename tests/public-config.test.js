const assert = require('node:assert/strict');
const test = require('node:test');

const publicConfigHandler = require('../api/public-config.js');

test('public runtime config exposes only Supabase public auth settings', () => {
    const previous = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_GOOGLE_AUTH_ENABLED: process.env.SUPABASE_GOOGLE_AUTH_ENABLED,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    };
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'public-anon-key';
    process.env.SUPABASE_GOOGLE_AUTH_ENABLED = 'true';
    process.env.DEEPSEEK_API_KEY = 'must-not-leak';
    process.env.OPENROUTER_API_KEY = 'must-not-leak-either';

    try {
        const response = createResponse();
        publicConfigHandler({ method: 'GET' }, response);

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.payload, {
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'public-anon-key',
            SUPABASE_GOOGLE_AUTH_ENABLED: true,
            authConfigured: true,
        });
        assert.doesNotMatch(JSON.stringify(response.payload), /DEEPSEEK|OPENROUTER|must-not-leak/);
        assert.equal(response.headers['Cache-Control'], 'no-store');
    } finally {
        restoreEnv(previous);
    }
});

test('public runtime config reports an unconfigured account without failing', () => {
    const previous = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_GOOGLE_AUTH_ENABLED: process.env.SUPABASE_GOOGLE_AUTH_ENABLED,
    };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_GOOGLE_AUTH_ENABLED;

    try {
        const response = createResponse();
        publicConfigHandler({ method: 'GET' }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.payload.authConfigured, false);
        assert.equal(response.payload.SUPABASE_GOOGLE_AUTH_ENABLED, false);
    } finally {
        restoreEnv(previous);
    }
});

function createResponse() {
    return {
        headers: {},
        statusCode: 200,
        payload: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; },
        end() { return this; },
    };
}

function restoreEnv(values) {
    Object.entries(values).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    });
}
