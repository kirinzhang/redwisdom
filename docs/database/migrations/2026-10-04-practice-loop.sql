-- 调查清单与矛盾分析画布：问题档案新增两列。
-- 已有数据库执行一次即可；新建数据库直接使用 supabase-schema.sql。
alter table public.problem_cases
    add column if not exists investigations jsonb not null default '[]'::jsonb,
    add column if not exists contradiction_map jsonb not null default '{}'::jsonb;
