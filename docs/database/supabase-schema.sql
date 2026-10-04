-- Red Wisdom Supabase schema
-- Apply this to the dedicated project before enabling Google OAuth.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    display_name text,
    avatar_url text,
    locale text not null default 'zh-CN',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.problem_cases (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    title text not null default '',
    real_problem text not null default '',
    goal text not null default '',
    facts text not null default '',
    judgments text not null default '',
    emotions text not null default '',
    main_contradiction text not null default '',
    investigation_tasks text[] not null default '{}',
    available_forces text not null default '',
    next_action text not null default '',
    methodology_tags text[] not null default '{}',
    stage text not null default 'define',
    status text not null default 'active',
    activities jsonb not null default '[]'::jsonb,
    investigations jsonb not null default '[]'::jsonb,
    contradiction_map jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_id),
    constraint problem_cases_stage_check check (stage in ('define', 'investigate', 'analyze', 'act', 'review')),
    constraint problem_cases_status_check check (status in ('active', 'paused', 'resolved', 'archived'))
);

create table if not exists public.practices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    problem_case_id text not null default '',
    title text not null default '',
    real_problem text not null default '',
    source_type text not null default 'manual',
    source_title text not null default '',
    source_href text not null default '',
    related_quote text not null default '',
    methodology_tags text[] not null default '{}',
    main_contradiction text not null default '',
    investigation_todo text not null default '',
    available_forces text not null default '',
    action_plan text not null default '',
    expected_result text not null default '',
    actual_result text not null default '',
    reflection text not null default '',
    next_action text not null default '',
    status text not null default 'draft',
    due_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_id),
    constraint practices_status_check check (
        status in ('draft', 'active', 'done', 'reviewed', 'archived')
    )
);

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    problem_case_id text not null default '',
    title text not null default '',
    source text not null default 'chat',
    methodology_tags text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_id)
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    conversation_id uuid references public.conversations(id) on delete cascade,
    local_id text not null,
    conversation_local_id text not null,
    role text not null,
    content text not null default '',
    created_at timestamptz not null default now(),
    unique (user_id, local_id),
    constraint messages_role_check check (
        role in ('user', 'assistant', 'system')
    )
);

create table if not exists public.reading_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    problem_case_id text not null default '',
    article_id text not null,
    article_title text not null default '',
    content text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, article_id)
);

alter table public.practices add column if not exists problem_case_id text not null default '';
alter table public.conversations add column if not exists problem_case_id text not null default '';
alter table public.reading_notes add column if not exists problem_case_id text not null default '';

create table if not exists public.reading_progress (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    article_id text not null,
    article_title text not null default '',
    progress_percent integer not null default 0,
    last_position integer not null default 0,
    bookmarked boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, article_id),
    constraint reading_progress_percent_check check (
        progress_percent >= 0 and progress_percent <= 100
    )
);

create table if not exists public.highlights (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    article_id text not null,
    article_title text not null default '',
    selected_text text not null default '',
    note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_id)
);

create table if not exists public.saved_quotes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    quote_id text not null,
    content text not null default '',
    source text not null default '',
    date text not null default '',
    category text not null default '',
    methodology_tags text[] not null default '{}',
    article_title text not null default '',
    article_href text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, quote_id)
);

create table if not exists public.saved_answers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_id text not null,
    answer_id text not null,
    conversation_local_id text not null default '',
    title text not null default '',
    user_message text not null default '',
    assistant_message text not null default '',
    methodology_tags text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, answer_id)
);

create index if not exists messages_conversation_id_idx
on public.messages (conversation_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists problem_cases_set_updated_at on public.problem_cases;
create trigger problem_cases_set_updated_at
before update on public.problem_cases
for each row execute function public.set_updated_at();

drop trigger if exists practices_set_updated_at on public.practices;
create trigger practices_set_updated_at
before update on public.practices
for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists reading_notes_set_updated_at on public.reading_notes;
create trigger reading_notes_set_updated_at
before update on public.reading_notes
for each row execute function public.set_updated_at();

drop trigger if exists reading_progress_set_updated_at on public.reading_progress;
create trigger reading_progress_set_updated_at
before update on public.reading_progress
for each row execute function public.set_updated_at();

drop trigger if exists highlights_set_updated_at on public.highlights;
create trigger highlights_set_updated_at
before update on public.highlights
for each row execute function public.set_updated_at();

drop trigger if exists saved_quotes_set_updated_at on public.saved_quotes;
create trigger saved_quotes_set_updated_at
before update on public.saved_quotes
for each row execute function public.set_updated_at();

drop trigger if exists saved_answers_set_updated_at on public.saved_answers;
create trigger saved_answers_set_updated_at
before update on public.saved_answers
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.problem_cases enable row level security;
alter table public.practices enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reading_notes enable row level security;
alter table public.reading_progress enable row level security;
alter table public.highlights enable row level security;
alter table public.saved_quotes enable row level security;
alter table public.saved_answers enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "problem_cases_select_own" on public.problem_cases;
create policy "problem_cases_select_own"
on public.problem_cases
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "problem_cases_insert_own" on public.problem_cases;
create policy "problem_cases_insert_own"
on public.problem_cases
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "problem_cases_update_own" on public.problem_cases;
create policy "problem_cases_update_own"
on public.problem_cases
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "problem_cases_delete_own" on public.problem_cases;
create policy "problem_cases_delete_own"
on public.problem_cases
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "practices_select_own" on public.practices;
create policy "practices_select_own"
on public.practices
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "practices_insert_own" on public.practices;
create policy "practices_insert_own"
on public.practices
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "practices_update_own" on public.practices;
create policy "practices_update_own"
on public.practices
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "practices_delete_own" on public.practices;
create policy "practices_delete_own"
on public.practices
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
on public.conversations
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
on public.conversations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own"
on public.conversations
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
on public.messages
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
on public.messages
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
on public.messages
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "reading_notes_select_own" on public.reading_notes;
create policy "reading_notes_select_own"
on public.reading_notes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "reading_notes_insert_own" on public.reading_notes;
create policy "reading_notes_insert_own"
on public.reading_notes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "reading_notes_update_own" on public.reading_notes;
create policy "reading_notes_update_own"
on public.reading_notes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "reading_notes_delete_own" on public.reading_notes;
create policy "reading_notes_delete_own"
on public.reading_notes
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "reading_progress_select_own" on public.reading_progress;
create policy "reading_progress_select_own"
on public.reading_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "reading_progress_insert_own" on public.reading_progress;
create policy "reading_progress_insert_own"
on public.reading_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "reading_progress_update_own" on public.reading_progress;
create policy "reading_progress_update_own"
on public.reading_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "reading_progress_delete_own" on public.reading_progress;
create policy "reading_progress_delete_own"
on public.reading_progress
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "highlights_select_own" on public.highlights;
create policy "highlights_select_own"
on public.highlights
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "highlights_insert_own" on public.highlights;
create policy "highlights_insert_own"
on public.highlights
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "highlights_update_own" on public.highlights;
create policy "highlights_update_own"
on public.highlights
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "highlights_delete_own" on public.highlights;
create policy "highlights_delete_own"
on public.highlights
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_quotes_select_own" on public.saved_quotes;
create policy "saved_quotes_select_own"
on public.saved_quotes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_quotes_insert_own" on public.saved_quotes;
create policy "saved_quotes_insert_own"
on public.saved_quotes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_quotes_update_own" on public.saved_quotes;
create policy "saved_quotes_update_own"
on public.saved_quotes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_quotes_delete_own" on public.saved_quotes;
create policy "saved_quotes_delete_own"
on public.saved_quotes
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_answers_select_own" on public.saved_answers;
create policy "saved_answers_select_own"
on public.saved_answers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_answers_insert_own" on public.saved_answers;
create policy "saved_answers_insert_own"
on public.saved_answers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_answers_update_own" on public.saved_answers;
create policy "saved_answers_update_own"
on public.saved_answers
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_answers_delete_own" on public.saved_answers;
create policy "saved_answers_delete_own"
on public.saved_answers
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- New Supabase projects do not automatically expose SQL-created tables to the
-- Data API. Anonymous visitors keep using local storage; signed-in users get
-- only the CRUD privileges required by cloud sync, still constrained by RLS.
revoke all privileges on table
    public.profiles,
    public.problem_cases,
    public.practices,
    public.conversations,
    public.messages,
    public.reading_notes,
    public.reading_progress,
    public.highlights,
    public.saved_quotes,
    public.saved_answers
from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
    public.profiles,
    public.problem_cases,
    public.practices,
    public.conversations,
    public.messages,
    public.reading_notes,
    public.reading_progress,
    public.highlights,
    public.saved_quotes,
    public.saved_answers
to authenticated;
