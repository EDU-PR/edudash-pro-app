-- ============================================================================
-- Fix Security Definer Views (CRITICAL)
-- ============================================================================
-- Supabase Dashboard flags all 14 views as CRITICAL because they default to
-- SECURITY DEFINER (view owner's permissions), which bypasses RLS.
--
-- Setting security_invoker = true makes views execute queries using the
-- CALLER's permissions, so RLS policies are properly enforced.
--
-- This is a non-destructive change — view definitions are not modified,
-- only the security context is updated.
-- ============================================================================

-- 1. classes_with_teachers
ALTER VIEW IF EXISTS public.classes_with_teachers
    SET (security_invoker = true);

-- 2. daily_ai_usage_rollup
ALTER VIEW IF EXISTS public.daily_ai_usage_rollup
    SET (security_invoker = true);

-- 3. delivery_analytics
ALTER VIEW IF EXISTS public.delivery_analytics
    SET (security_invoker = true);

-- 4. duplicate_aftercare_registrations
ALTER VIEW IF EXISTS public.duplicate_aftercare_registrations
    SET (security_invoker = true);

-- 5. monthly_ai_usage_rollup
ALTER VIEW IF EXISTS public.monthly_ai_usage_rollup
    SET (security_invoker = true);

-- 6. principal_financial_summary
ALTER VIEW IF EXISTS public.principal_financial_summary
    SET (security_invoker = true);

-- 7. school_daily_ai_usage
ALTER VIEW IF EXISTS public.school_daily_ai_usage
    SET (security_invoker = true);

-- 8. teacher_rating_summary
ALTER VIEW IF EXISTS public.teacher_rating_summary
    SET (security_invoker = true);

-- 9. teacher_stats
ALTER VIEW IF EXISTS public.teacher_stats
    SET (security_invoker = true);

-- 10. teachers_resolved
ALTER VIEW IF EXISTS public.teachers_resolved
    SET (security_invoker = true);

-- 11. template_performance_metrics (flagged as "performance_metrics")
ALTER VIEW IF EXISTS public.template_performance_metrics
    SET (security_invoker = true);

-- 12. user_organizations
ALTER VIEW IF EXISTS public.user_organizations
    SET (security_invoker = true);

-- 13. user_profiles_with_tier
ALTER VIEW IF EXISTS public.user_profiles_with_tier
    SET (security_invoker = true);

-- 14. user_subscription_info
ALTER VIEW IF EXISTS public.user_subscription_info
    SET (security_invoker = true);
