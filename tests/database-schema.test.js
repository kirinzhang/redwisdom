const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const schema = fs.readFileSync(path.resolve(__dirname, '../docs/database/supabase-schema.sql'), 'utf8');

test('Supabase schema includes saved AI answers table and RLS policies', () => {
    assert.match(schema, /create table if not exists public\.saved_answers/);
    assert.match(schema, /unique \(user_id, answer_id\)/);
    assert.match(schema, /create trigger saved_answers_set_updated_at/);
    assert.match(schema, /alter table public\.saved_answers enable row level security/);
    assert.match(schema, /saved_answers_select_own/);
    assert.match(schema, /saved_answers_insert_own/);
    assert.match(schema, /saved_answers_update_own/);
    assert.match(schema, /saved_answers_delete_own/);
});

test('Supabase schema exposes private sync tables only to authenticated users', () => {
    assert.doesNotMatch(schema, /auth\.uid\(\) =/);
    assert.match(schema, /to authenticated\nusing \(\(select auth\.uid\(\)\) = user_id\)/);
    assert.match(schema, /revoke all privileges on table[\s\S]+from anon/);
    assert.match(schema, /grant select, insert, update, delete on table[\s\S]+to authenticated/);
    assert.match(schema, /revoke execute on function public\.set_updated_at\(\) from public, anon, authenticated/);
});
