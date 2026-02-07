-- Migration: Align subscription_plans tier names with app canonical TierNameAligned type
-- 
-- Old DB tiers:  free, starter, basic, premium, pro, enterprise
-- New app tiers: free, parent_starter, parent_plus, school_starter, school_premium,
--                school_pro, school_enterprise
--
-- This migration:
--   1. Renames tier values in subscription_plans
--   2. Inserts parent plans that didn't exist before
--   3. Updates preschools.subscription_tier to match
--   4. Updates organizations.plan_tier to match
--   5. Updates profiles.subscription_tier to match
--
-- The normalizeTierName() function in the app handles both old and new names
-- during the transition period, so this is safe to run at any time.

BEGIN;

-- ============================================================================
-- 1) Rename tiers in subscription_plans (school billing plans)
-- ============================================================================
UPDATE public.subscription_plans 
SET tier = 'school_starter', name = 'School Starter', 
    price_monthly = 299, price_annual = 2990, max_teachers = 5, max_students = 150,
    updated_at = now()
WHERE tier = 'starter' AND is_active = true;

UPDATE public.subscription_plans 
SET tier = 'school_starter', name = 'School Starter',
    price_monthly = 299, price_annual = 2990, max_teachers = 5, max_students = 150,
    updated_at = now()
WHERE tier = 'basic' AND is_active = true;

UPDATE public.subscription_plans 
SET tier = 'school_premium', name = 'School Premium',
    price_monthly = 599, price_annual = 5990, max_teachers = 15, max_students = 500,
    updated_at = now()
WHERE tier = 'premium' AND is_active = true;

UPDATE public.subscription_plans 
SET tier = 'school_pro', name = 'School Pro',
    price_monthly = 999, price_annual = 9990, max_teachers = 30, max_students = 1000,
    updated_at = now()
WHERE tier = 'pro' AND is_active = true;

UPDATE public.subscription_plans 
SET tier = 'school_enterprise', name = 'School Enterprise',
    price_monthly = 1999, price_annual = 19990, max_teachers = 100, max_students = 2000,
    updated_at = now()
WHERE tier = 'enterprise' AND is_active = true;

-- Update Free plan seat limits to match pricing page
UPDATE public.subscription_plans
SET max_teachers = 2, max_students = 50, updated_at = now()
WHERE tier = 'free' AND is_active = true;

-- ============================================================================
-- 2) Insert parent plans if they don't already exist
-- ============================================================================
INSERT INTO public.subscription_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, is_active)
SELECT 'Parent Starter', 'parent_starter', 99, 950, 0, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE tier = 'parent_starter' AND is_active = true
);

INSERT INTO public.subscription_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, is_active)
SELECT 'Parent Plus', 'parent_plus', 199, 1910, 0, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE tier = 'parent_plus' AND is_active = true
);

-- ============================================================================
-- 3) Update preschools.subscription_tier to new names
-- ============================================================================
UPDATE public.preschools SET subscription_tier = 'school_starter'   WHERE subscription_tier IN ('starter', 'basic');
UPDATE public.preschools SET subscription_tier = 'school_premium'   WHERE subscription_tier = 'premium';
UPDATE public.preschools SET subscription_tier = 'school_pro'       WHERE subscription_tier = 'pro';
UPDATE public.preschools SET subscription_tier = 'school_enterprise' WHERE subscription_tier = 'enterprise';

-- ============================================================================
-- 4) Update organizations.plan_tier to new names
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'plan_tier') THEN
    EXECUTE $sql$
      UPDATE public.organizations SET plan_tier = 'school_starter'    WHERE plan_tier IN ('starter', 'basic');
      UPDATE public.organizations SET plan_tier = 'school_premium'    WHERE plan_tier = 'premium';
      UPDATE public.organizations SET plan_tier = 'school_pro'        WHERE plan_tier = 'pro';
      UPDATE public.organizations SET plan_tier = 'school_enterprise' WHERE plan_tier = 'enterprise';
    $sql$;
  END IF;
END $$;

-- ============================================================================
-- 5) Update profiles.subscription_tier to new names
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_tier') THEN
    EXECUTE $sql$
      UPDATE public.profiles SET subscription_tier = 'school_starter'    WHERE subscription_tier IN ('starter', 'basic');
      UPDATE public.profiles SET subscription_tier = 'school_premium'    WHERE subscription_tier = 'premium';
      UPDATE public.profiles SET subscription_tier = 'school_pro'        WHERE subscription_tier = 'pro';
      UPDATE public.profiles SET subscription_tier = 'school_enterprise' WHERE subscription_tier = 'enterprise';
    $sql$;
  END IF;
END $$;

-- ============================================================================
-- 6) Deactivate any duplicate old-named plans that were created before migration
-- ============================================================================
UPDATE public.subscription_plans 
SET is_active = false, updated_at = now()
WHERE tier IN ('starter', 'basic', 'premium', 'pro', 'enterprise') 
  AND is_active = true;

COMMIT;
