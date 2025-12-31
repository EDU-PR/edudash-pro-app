-- Fix AI Tier Access Control
-- Date: 2024-12-31
-- 
-- This migration ensures that only EduDash Pro platform super_admin users
-- have enterprise-level AI access. Organization admins (presidents, CEOs, etc.)
-- should have school_premium or school_pro based on their subscription.
--
-- The issue: SOA president and potentially other org admins were incorrectly
-- assigned 'enterprise' tier which gives them near-unlimited AI access.

BEGIN;

-- 1. Create a view to see current AI tier assignments (for debugging)
CREATE OR REPLACE VIEW public.v_user_ai_tier_audit AS
SELECT 
  p.id as user_id,
  p.email,
  p.role,
  COALESCE(p.full_name, p.first_name || ' ' || p.last_name) as display_name,
  uat.tier as current_ai_tier,
  uat.is_trial,
  uat.trial_end_date,
  o.name as organization_name,
  o.plan_tier as org_plan_tier,
  CASE 
    WHEN p.role IN ('super_admin', 'superadmin') THEN 'enterprise' -- Platform admins keep enterprise
    WHEN o.plan_tier = 'enterprise' THEN 'school_enterprise'
    WHEN o.plan_tier = 'pro' THEN 'school_pro'
    WHEN o.plan_tier = 'premium' THEN 'school_premium'
    WHEN o.plan_tier = 'starter' THEN 'school_starter'
    WHEN p.role IN ('principal', 'ceo', 'president', 'national_admin') THEN 'school_starter' -- Default for org admins
    WHEN p.role = 'teacher' THEN 'teacher_starter'
    WHEN p.role = 'parent' THEN 'parent_starter'
    ELSE 'free'
  END as recommended_tier
FROM public.profiles p
LEFT JOIN public.user_ai_tiers uat ON uat.user_id = p.id
LEFT JOIN public.organization_members om ON om.user_id = p.id
LEFT JOIN public.organizations o ON o.id = om.organization_id
WHERE uat.tier IS NOT NULL;

-- 2. Downgrade non-super_admin users from 'enterprise' to appropriate tier
-- This affects users who incorrectly have enterprise access
UPDATE public.user_ai_tiers
SET 
  tier = CASE 
    -- Map based on organization's actual plan if they have one
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p 
      JOIN public.organization_members om ON om.user_id = p.id
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE p.id = user_ai_tiers.user_id 
      AND o.plan_tier = 'enterprise'
    ) THEN 'school_enterprise'
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p 
      JOIN public.organization_members om ON om.user_id = p.id
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE p.id = user_ai_tiers.user_id 
      AND o.plan_tier = 'pro'
    ) THEN 'school_pro'
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p 
      JOIN public.organization_members om ON om.user_id = p.id
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE p.id = user_ai_tiers.user_id 
      AND o.plan_tier = 'premium'
    ) THEN 'school_premium'
    -- Default to school_starter for org admins without a paid plan
    ELSE 'school_starter'
  END,
  updated_at = now()
WHERE 
  tier = 'enterprise'
  AND user_id NOT IN (
    -- Keep enterprise ONLY for platform super_admin
    SELECT id FROM public.profiles 
    WHERE role IN ('super_admin', 'superadmin')
  );

-- 3. Add a comment for audit trail
COMMENT ON VIEW public.v_user_ai_tier_audit IS 
  'Audit view for checking user AI tier assignments vs recommended tiers based on role/org plan';

-- 4. Create a function to get the correct AI tier for a user based on their role and org
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

-- 5. Log the fix
DO $$
DECLARE
  v_fixed_count INTEGER;
BEGIN
  -- Count how many were fixed
  SELECT count(*) INTO v_fixed_count
  FROM public.user_ai_tiers
  WHERE tier != 'enterprise'
    AND updated_at >= now() - interval '1 minute';
  
  IF v_fixed_count > 0 THEN
    RAISE NOTICE 'AI tier fix: % user(s) downgraded from enterprise to appropriate tier', v_fixed_count;
  END IF;
END $$;

COMMIT;
