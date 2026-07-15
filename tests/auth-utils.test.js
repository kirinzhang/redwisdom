const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildLoginCallbackUrl,
    createSupabaseClient,
    getAuthCallbackError,
    getAuthConfigStatus,
    getSafeReturnTo,
    getSessionProfile,
    signOut,
    subscribeToAuthChanges,
} = require('../js/auth-utils.js');

test('getAuthConfigStatus requires both Supabase URL and anon key', () => {
    assert.deepEqual(getAuthConfigStatus({}), {
        configured: false,
        missing: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    });
    assert.deepEqual(getAuthConfigStatus({
        SUPABASE_URL: 'https://example.supabase.co',
    }), {
        configured: false,
        missing: ['SUPABASE_ANON_KEY'],
    });
    assert.deepEqual(getAuthConfigStatus({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
    }), {
        configured: true,
        missing: [],
    });
});

test('getSessionProfile summarizes Supabase session user metadata for UI', () => {
    const profile = getSessionProfile({
        user: {
            id: 'user-1',
            email: 'reader@example.com',
            user_metadata: {
                full_name: '读者',
                avatar_url: 'https://example.com/avatar.png',
            },
        },
    });

    assert.deepEqual(profile, {
        id: 'user-1',
        email: 'reader@example.com',
        displayName: '读者',
        avatarUrl: 'https://example.com/avatar.png',
    });
});

test('getSessionProfile falls back to email prefix when display name is missing', () => {
    const profile = getSessionProfile({
        user: {
            id: 'user-2',
            email: 'worker@example.com',
            user_metadata: {},
        },
    });

    assert.equal(profile.displayName, 'worker');
});

test('createSupabaseClient enables persistent OAuth session recovery', () => {
    let receivedOptions;
    const client = createSupabaseClient({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
    }, {
        createClient(url, key, options) {
            receivedOptions = options;
            return { url, key };
        },
    });

    assert.equal(client.url, 'https://example.supabase.co');
    assert.deepEqual(receivedOptions.auth, {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    });
});

test('OAuth return paths stay on the same origin', () => {
    assert.equal(getSafeReturnTo('/chat.html?case=1', 'https://redwisdom.xyz'), '/chat.html?case=1');
    assert.equal(getSafeReturnTo('https://evil.example/phish', 'https://redwisdom.xyz'), '/me.html');
    assert.equal(getSafeReturnTo('//evil.example/phish', 'https://redwisdom.xyz'), '/me.html');
    assert.equal(getSafeReturnTo('/login.html', 'https://redwisdom.xyz'), '/me.html');
    assert.equal(
        buildLoginCallbackUrl('https://redwisdom.xyz/login.html', '/reading.html#article'),
        'https://redwisdom.xyz/login.html?next=%2Freading.html%23article'
    );
});

test('OAuth callback errors are converted into useful account messages', () => {
    assert.equal(getAuthCallbackError({ search: '?error=access_denied' }), 'Google 登录已取消，你的本机学习档案没有变化。');
    assert.equal(getAuthCallbackError({ hash: '#error_code=server_error&error_description=Provider+failed' }), 'Provider failed');
    assert.equal(getAuthCallbackError({}), '');
});

test('auth subscriptions can be cleaned up and sign-out stays local to this browser', async () => {
    let observer;
    let unsubscribed = false;
    let signOutOptions;
    const client = {
        auth: {
            onAuthStateChange(callback) {
                observer = callback;
                return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
            },
            async signOut(options) {
                signOutOptions = options;
                return { error: null };
            },
        },
    };
    const events = [];
    const unsubscribe = subscribeToAuthChanges(client, detail => events.push(detail));
    observer('SIGNED_IN', { user: { id: 'user-1' } });
    unsubscribe();
    await signOut(client);

    assert.equal(events[0].event, 'SIGNED_IN');
    assert.equal(unsubscribed, true);
    assert.deepEqual(signOutOptions, { scope: 'local' });
});
