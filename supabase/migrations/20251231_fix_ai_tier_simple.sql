-- Fix AI Tier Access Control (Simplified)
-- Date: 2024-12-31
-- 
-- Ensures only super_admin users have 'enterprise' tier access.
-- Others with 'enterprise' are downgraded to 'school_starter'.

BEGIN;

-- First, let's see who currently has enterprise tier
-- (Run this as a SELECT first to verify, then uncomment the UPDATE)

-- SELECT p.id, p.email, p.role, uat.tier
-- FROM public.profiles p
-- JOIN public.user_ai_tiers uat ON uat.user_id = p.id
-- WHERE uat.tier = 'enterprise';

-- Downgrade all non-super_admin users from 'enterprise' to 'school_starter'
UPDATE public.user_ai_tiers
SET 
  tier = 'school_starter',
  updated_at = now()
WHERE 
  tier = 'enterprise'
  AND user_id NOT IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('super_admin', 'superadmin')
  );

-- Create a function to get the correct AI tier for a user
CREATE OR REPLACE FUNCTION public.get_recommended_ai_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_org_plan TEXT;
BEGIN
  -- Get user role
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  
  -- Platform super_admin always gets enterprise
  IF v_role IN ('super_admin', 'superadmin') THEN
    RETURN 'enterprise';
  END IF;
  
  -- Check organization plan
  SELECT o.plan_tier INTO v_org_plan
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
  LIMIT 1;
  
  -- Map org plan to AI tier
  IF v_org_plan = 'enterprise' THEN RETURN 'school_enterprise'; END IF;
  IF v_org_plan = 'pro' THEN RETURN 'school_pro'; END IF;
  IF v_org_plan = 'premium' THEN RETURN 'school_premium'; END IF;
  IF v_org_plan = 'starter' THEN RETURN 'school_starter'; END IF;
  
  -- Role-based defaults for users without org plan
  CASE v_role
    WHEN 'principal' THEN RETURN 'school_starter';
    WHEN 'ceo' THEN RETURN 'school_starter';
    WHEN 'president' THEN RETURN 'school_starter';
    WHEN 'national_admin' THEN RETURN 'school_starter';
    WHEN 'teacher' THEN RETURN 'teacher_starter';
    WHEN 'parent' THEN RETURN 'parent_starter';
    ELSE RETURN 'free';
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
