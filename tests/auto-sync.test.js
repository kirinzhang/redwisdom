const assert = require('node:assert/strict');
const test = require('node:test');
const { DIRTY_KEY, LAST_SYNC_KEY, SYNCED_USER_KEY, markArchiveDirty, needsSync, syncNow } = require('../js/auto-sync.js');

function storage() {
    const data = new Map();
    return {
        getItem: key => data.has(key) ? data.get(key) : null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key),
    };
}

test('archive dirty marker causes a signed-in archive to need sync', () => {
    const local = storage();
    local.setItem(SYNCED_USER_KEY, 'user-1');
    local.setItem(LAST_SYNC_KEY, '2026-07-13T00:00:00.000Z');
    markArchiveDirty(local, () => Date.parse('2026-07-13T00:01:00.000Z'));
    assert.equal(local.getItem(DIRTY_KEY), '2026-07-13T00:01:00.000Z');
    assert.equal(needsSync(local, 'user-1', 300000, () => Date.parse('2026-07-13T00:02:00.000Z')), true);
});

test('syncNow merges local and cloud before saving and pushing', async () => {
    const local = storage();
    markArchiveDirty(local, () => 1);
    const calls = [];
    const cloudSync = {
        readArchiveFromLocalStorage() { calls.push('read'); return { practices: [{ id: 'local' }] }; },
        async pullArchiveFromSupabase() { calls.push('pull'); return { practices: [{ id: 'cloud' }] }; },
        mergeArchives(localArchive, cloudArchive) { calls.push('merge'); return { practices: [...localArchive.practices, ...cloudArchive.practices] }; },
        saveArchiveToLocalStorage(store, archive) { calls.push('save'); assert.equal(archive.practices.length, 2); return { practices: 2 }; },
        async pushArchiveToSupabase(client, userId, archive) { calls.push('push'); assert.equal(archive.practices.length, 2); return { practices: 2 }; },
    };
    const result = await syncNow({ client: {}, userId: 'user-1', storage: local, cloudSync, force: true, now: () => 1000 });
    assert.deepEqual(calls, ['read', 'pull', 'merge', 'save', 'push']);
    assert.equal(result.skipped, false);
    assert.equal(local.getItem(DIRTY_KEY), null);
    assert.equal(local.getItem(SYNCED_USER_KEY), 'user-1');
});
