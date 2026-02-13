-- =============================================================
-- Migration: push_devices RLS policies
-- Description: Adds missing RLS policies for push_devices table.
--   The table was created and RLS enabled via a standalone script
--   (db/20250916_push_devices.sql) but the policies were never
--   applied via Supabase migrations. This caused 42501 (RLS
--   violation) errors on all client operations.
-- =============================================================

-- Guard: only add policies if the table already exists
DO $$
BEGIN
  IF to_regclass('public.push_devices') IS NULL THEN
    RAISE NOTICE 'push_devices table does not exist — skipping policy creation';
    RETURN;
  END IF;

  -- Ensure RLS is enabled (idempotent)
  EXECUTE 'ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY';

  -- Drop + recreate to be fully idempotent
  EXECUTE 'DROP POLICY IF EXISTS push_devices_select_own ON public.push_devices';
  EXECUTE 'CREATE POLICY push_devices_select_own
           ON public.push_devices
           FOR SELECT
           USING (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS push_devices_insert_own ON public.push_devices';
  EXECUTE 'CREATE POLICY push_devices_insert_own
           ON public.push_devices
           FOR INSERT
           WITH CHECK (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS push_devices_update_own ON public.push_devices';
  EXECUTE 'CREATE POLICY push_devices_update_own
           ON public.push_devices
           FOR UPDATE
           USING (auth.uid() = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS push_devices_delete_own ON public.push_devices';
  EXECUTE 'CREATE POLICY push_devices_delete_own
           ON public.push_devices
           FOR DELETE
           USING (auth.uid() = user_id)';

  RAISE NOTICE 'push_devices RLS policies created successfully';
END
$$;
