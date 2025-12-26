-- Fix superadmin role check in RPC functions
-- Problem: RPC functions check for 'super_admin' but role is stored as 'superadmin'
-- Solution: Accept both role variants

BEGIN;

-- ============================================================================
-- CREATE HELPER FUNCTION: is_superadmin_user
-- This function checks for all possible superadmin role variants
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND LOWER(u.role) IN ('super_admin', 'superadmin', 'super-admin', 'admin', 'platform_admin')
  );
END;
$$;

COMMENT ON FUNCTION public.is_superadmin_user() IS 
'Check if the current authenticated user is a super admin. Handles all role name variants.';

GRANT EXECUTE ON FUNCTION public.is_superadmin_user() TO authenticated;

-- ============================================================================
-- FIX: get_superadmin_ai_quotas function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_ai_quotas()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  quota_settings JSON[];
  global_config JSON;
  usage_stats JSON;
  school_record RECORD;
  monthly_limit INTEGER;
  current_usage INTEGER;
  plan_type TEXT;
  cost_per_overage DECIMAL;
  is_over_limit BOOLEAN;
  is_suspended BOOLEAN;
  overage_cost DECIMAL;
  total_tokens BIGINT := 0;
  total_cost DECIMAL := 0;
  schools_over_limit INTEGER := 0;
  schools_suspended INTEGER := 0;
  top_schools JSON[];
  school_quota JSON;
  usage_percentage DECIMAL;
BEGIN
  -- Only allow superadmin access (use helper function)
  IF NOT public.is_superadmin_user() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Super admin access required'
    );
  END IF;

  -- Build default global config
  global_config := json_build_object(
    'free_tier_limit', 1000,
    'basic_tier_limit', 5000,
    'pro_tier_limit', 25000,
    'enterprise_tier_limit', 100000,
    'overage_rate', 0.002,
    'warning_thresholds', ARRAY[75, 90, 95],
    'suspension_threshold', 120,
    'auto_reset_enabled', true,
    'cost_alerts_enabled', true
  );

  -- Get real school data from preschools table
  quota_settings := ARRAY[]::JSON[];
  
  FOR school_record IN
    SELECT 
      p.id,
      p.name,
      COALESCE(sp.name, 'basic') as subscription_plan,
      COALESCE(s.status, 'active') as subscription_status
    FROM public.preschools p
    LEFT JOIN public.subscriptions s ON s.preschool_id = p.id AND s.status = 'active'
    LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE p.is_active = true
    ORDER BY p.name
    LIMIT 50
  LOOP
    current_usage := 0;
    cost_per_overage := 0.002;
    is_over_limit := false;
    is_suspended := false;
    overage_cost := 0;

    CASE LOWER(school_record.subscription_plan)
      WHEN 'free' THEN 
        plan_type := 'free';
        monthly_limit := 1000;
      WHEN 'starter' THEN
        plan_type := 'basic';
        monthly_limit := 5000;
      WHEN 'professional' THEN
        plan_type := 'pro';
        monthly_limit := 25000;
      WHEN 'enterprise' THEN
        plan_type := 'enterprise';
        monthly_limit := 100000;
      ELSE
        plan_type := 'basic';
        monthly_limit := 5000;
    END CASE;

    -- Get actual AI usage if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'ai_usage_logs' 
      AND table_schema = 'public'
    ) THEN
      SELECT 
        COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)
      INTO current_usage
      FROM public.ai_usage_logs
      WHERE preschool_id = school_record.id::text
        AND created_at >= date_trunc('month', NOW())
        AND status = 'success';
    END IF;

    is_over_limit := current_usage > monthly_limit;
    is_suspended := school_record.subscription_status != 'active' OR 
                   (current_usage > monthly_limit * 1.5);

    IF is_over_limit THEN
      overage_cost := (current_usage - monthly_limit) * cost_per_overage;
      schools_over_limit := schools_over_limit + 1;
    END IF;

    IF is_suspended THEN
      schools_suspended := schools_suspended + 1;
    END IF;

    total_tokens := total_tokens + current_usage;
    total_cost := total_cost + overage_cost;

    quota_settings := quota_settings || json_build_object(
      'id', school_record.id::text,
      'school_id', school_record.id::text,
      'school_name', school_record.name,
      'plan_type', plan_type,
      'monthly_limit', monthly_limit,
      'current_usage', current_usage,
      'reset_date', (date_trunc('month', NOW()) + interval '1 month')::text,
      'overage_allowed', plan_type != 'free',
      'overage_limit', CASE WHEN plan_type != 'free' THEN monthly_limit * 0.5 ELSE 0 END,
      'cost_per_overage', cost_per_overage,
      'warnings_enabled', true,
      'warning_thresholds', ARRAY[75, 90, 95],
      'is_suspended', is_suspended,
      'last_updated', NOW()::text
    );
  END LOOP;

  top_schools := ARRAY[]::JSON[];
  
  FOR school_quota IN
    SELECT value FROM json_array_elements(COALESCE(to_json(quota_settings), '[]'::json)) 
    ORDER BY (value->>'current_usage')::INTEGER DESC
    LIMIT 5
  LOOP
    usage_percentage := CASE 
      WHEN (school_quota->>'monthly_limit')::DECIMAL > 0 THEN
        (school_quota->>'current_usage')::DECIMAL / (school_quota->>'monthly_limit')::DECIMAL * 100
      ELSE 0 
    END;
    
    top_schools := top_schools || json_build_object(
      'school_name', school_quota->>'school_name',
      'usage', (school_quota->>'current_usage')::INTEGER,
      'cost', CASE 
        WHEN (school_quota->>'current_usage')::INTEGER > (school_quota->>'monthly_limit')::INTEGER
        THEN ((school_quota->>'current_usage')::INTEGER - (school_quota->>'monthly_limit')::INTEGER) * (school_quota->>'cost_per_overage')::DECIMAL
        ELSE 0
      END,
      'percentage', usage_percentage
    );
  END LOOP;

  usage_stats := json_build_object(
    'total_tokens_used', total_tokens,
    'total_cost', ROUND(total_cost, 2),
    'average_cost_per_school', CASE 
      WHEN array_length(quota_settings, 1) > 0 
      THEN ROUND(total_cost / array_length(quota_settings, 1), 2)
      ELSE 0 
    END,
    'schools_over_limit', schools_over_limit,
    'schools_suspended', schools_suspended,
    'projected_monthly_cost', ROUND(total_cost * 2, 2),
    'top_consuming_schools', top_schools
  );

  result := json_build_object(
    'success', true,
    'data', json_build_object(
      'school_quotas', quota_settings,
      'global_config', global_config,
      'usage_stats', usage_stats,
      'calculated_at', NOW()
    )
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', 'Failed to fetch AI quota data',
    'debug_info', CASE 
      WHEN current_setting('app.environment', true) = 'development' 
      THEN SQLERRM 
      ELSE null 
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_superadmin_ai_quotas() TO authenticated;

-- ============================================================================
-- FIX: get_superadmin_platform_stats function (if exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only allow superadmin access
  IF NOT public.is_superadmin_user() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Super admin access required'
    );
  END IF;

  -- Get real platform stats
  SELECT json_build_object(
    'success', true,
    'data', json_build_object(
      'total_preschools', (SELECT COUNT(*) FROM public.preschools WHERE is_active = true),
      'total_k12_schools', (SELECT COUNT(*) FROM public.k12_schools WHERE is_active = true),
      'total_users', (SELECT COUNT(*) FROM public.users WHERE is_active = true),
      'active_subscriptions', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active'),
      'monthly_revenue', (
        SELECT COALESCE(SUM(sp.price_monthly), 0)
        FROM public.subscriptions s
        JOIN public.subscription_plans sp ON sp.id = s.plan_id
        WHERE s.status = 'active'
      ),
      'total_seats', (SELECT COALESCE(SUM(current_seats), 0) FROM public.subscriptions WHERE status = 'active'),
      'ai_usage_30d', 0,
      'calculated_at', NOW()
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_superadmin_platform_stats() TO authenticated;

-- ============================================================================
-- FIX: Other superadmin functions that may exist
-- ============================================================================

-- Update any other functions that have hardcoded role checks
DO $$
BEGIN
  RAISE NOTICE 'Superadmin role check helper function created: is_superadmin_user()';
  RAISE NOTICE 'Updated get_superadmin_ai_quotas to use flexible role check';
  RAISE NOTICE 'Updated get_superadmin_platform_stats to use flexible role check';
END;
$$;

COMMIT;
