-- Migration: Fix util_caller_principal_school() to support all principal-like roles
-- Problem:  The helper only matched role = 'principal' and only read preschool_id.
--           Principals with role 'principal_admin' or 'admin', or those whose school
--           is stored in organization_id instead of preschool_id, got NULL back.
--           This caused rpc_assign_teacher_seat (and any other RPC using this helper)
--           to fail with "Only principals can assign staff seats" → HTTP 400.
-- Fix:      Match role IN ('principal', 'principal_admin', 'admin') and use
--           COALESCE(preschool_id, organization_id).

CREATE OR REPLACE FUNCTION public.util_caller_principal_school()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT COALESCE(p.preschool_id, p.organization_id)
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'admin')
  LIMIT 1;
$$;
