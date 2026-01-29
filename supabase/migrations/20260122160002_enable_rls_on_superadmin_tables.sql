-- Migration: Enable RLS on superadmin tables and cleanup backup table
-- These tables should only be accessible by super_admins

DO $sql$
BEGIN
  -- Drop backup table that shouldn't exist in production
  IF to_regclass('public.user_ai_tiers_backup_20260101') IS NOT NULL THEN
    EXECUTE 'DROP TABLE IF EXISTS public.user_ai_tiers_backup_20260101';
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid,
      ADD COLUMN IF NOT EXISTS role text;

    CREATE OR REPLACE FUNCTION public.is_super_admin()
    RETURNS boolean
    LANGUAGE sql
    STABLE SECURITY DEFINER
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE auth_user_id = auth.uid()
        AND role = 'super_admin'
      )
    $$;
  END IF;

  IF to_regclass('public.superadmin_agent_executions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superadmin_agent_executions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_agent_executions_super_admin" ON public.superadmin_agent_executions';
    EXECUTE 'CREATE POLICY "superadmin_agent_executions_super_admin" ON public.superadmin_agent_executions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;

  IF to_regclass('public.superadmin_ai_agents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superadmin_ai_agents ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_ai_agents_super_admin" ON public.superadmin_ai_agents';
    EXECUTE 'CREATE POLICY "superadmin_ai_agents_super_admin" ON public.superadmin_ai_agents FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;

  IF to_regclass('public.superadmin_autonomous_tasks') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superadmin_autonomous_tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_autonomous_tasks_super_admin" ON public.superadmin_autonomous_tasks';
    EXECUTE 'CREATE POLICY "superadmin_autonomous_tasks_super_admin" ON public.superadmin_autonomous_tasks FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;

  IF to_regclass('public.superadmin_command_log') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superadmin_command_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_command_log_super_admin" ON public.superadmin_command_log';
    EXECUTE 'CREATE POLICY "superadmin_command_log_super_admin" ON public.superadmin_command_log FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;

  IF to_regclass('public.superadmin_integrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superadmin_integrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_integrations_super_admin" ON public.superadmin_integrations';
    EXECUTE 'CREATE POLICY "superadmin_integrations_super_admin" ON public.superadmin_integrations FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;

  IF to_regclass('public.superadmin_platform_insights') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superadmin_platform_insights ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "superadmin_platform_insights_super_admin" ON public.superadmin_platform_insights';
    EXECUTE 'CREATE POLICY "superadmin_platform_insights_super_admin" ON public.superadmin_platform_insights FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $sql$;

-- Verify all tables now have RLS enabled (best-effort)
DO $$
DECLARE
  disabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO disabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = false
    AND tablename NOT LIKE 'spatial_%';

  IF disabled_count > 0 THEN
    RAISE WARNING '% public tables still have RLS disabled', disabled_count;
  ELSE
    RAISE NOTICE '✓ All public tables now have RLS enabled';
  END IF;
END $$;
