-- Migration: Align subscription_plans tier names with app canonical TierNameAligned type
--
-- Current DB state (verified via psql 2026-02-07):
--   subscription_plans.tier uses enum 'subscription_tier' 
--     Enum values: free, starter, premium, enterprise, parent-starter, parent-plus,
--       parent_starter, parent_plus, teacher_starter, teacher_pro,
--       school_starter, school_premium, school_pro, school_enterprise,
--       skills_starter, skills_premium, skills_enterprise, student_starter, student_pro
--   preschools.subscription_tier is TEXT (has 'professional', 'enterprise')
--   organizations.subscription_tier is TEXT (has 'starter')
--   profiles.subscription_tier uses enum 'tier_name_aligned' (already canonical)
--
-- Multiple CHECK constraints restrict tier values on text columns.
-- We must update those constraints BEFORE updating data.

-- ============================================================================
-- 0) Update CHECK constraints to allow new canonical tier names
-- ============================================================================

-- preschools.subscription_tier
ALTER TABLE public.preschools DROP CONSTRAINT IF EXISTS preschools_subscription_tier_check;
ALTER TABLE public.preschools ADD CONSTRAINT preschools_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY[
    'free', 'starter', 'professional', 'enterprise',
    'parent-starter', 'parent-plus',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus',
    'teacher_starter', 'teacher_pro',
    'skills_starter', 'skills_premium', 'skills_enterprise',
    'student_starter', 'student_pro'
  ]));

-- organizations.plan_tier
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_tier_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY[
    'free', 'starter', 'professional', 'enterprise',
    'parent-starter', 'parent-plus',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus',
    'teacher_starter', 'teacher_pro',
    'skills_starter', 'skills_premium', 'skills_enterprise'
  ]));

-- preschool_voice_usage.subscription_tier
ALTER TABLE public.preschool_voice_usage DROP CONSTRAINT IF EXISTS preschool_voice_usage_subscription_tier_check;
ALTER TABLE public.preschool_voice_usage ADD CONSTRAINT preschool_voice_usage_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY[
    'free', 'starter', 'professional', 'enterprise',
    'parent-starter', 'parent-plus',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus'
  ]));

-- school_ai_subscriptions.subscription_tier
ALTER TABLE public.school_ai_subscriptions DROP CONSTRAINT IF EXISTS school_ai_subscriptions_subscription_tier_check;
ALTER TABLE public.school_ai_subscriptions ADD CONSTRAINT school_ai_subscriptions_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY[
    'free', 'basic', 'pro', 'premium', 'enterprise',
    'parent-starter', 'parent-plus',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus',
    'teacher_starter', 'teacher_pro'
  ]));

-- standalone_users.subscription_tier
ALTER TABLE public.standalone_users DROP CONSTRAINT IF EXISTS standalone_users_subscription_tier_check;
ALTER TABLE public.standalone_users ADD CONSTRAINT standalone_users_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY[
    'free', 'starter', 'plus', 'premium', 'pro',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus',
    'teacher_starter', 'teacher_pro',
    'student_starter', 'student_pro'
  ]));

-- users.subscription_tier
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY[
    'free', 'premium', 'enterprise',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus',
    'teacher_starter', 'teacher_pro',
    'student_starter', 'student_pro'
  ]));

-- voice_usage_quotas.subscription_tier
ALTER TABLE public.voice_usage_quotas DROP CONSTRAINT IF EXISTS voice_usage_quotas_subscription_tier_check;
ALTER TABLE public.voice_usage_quotas ADD CONSTRAINT voice_usage_quotas_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY[
    'free', 'starter', 'professional', 'enterprise',
    'parent-starter', 'parent-plus',
    'school_starter', 'school_premium', 'school_pro', 'school_enterprise',
    'parent_starter', 'parent_plus',
    'teacher_starter', 'teacher_pro'
  ]));

-- ============================================================================
-- 1) Rename existing tiers in subscription_plans
--    Only values that actually exist in the subscription_tier enum:
--    starter → school_starter, premium → school_premium, enterprise → school_enterprise
-- ============================================================================

-- starter → school_starter (with correct prices)
UPDATE public.subscription_plans
SET tier = 'school_starter'::subscription_tier,
    name = 'School Starter',
    price_monthly = 299, price_annual = 2990,
    max_teachers = 5, max_students = 150,
    updated_at = now()
WHERE tier = 'starter'::subscription_tier AND is_active = true;

-- premium → school_premium
UPDATE public.subscription_plans
SET tier = 'school_premium'::subscription_tier,
    name = 'School Premium',
    price_monthly = 599, price_annual = 5990,
    max_teachers = 15, max_students = 500,
    updated_at = now()
WHERE tier = 'premium'::subscription_tier AND is_active = true;

-- enterprise → school_enterprise
UPDATE public.subscription_plans
SET tier = 'school_enterprise'::subscription_tier,
    name = 'School Enterprise',
    price_monthly = 1999, price_annual = 19990,
    max_teachers = 100, max_students = 2000,
    updated_at = now()
WHERE tier = 'enterprise'::subscription_tier AND is_active = true;

-- Insert school_pro plan if it doesn't exist
-- ('pro' is not in the subscription_tier enum, so no rename needed)
INSERT INTO public.subscription_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, is_active)
SELECT 'School Pro', 'school_pro'::subscription_tier, 999, 9990, 30, 1000, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE tier = 'school_pro'::subscription_tier AND is_active = true
);

-- Update Free plan seat limits to match pricing page
UPDATE public.subscription_plans
SET max_teachers = 2, max_students = 50, updated_at = now()
WHERE tier = 'free'::subscription_tier AND is_active = true;

-- Update parent plan prices to match pricing page
UPDATE public.subscription_plans
SET price_monthly = 99, price_annual = 950, updated_at = now()
WHERE tier = 'parent_starter'::subscription_tier AND is_active = true;

UPDATE public.subscription_plans
SET price_monthly = 199, price_annual = 1990, updated_at = now()
WHERE tier = 'parent_plus'::subscription_tier AND is_active = true;

-- ============================================================================
-- 2) Update preschools.subscription_tier (TEXT column)
-- ============================================================================
UPDATE public.preschools SET subscription_tier = 'school_starter'    WHERE subscription_tier IN ('starter', 'basic');
UPDATE public.preschools SET subscription_tier = 'school_premium'    WHERE subscription_tier = 'premium';
UPDATE public.preschools SET subscription_tier = 'school_pro'        WHERE subscription_tier IN ('pro', 'professional');
UPDATE public.preschools SET subscription_tier = 'school_enterprise' WHERE subscription_tier = 'enterprise';

-- ============================================================================
-- 3) Update organizations.subscription_tier (TEXT column)
-- ============================================================================
UPDATE public.organizations SET subscription_tier = 'school_starter'    WHERE subscription_tier IN ('starter', 'basic');
UPDATE public.organizations SET subscription_tier = 'school_premium'    WHERE subscription_tier = 'premium';
UPDATE public.organizations SET subscription_tier = 'school_pro'        WHERE subscription_tier IN ('pro', 'professional');
UPDATE public.organizations SET subscription_tier = 'school_enterprise' WHERE subscription_tier = 'enterprise';

-- Also update plan_tier column if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'plan_tier') THEN
    EXECUTE $sql$
      UPDATE public.organizations SET plan_tier = 'school_starter'    WHERE plan_tier IN ('starter', 'basic');
      UPDATE public.organizations SET plan_tier = 'school_premium'    WHERE plan_tier = 'premium';
      UPDATE public.organizations SET plan_tier = 'school_pro'        WHERE plan_tier IN ('pro', 'professional');
      UPDATE public.organizations SET plan_tier = 'school_enterprise' WHERE plan_tier = 'enterprise';
    $sql$;
  END IF;
END $$;

-- ============================================================================
-- 4) Update schools.subscription_tier (TEXT column) if any old values
-- ============================================================================
UPDATE public.schools SET subscription_tier = 'school_starter'    WHERE subscription_tier IN ('starter', 'basic');
UPDATE public.schools SET subscription_tier = 'school_premium'    WHERE subscription_tier = 'premium';
UPDATE public.schools SET subscription_tier = 'school_pro'        WHERE subscription_tier IN ('pro', 'professional');
UPDATE public.schools SET subscription_tier = 'school_enterprise' WHERE subscription_tier = 'enterprise';

-- ============================================================================
-- 5) Fix student plan prices (currently 9900/19900, likely should be 99/199)
-- ============================================================================
UPDATE public.subscription_plans
SET price_monthly = 99, price_annual = 990, updated_at = now()
WHERE tier = 'student_starter'::subscription_tier AND is_active = true AND price_monthly > 1000;

UPDATE public.subscription_plans
SET price_monthly = 199, price_annual = 1990, updated_at = now()
WHERE tier = 'student_pro'::subscription_tier AND is_active = true AND price_monthly > 1000;
