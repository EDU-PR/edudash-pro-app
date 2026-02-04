-- Verify exam_sessions schema + policies

-- Table existence
SELECT to_regclass('public.exam_sessions') AS exam_sessions_table;

-- Columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'exam_sessions'
ORDER BY ordinal_position;

-- RLS enabled?
SELECT c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'exam_sessions';

-- Policies
SELECT polname, polcmd, polpermissive
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'exam_sessions'
ORDER BY polname;

-- Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'exam_sessions'
ORDER BY indexname;
