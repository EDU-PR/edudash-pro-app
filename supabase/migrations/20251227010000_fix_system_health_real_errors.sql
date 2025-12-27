-- ============================================================================
-- Fix System Health Check to Report Real Errors
-- Date: 2025-12-27
-- Issue: Health check was swallowing errors and always returning "healthy"
-- ============================================================================

BEGIN;

-- ============================================================================
-- Replace get_system_health_metrics with version that reports real errors
-- ============================================================================

CREATE OR REPLACE FUNCTION get_system_health_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  db_connections INTEGER := 0;
  db_max_connections INTEGER := 100;
  storage_size_bytes BIGINT := 0;
  total_users INTEGER := 0;
  active_users INTEGER := 0;
  recent_errors INTEGER := 0;
  rls_errors INTEGER := 0;
  api_errors INTEGER := 0;
  overall_status TEXT := 'healthy';
  issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin_safe() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: Superadmin privileges required'
    );
  END IF;

  -- Get database connection info
  BEGIN
    SELECT COALESCE(setting::integer, 100) 
    INTO db_max_connections
    FROM pg_settings WHERE name = 'max_connections';
    
    SELECT COUNT(*) INTO db_connections
    FROM pg_stat_activity WHERE state = 'active';
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Unable to query connection stats: ' || SQLERRM);
  END;

  -- Get database size
  BEGIN
    SELECT pg_database_size(current_database()) INTO storage_size_bytes;
  EXCEPTION WHEN OTHERS THEN
    storage_size_bytes := 0;
    issues := array_append(issues, 'Unable to query database size');
  END;

  -- Get user statistics from profiles (not users, to avoid RLS issues)
  BEGIN
    SELECT COUNT(*) INTO total_users FROM public.profiles;
    
    SELECT COUNT(*) INTO active_users
    FROM public.profiles 
    WHERE updated_at > NOW() - INTERVAL '7 days';
  EXCEPTION WHEN OTHERS THEN
    issues := array_append(issues, 'Unable to query user stats: ' || SQLERRM);
  END;

  -- Check for recent errors in error_logs table
  BEGIN
    SELECT COUNT(*) INTO recent_errors
    FROM public.error_logs
    WHERE timestamp > NOW() - INTERVAL '24 hours';
  EXCEPTION WHEN undefined_table THEN
    recent_errors := 0; -- Table doesn't exist, that's OK
  WHEN OTHERS THEN
    issues := array_append(issues, 'Unable to query error logs: ' || SQLERRM);
  END;

  -- Check for RLS policy errors by testing key tables
  BEGIN
    -- Test profiles access
    PERFORM COUNT(*) FROM public.profiles WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    rls_errors := rls_errors + 1;
    issues := array_append(issues, 'RLS error on profiles: ' || SQLERRM);
  END;

  BEGIN
    -- Test preschools access
    PERFORM COUNT(*) FROM public.preschools LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    rls_errors := rls_errors + 1;
    issues := array_append(issues, 'RLS error on preschools: ' || SQLERRM);
  END;

  BEGIN
    -- Test subscriptions access
    PERFORM COUNT(*) FROM public.subscriptions LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    rls_errors := rls_errors + 1;
    issues := array_append(issues, 'RLS error on subscriptions: ' || SQLERRM);
  END;

  BEGIN
    -- Test announcements access
    PERFORM COUNT(*) FROM public.announcements LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    NULL; -- Table doesn't exist, that's OK
  WHEN OTHERS THEN
    rls_errors := rls_errors + 1;
    issues := array_append(issues, 'RLS error on announcements: ' || SQLERRM);
  END;

  -- Determine overall status based on findings
  IF rls_errors > 0 THEN
    overall_status := 'critical';
    issues := array_append(issues, format('%s RLS policy errors detected', rls_errors));
  ELSIF db_connections >= db_max_connections * 0.95 THEN
    overall_status := 'critical';
    issues := array_append(issues, 'Database connections at critical level');
  ELSIF recent_errors > 100 THEN
    overall_status := 'critical';
    issues := array_append(issues, format('%s errors in last 24 hours', recent_errors));
  ELSIF db_connections >= db_max_connections * 0.8 THEN
    overall_status := 'degraded';
    issues := array_append(issues, 'Database connections elevated');
  ELSIF recent_errors > 20 THEN
    overall_status := 'degraded';
    issues := array_append(issues, format('%s errors in last 24 hours', recent_errors));
  ELSIF array_length(issues, 1) > 0 THEN
    overall_status := 'warning';
  END IF;

  -- Build comprehensive result
  result := json_build_object(
    'success', true,
    'data', json_build_object(
      'overall_status', overall_status,
      'database_status', CASE 
        WHEN db_connections < db_max_connections * 0.8 THEN 'healthy'
        WHEN db_connections < db_max_connections * 0.95 THEN 'degraded'
        ELSE 'critical'
      END,
      'database_connections', db_connections,
      'database_max_connections', db_max_connections,
      'connection_usage_percent', ROUND((db_connections::numeric / GREATEST(db_max_connections, 1) * 100)::numeric, 1),
      'storage_used_bytes', storage_size_bytes,
      'storage_used_gb', ROUND((COALESCE(storage_size_bytes, 0)::numeric / (1024*1024*1024))::numeric, 2),
      'total_users', total_users,
      'active_users_7d', active_users,
      'recent_errors_24h', recent_errors,
      'rls_errors', rls_errors,
      'rls_status', CASE WHEN rls_errors = 0 THEN 'healthy' ELSE 'error' END,
      'issues', issues,
      'issues_count', COALESCE(array_length(issues, 1), 0),
      'uptime_seconds', EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())),
      'last_check', NOW()
    ),
    'generated_at', NOW()
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_system_health_metrics() IS 
  'Get comprehensive system health metrics. Reports real errors instead of swallowing them. Checks RLS policy health, database connections, and error rates.';

GRANT EXECUTE ON FUNCTION get_system_health_metrics() TO authenticated;

-- ============================================================================
-- Log migration completion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ FIXED SYSTEM HEALTH CHECK';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Health check now reports real errors';
  RAISE NOTICE 'Checks RLS policy health on key tables';
  RAISE NOTICE 'Returns issues array with specific problems';
END;
$$;

COMMIT;
