(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.RedWisdomAutoSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const DIRTY_KEY = 'redwisdom.archiveDirtyAt.v1';
    const LAST_SYNC_KEY = 'redwisdom.lastCloudSyncAt.v1';
    const SYNCED_USER_KEY = 'redwisdom.lastSyncedUser.v1';

    function markArchiveDirty(storage, now = () => Date.now()) {
        storage.setItem(DIRTY_KEY, new Date(now()).toISOString());
    }

    function needsSync(storage, userId, maxAgeMs = 5 * 60 * 1000, now = () => Date.now()) {
        if (!userId) return false;
        if (storage.getItem(SYNCED_USER_KEY) !== userId) return true;
        if (storage.getItem(DIRTY_KEY)) return true;
        const lastSync = Date.parse(storage.getItem(LAST_SYNC_KEY) || 0) || 0;
        return now() - lastSync >= maxAgeMs;
    }

    async function syncNow({ client, userId, storage, cloudSync, force = false, now = () => Date.now() }) {
        if (!client || !userId || !storage || !cloudSync) throw new Error('自动同步缺少账户或存储配置');
        if (!force && !needsSync(storage, userId, undefined, now)) return { skipped: true };

        const localArchive = cloudSync.readArchiveFromLocalStorage(storage);
        const cloudArchive = await cloudSync.pullArchiveFromSupabase(client, userId);
        const mergedArchive = cloudSync.mergeArchives(localArchive, cloudArchive);
        const localCounts = cloudSync.saveArchiveToLocalStorage(storage, mergedArchive);
        const cloudCounts = await cloudSync.pushArchiveToSupabase(client, userId, mergedArchive);
        const timestamp = new Date(now()).toISOString();
        storage.setItem(LAST_SYNC_KEY, timestamp);
        storage.setItem(SYNCED_USER_KEY, userId);
        storage.removeItem(DIRTY_KEY);
        return { skipped: false, syncedAt: timestamp, localCounts, cloudCounts, archive: mergedArchive };
    }

    function startAutoSync(options) {
        const intervalMs = Math.max(5000, options.intervalMs || 15000);
        let running = false;
        let stopped = false;

        async function run(force = false) {
            if (running || stopped) return { skipped: true };
            running = true;
            options.onStatus?.({ state: 'syncing' });
            try {
                const result = await syncNow({ ...options, force });
                options.onStatus?.({ state: result.skipped ? 'idle' : 'synced', result });
                return result;
            } catch (error) {
                options.onStatus?.({ state: 'error', error });
                return { skipped: false, error };
            } finally {
                running = false;
            }
        }

        const timer = setInterval(() => run(false), intervalMs);
        run(!!options.forceInitial);
        return {
            run,
            stop() {
                stopped = true;
                clearInterval(timer);
            },
        };
    }

    return { DIRTY_KEY, LAST_SYNC_KEY, SYNCED_USER_KEY, markArchiveDirty, needsSync, startAutoSync, syncNow };
});
