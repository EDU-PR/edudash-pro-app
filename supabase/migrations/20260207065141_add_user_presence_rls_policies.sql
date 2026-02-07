-- Add RLS policies for user_presence table
-- Currently RLS is ENABLED but SELECT/UPDATE/DELETE policies are missing,
-- so authenticated users can write via SECURITY DEFINER RPC but cannot read.
-- This means presence is invisible to all chat participants.

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Authenticated users can read all presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can insert own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can update own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can delete own presence" ON public.user_presence;

-- 1. Allow all authenticated users to SELECT presence data
-- Presence is non-sensitive metadata (user_id, status, last_seen_at)
-- and must be readable by all app users for chat online indicators
CREATE POLICY "Authenticated users can read all presence"
    ON public.user_presence
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Allow users to INSERT their own presence row
CREATE POLICY "Users can insert own presence"
    ON public.user_presence
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to UPDATE their own presence row
CREATE POLICY "Users can update own presence"
    ON public.user_presence
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Allow users to DELETE their own presence row
CREATE POLICY "Users can delete own presence"
    ON public.user_presence
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Enable Realtime for user_presence so postgres_changes subscriptions work
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'user_presence'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
    END IF;
END $$;
