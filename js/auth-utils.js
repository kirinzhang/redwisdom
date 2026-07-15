(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomAuth = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function getAuthConfigStatus(config) {
        const missing = [];

        if (!String(config?.SUPABASE_URL || '').trim()) {
            missing.push('SUPABASE_URL');
        }

        if (!String(config?.SUPABASE_ANON_KEY || '').trim()) {
            missing.push('SUPABASE_ANON_KEY');
        }

        return {
            configured: missing.length === 0,
            missing,
        };
    }

    function getSessionProfile(session) {
        const user = session?.user;
        if (!user) return null;

        const metadata = user.user_metadata || {};
        const email = user.email || '';

        return {
            id: user.id,
            email,
            displayName: metadata.full_name || metadata.name || email.split('@')[0] || '读者',
            avatarUrl: metadata.avatar_url || metadata.picture || '',
        };
    }

    function createSupabaseClient(config, supabaseGlobal) {
        const status = getAuthConfigStatus(config);
        if (!status.configured || !supabaseGlobal?.createClient) {
            return null;
        }

        return supabaseGlobal.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        });
    }

    async function getCurrentSession(client) {
        if (!client) return null;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session || null;
    }

    async function signInWithGoogle(client, redirectTo) {
        if (!client) {
            throw new Error('Supabase 未配置，无法使用 Google 登录');
        }

        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
            },
        });

        if (error) throw error;
        return data || null;
    }

    async function signOut(client) {
        if (!client) return;
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
    }

    function subscribeToAuthChanges(client, callback) {
        if (!client?.auth?.onAuthStateChange || typeof callback !== 'function') return () => {};
        const { data } = client.auth.onAuthStateChange((event, session) => callback({ event, session }));
        return () => data?.subscription?.unsubscribe?.();
    }

    function getSafeReturnTo(value, origin = 'https://redwisdom.local') {
        try {
            const base = new URL(origin);
            const target = new URL(String(value || '/me.html'), base);
            if (target.origin !== base.origin || !['http:', 'https:'].includes(target.protocol)) return '/me.html';
            if (/\/login\.html$/i.test(target.pathname)) return '/me.html';
            return `${target.pathname}${target.search}${target.hash}`;
        } catch (error) {
            return '/me.html';
        }
    }

    function buildLoginCallbackUrl(currentHref, returnTo) {
        const current = new URL(currentHref);
        const callback = new URL('/login.html', current.origin);
        callback.searchParams.set('next', getSafeReturnTo(returnTo, current.origin));
        return callback.href;
    }

    function getAuthCallbackError(locationLike = {}) {
        const params = new URLSearchParams(String(locationLike.search || '').replace(/^\?/, ''));
        const hashParams = new URLSearchParams(String(locationLike.hash || '').replace(/^#/, ''));
        const code = params.get('error_code') || params.get('error') || hashParams.get('error_code') || hashParams.get('error');
        const description = params.get('error_description') || hashParams.get('error_description');
        if (!code && !description) return '';
        if (code === 'access_denied') return 'Google 登录已取消，你的本机学习档案没有变化。';
        return description || `登录未完成（${code}）`;
    }

    async function ensureUserProfile(client, profile, locale = 'zh-CN') {
        if (!client || !profile?.id) return null;
        const row = {
            id: profile.id,
            email: profile.email || '',
            display_name: profile.displayName || '',
            avatar_url: profile.avatarUrl || '',
            locale: locale || 'zh-CN',
            updated_at: new Date().toISOString(),
        };
        const { error } = await client.from('profiles').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        return row;
    }

    return {
        buildLoginCallbackUrl,
        createSupabaseClient,
        ensureUserProfile,
        getAuthCallbackError,
        getAuthConfigStatus,
        getCurrentSession,
        getSafeReturnTo,
        getSessionProfile,
        signInWithGoogle,
        signOut,
        subscribeToAuthChanges,
    };
});
