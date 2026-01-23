-- Migration: Enable RLS on superadmin tables and cleanup backup table
-- These tables should only be accessible by super_admins

-- Drop backup table that shouldn't exist in production
DROP TABLE IF EXISTS public.user_ai_tiers_backup_20260101;

-- Enable RLS on all superadmin tables
ALTER TABLE IF EXISTS public.superadmin_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.superadmin_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.superadmin_autonomous_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.superadmin_command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.superadmin_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.superadmin_platform_insights ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if current user is super_admin
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

-- Create policies for superadmin_agent_executions
DROP POLICY IF EXISTS "superadmin_agent_executions_super_admin" ON public.superadmin_agent_executions;
CREATE POLICY "superadmin_agent_executions_super_admin" ON public.superadmin_agent_executions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Create policies for superadmin_ai_agents
DROP POLICY IF EXISTS "superadmin_ai_agents_super_admin" ON public.superadmin_ai_agents;
CREATE POLICY "superadmin_ai_agents_super_admin" ON public.superadmin_ai_agents
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Create policies for superadmin_autonomous_tasks
DROP POLICY IF EXISTS "superadmin_autonomous_tasks_super_admin" ON public.superadmin_autonomous_tasks;
CREATE POLICY "superadmin_autonomous_tasks_super_admin" ON public.superadmin_autonomous_tasks
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Create policies for superadmin_command_log
DROP POLICY IF EXISTS "superadmin_command_log_super_admin" ON public.superadmin_command_log;
CREATE POLICY "superadmin_command_log_super_admin" ON public.superadmin_command_log
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Create policies for superadmin_integrations
DROP POLICY IF EXISTS "superadmin_integrations_super_admin" ON public.superadmin_integrations;
CREATE POLICY "superadmin_integrations_super_admin" ON public.superadmin_integrations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Create policies for superadmin_platform_insights
DROP POLICY IF EXISTS "superadmin_platform_insights_super_admin" ON public.superadmin_platform_insights;
CREATE POLICY "superadmin_platform_insights_super_admin" ON public.superadmin_platform_insights
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Verify all tables now have RLS enabled
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
