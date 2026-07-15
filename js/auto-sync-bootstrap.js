(function () {
    let activeUserId = '';
    let unsubscribeAuth = () => {};

    async function bootstrap() {
        if (typeof CONFIG === 'undefined' || !window.RedWisdomAuth || !window.RedWisdomCloudSync || !window.RedWisdomAutoSync) return;
        await Promise.resolve(window.REDWISDOM_CONFIG_READY).catch(() => CONFIG);
        const status = window.RedWisdomAuth.getAuthConfigStatus(CONFIG);
        if (!status.configured) {
            dispatchAuthState({ state: 'local', profile: null, missing: status.missing });
            return;
        }
        try {
            await ensureSupabaseSdk();
            const client = window.RedWisdomAuth.createSupabaseClient(CONFIG, window.supabase);
            window.RedWisdomAuthClient = client;
            const session = await window.RedWisdomAuth.getCurrentSession(client);
            await applySession(client, session, 'INITIAL_SESSION');
            unsubscribeAuth = window.RedWisdomAuth.subscribeToAuthChanges(client, ({ event, session: nextSession }) => {
                applySession(client, nextSession, event).catch(error => {
                    dispatchAuthState({ state: 'error', profile: null, error });
                });
            });
        } catch (error) {
            dispatchAuthState({ state: 'error', profile: null, error });
            dispatchSyncStatus({ state: 'error', error });
        }
    }

    async function applySession(client, session, event) {
        const profile = window.RedWisdomAuth.getSessionProfile(session);
        dispatchAuthState({ state: profile ? 'signed-in' : 'signed-out', profile, event });

        if (!profile) {
            stopAutoSync();
            return;
        }
        if (activeUserId === profile.id && window.RedWisdomAutoSyncController) return;

        stopAutoSync();
        activeUserId = profile.id;
        try {
            await window.RedWisdomAuth.ensureUserProfile(client, profile, localStorage.getItem('redwisdom.locale.v1') || 'zh-CN');
        } catch (error) {
            dispatchAuthState({ state: 'profile-error', profile, event, error });
        }
        window.RedWisdomAutoSyncController = window.RedWisdomAutoSync.startAutoSync({
            client,
            userId: profile.id,
            storage: localStorage,
            cloudSync: window.RedWisdomCloudSync,
            forceInitial: localStorage.getItem(window.RedWisdomAutoSync.SYNCED_USER_KEY) !== profile.id,
            onStatus: dispatchSyncStatus,
        });
    }

    function stopAutoSync() {
        window.RedWisdomAutoSyncController?.stop?.();
        window.RedWisdomAutoSyncController = null;
        activeUserId = '';
    }

    function dispatchAuthState(detail) {
        window.dispatchEvent(new CustomEvent('redwisdom:auth-state', { detail }));
    }

    function dispatchSyncStatus(detail) {
        window.dispatchEvent(new CustomEvent('redwisdom:auto-sync-status', { detail }));
    }

    function ensureSupabaseSdk() {
        if (window.supabase?.createClient) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Supabase SDK 加载失败'));
            document.head.appendChild(script);
        });
    }

    window.addEventListener('pagehide', () => {
        unsubscribeAuth();
        stopAutoSync();
    }, { once: true });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    else bootstrap();
})();
