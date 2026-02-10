-- SuperAdmin AI Command Center: real execution engine
-- Replaces mock/fake completion flow with backend-processed executions.

CREATE OR REPLACE FUNCTION public.get_superadmin_ai_agents()
RETURNS TABLE(
  id text,
  name text,
  description text,
  agent_type text,
  status text,
  configuration jsonb,
  last_run_at timestamptz,
  last_run_status text,
  success_rate numeric,
  total_runs integer,
  last_execution_duration_ms integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.agent_type,
    a.status,
    a.configuration,
    a.last_run_at,
    a.last_run_status,
    a.success_rate,
    a.total_runs,
    (
      SELECT
        CASE
          WHEN e.finished_at IS NULL OR e.started_at IS NULL THEN NULL
          ELSE LEAST(
            2147483647,
            GREATEST(0, ROUND(EXTRACT(EPOCH FROM (e.finished_at - e.started_at)) * 1000)::bigint)
          )::integer
        END
      FROM public.superadmin_agent_executions e
      WHERE e.agent_id = a.id
      ORDER BY e.started_at DESC NULLS LAST
      LIMIT 1
    ) AS last_execution_duration_ms
  FROM public.superadmin_ai_agents a
  ORDER BY
    CASE a.status
      WHEN 'running' THEN 1
      WHEN 'active' THEN 2
      WHEN 'idle' THEN 3
      WHEN 'error' THEN 4
      ELSE 5
    END,
    a.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_autonomous_tasks()
RETURNS TABLE(
  id text,
  name text,
  description text,
  task_type text,
  schedule_cron text,
  is_enabled boolean,
  last_execution_at timestamptz,
  next_execution_at timestamptz,
  last_execution_status text,
  configuration jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.task_type,
    t.schedule_cron,
    t.is_enabled,
    t.last_execution_at,
    t.next_execution_at,
    t.last_execution_status,
    t.configuration
  FROM public.superadmin_autonomous_tasks t
  ORDER BY t.is_enabled DESC, t.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_integrations()
RETURNS TABLE(
  id text,
  name text,
  integration_type text,
  is_enabled boolean,
  configuration jsonb,
  last_sync_at timestamptz,
  last_sync_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.name,
    i.integration_type,
    i.is_enabled,
    i.configuration,
    i.last_sync_at,
    i.last_sync_status
  FROM public.superadmin_integrations i
  ORDER BY i.is_enabled DESC, i.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_platform_insights(limit_count integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  insight_type text,
  priority text,
  title text,
  description text,
  data jsonb,
  action_label text,
  action_route text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.insight_type,
    i.priority,
    i.title,
    i.description,
    i.data,
    i.action_label,
    i.action_route,
    i.created_at
  FROM public.superadmin_platform_insights i
  WHERE i.is_dismissed = false
    AND (i.expires_at IS NULL OR i.expires_at > now())
  ORDER BY
    CASE i.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      ELSE 4
    END,
    i.created_at DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_superadmin_agent(agent_id_param text, new_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  IF new_status NOT IN ('active', 'idle', 'disabled') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE public.superadmin_ai_agents
  SET status = new_status, updated_at = now()
  WHERE id = agent_id_param;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_superadmin_task(task_id_param text, is_enabled_param boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  UPDATE public.superadmin_autonomous_tasks
  SET is_enabled = is_enabled_param, updated_at = now()
  WHERE id = task_id_param;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_superadmin_agent_execution(execution_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_execution public.superadmin_agent_executions%ROWTYPE;
  v_agent public.superadmin_ai_agents%ROWTYPE;
  v_started timestamptz := now();
  v_finished timestamptz;
  v_steps jsonb := '[]'::jsonb;
  v_result jsonb := '{}'::jsonb;
  v_summary text := '';
  v_error text;
  v_total_runs integer;
  v_successful_runs integer;

  v_active_subscriptions integer := 0;
  v_trialing_subscriptions integer := 0;
  v_revenue_monthly numeric := 0;
  v_ai_tokens_30d bigint := 0;
  v_ai_cost_30d numeric := 0;
  v_error_24h integer := 0;
  v_error_7d integer := 0;
  v_inactive_profiles integer := 0;
  v_orphan_profiles integer := 0;
  v_integrations_enabled integer := 0;
  v_integrations_problem integer := 0;
  v_trials_ending_7d integer := 0;
  v_pending_deletion_requests integer := 0;
  v_top_service text := null;
  v_top_service_tokens bigint := 0;
BEGIN
  IF NOT public.is_super_admin()
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Super admin access required'
    );
  END IF;

  SELECT *
  INTO v_execution
  FROM public.superadmin_agent_executions
  WHERE id = execution_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Execution not found',
      'execution_id', execution_id_param
    );
  END IF;

  SELECT *
  INTO v_agent
  FROM public.superadmin_ai_agents
  WHERE id = v_execution.agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.superadmin_agent_executions
    SET status = 'failed', finished_at = now(), error_message = 'Agent not found'
    WHERE id = execution_id_param;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found',
      'execution_id', execution_id_param
    );
  END IF;

  IF v_execution.status IN ('completed', 'failed', 'cancelled', 'timeout') THEN
    RETURN jsonb_build_object(
      'success', v_execution.status = 'completed',
      'execution_id', v_execution.id,
      'status', v_execution.status,
      'result', v_execution.result,
      'error', v_execution.error_message
    );
  END IF;

  UPDATE public.superadmin_agent_executions
  SET
    status = 'running',
    started_at = COALESCE(started_at, v_started),
    error_message = NULL
  WHERE id = execution_id_param;

  UPDATE public.superadmin_ai_agents
  SET
    status = 'running',
    last_run_at = v_started,
    updated_at = v_started
  WHERE id = v_agent.id;

  v_steps := v_steps || jsonb_build_array(
    jsonb_build_object('step', 'start', 'status', 'completed', 'at', now())
  );

  -- Shared metrics used by multiple agent types
  SELECT COUNT(*) INTO v_active_subscriptions
  FROM public.subscriptions s
  WHERE s.status::text = 'active';

  SELECT COUNT(*) INTO v_trialing_subscriptions
  FROM public.subscriptions s
  WHERE s.status::text = 'trialing';

  SELECT COALESCE(SUM(
    CASE
      WHEN s.billing_frequency::text = 'annual' AND sp.price_annual IS NOT NULL THEN sp.price_annual / 12.0
      ELSE COALESCE(sp.price_monthly, 0)
    END
  ), 0)
  INTO v_revenue_monthly
  FROM public.subscriptions s
  LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.status::text IN ('active', 'trialing');

  SELECT COALESCE(SUM(COALESCE(l.input_tokens, 0) + COALESCE(l.output_tokens, 0)), 0)::bigint,
         COALESCE(SUM(COALESCE(l.total_cost, 0)), 0)
  INTO v_ai_tokens_30d, v_ai_cost_30d
  FROM public.ai_usage_logs l
  WHERE l.created_at >= now() - interval '30 days';

  SELECT l.service_type,
         COALESCE(SUM(COALESCE(l.input_tokens, 0) + COALESCE(l.output_tokens, 0)), 0)::bigint
  INTO v_top_service, v_top_service_tokens
  FROM public.ai_usage_logs l
  WHERE l.created_at >= now() - interval '30 days'
  GROUP BY l.service_type
  ORDER BY SUM(COALESCE(l.input_tokens, 0) + COALESCE(l.output_tokens, 0)) DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_error_24h
  FROM public.error_logs e
  WHERE COALESCE(e.created_at, e."timestamp") >= now() - interval '24 hours'
    AND lower(COALESCE(e.level, '')) IN ('error', 'critical', 'fatal');

  SELECT COUNT(*) INTO v_error_7d
  FROM public.error_logs e
  WHERE COALESCE(e.created_at, e."timestamp") >= now() - interval '7 days'
    AND lower(COALESCE(e.level, '')) IN ('error', 'critical', 'fatal');

  SELECT COUNT(*) INTO v_inactive_profiles
  FROM public.profiles p
  WHERE COALESCE(p.is_active, true) = false;

  SELECT COUNT(*) INTO v_orphan_profiles
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = COALESCE(p.auth_user_id, p.id)
  WHERE au.id IS NULL;

  SELECT COUNT(*) INTO v_integrations_enabled
  FROM public.superadmin_integrations i
  WHERE i.is_enabled = true;

  SELECT COUNT(*) INTO v_integrations_problem
  FROM public.superadmin_integrations i
  WHERE i.is_enabled = true
    AND COALESCE(lower(i.last_sync_status), '') NOT IN ('success', 'ok', 'healthy', 'connected');

  SELECT COUNT(*) INTO v_trials_ending_7d
  FROM public.profiles p
  WHERE COALESCE(p.is_trial, false) = true
    AND COALESCE(p.trial_ends_at, p.trial_end_date) IS NOT NULL
    AND COALESCE(p.trial_ends_at, p.trial_end_date) >= now()
    AND COALESCE(p.trial_ends_at, p.trial_end_date) <= now() + interval '7 days';

  SELECT COUNT(*) INTO v_pending_deletion_requests
  FROM public.superadmin_user_deletion_requests r
  WHERE r.status IN ('pending', 'in_progress');

  v_steps := v_steps || jsonb_build_array(
    jsonb_build_object('step', 'collect_metrics', 'status', 'completed', 'at', now())
  );

  CASE v_agent.agent_type
    WHEN 'security_scanning' THEN
      v_summary := format(
        'Security scan complete: %s critical errors (24h), %s integration sync issues.',
        v_error_24h, v_integrations_problem
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'critical_errors_24h', v_error_24h,
          'critical_errors_7d', v_error_7d,
          'integrations_enabled', v_integrations_enabled,
          'integrations_with_issues', v_integrations_problem
        ),
        'risk_level', CASE WHEN v_error_24h > 10 THEN 'critical' WHEN v_error_24h > 0 THEN 'elevated' ELSE 'normal' END
      );

      IF v_error_24h > 0 THEN
        INSERT INTO public.superadmin_platform_insights (
          insight_type, priority, title, description, data, action_label, action_route, expires_at
        )
        SELECT
          'warning',
          CASE WHEN v_error_24h > 10 THEN 'critical' ELSE 'high' END,
          'Security scanner detected elevated error volume',
          format('%s critical errors were logged in the last 24 hours.', v_error_24h),
          jsonb_build_object('errors_24h', v_error_24h, 'errors_7d', v_error_7d),
          'Open System Monitoring',
          '/screens/super-admin-system-monitoring',
          now() + interval '3 days'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.superadmin_platform_insights i
          WHERE i.title = 'Security scanner detected elevated error volume'
            AND i.created_at >= now() - interval '6 hours'
            AND i.is_dismissed = false
        );
      END IF;

    WHEN 'usage_optimization' THEN
      v_summary := format(
        'Usage optimization complete: %s tokens and %s cost in the last 30 days.',
        v_ai_tokens_30d, to_char(v_ai_cost_30d, 'FM999999990.00')
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'tokens_30d', v_ai_tokens_30d,
          'cost_30d', round(v_ai_cost_30d, 2),
          'top_service_type', COALESCE(v_top_service, 'n/a'),
          'top_service_tokens', v_top_service_tokens
        ),
        'recommendation', CASE
          WHEN v_ai_cost_30d > 500 THEN 'Review model routing and enable stricter tool gating.'
          WHEN v_ai_cost_30d > 100 THEN 'Monitor service mix and optimize prompts for token efficiency.'
          ELSE 'Current usage is within normal operating range.'
        END
      );

    WHEN 'churn_prediction' THEN
      v_summary := format(
        'Churn scan complete: %s active subscriptions, %s trialing, %s trials ending within 7 days.',
        v_active_subscriptions, v_trialing_subscriptions, v_trials_ending_7d
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'active_subscriptions', v_active_subscriptions,
          'trialing_subscriptions', v_trialing_subscriptions,
          'trials_ending_7d', v_trials_ending_7d
        ),
        'at_risk_score', LEAST(100, GREATEST(0, (v_trials_ending_7d * 10) + (v_trialing_subscriptions * 3)))
      );

      IF v_trials_ending_7d > 0 THEN
        INSERT INTO public.superadmin_platform_insights (
          insight_type, priority, title, description, data, action_label, action_route, expires_at
        )
        SELECT
          'action',
          'high',
          'Trial subscriptions approaching expiry',
          format('%s trial accounts are ending within 7 days.', v_trials_ending_7d),
          jsonb_build_object('trials_ending_7d', v_trials_ending_7d),
          'Review Organizations',
          '/screens/super-admin-organizations',
          now() + interval '7 days'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.superadmin_platform_insights i
          WHERE i.title = 'Trial subscriptions approaching expiry'
            AND i.created_at >= now() - interval '12 hours'
            AND i.is_dismissed = false
        );
      END IF;

    WHEN 'revenue_forecasting' THEN
      v_summary := format(
        'Revenue forecast refreshed: estimated monthly recurring revenue is %s.',
        to_char(v_revenue_monthly, 'FM999999990.00')
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'estimated_mrr', round(v_revenue_monthly, 2),
          'active_subscriptions', v_active_subscriptions,
          'trialing_subscriptions', v_trialing_subscriptions
        )
      );

    WHEN 'support_automation' THEN
      v_summary := format(
        'Support automation review: %s pending deletion requests, %s critical errors in 24h.',
        v_pending_deletion_requests, v_error_24h
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'pending_deletion_requests', v_pending_deletion_requests,
          'critical_errors_24h', v_error_24h
        )
      );

    WHEN 'database_maintenance' THEN
      v_summary := format(
        'Database maintenance complete: %s inactive profiles, %s orphan profiles, %s critical errors in 7 days.',
        v_inactive_profiles, v_orphan_profiles, v_error_7d
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'inactive_profiles', v_inactive_profiles,
          'orphan_profiles', v_orphan_profiles,
          'critical_errors_7d', v_error_7d
        )
      );

    WHEN 'content_moderation' THEN
      v_summary := format(
        'Content moderation health check: %s critical errors (24h), integrations with issues: %s.',
        v_error_24h, v_integrations_problem
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'critical_errors_24h', v_error_24h,
          'integrations_with_issues', v_integrations_problem
        )
      );

    WHEN 'deployment_automation' THEN
      v_summary := format(
        'Deployment automation check: %s/%s integrations reporting healthy sync state.',
        GREATEST(v_integrations_enabled - v_integrations_problem, 0), v_integrations_enabled
      );
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'integrations_enabled', v_integrations_enabled,
          'integrations_with_issues', v_integrations_problem
        )
      );

    ELSE
      v_summary := 'Agent executed successfully.';
      v_result := jsonb_build_object(
        'summary', v_summary,
        'metrics', jsonb_build_object(
          'active_subscriptions', v_active_subscriptions,
          'critical_errors_24h', v_error_24h
        )
      );
  END CASE;

  v_steps := v_steps || jsonb_build_array(
    jsonb_build_object('step', 'complete', 'status', 'completed', 'at', now())
  );
  v_finished := now();

  UPDATE public.superadmin_agent_executions
  SET
    status = 'completed',
    finished_at = v_finished,
    steps = v_steps,
    result = v_result,
    error_message = NULL
  WHERE id = execution_id_param;

  UPDATE public.superadmin_ai_agents
  SET
    status = 'active',
    last_run_status = 'completed',
    last_run_at = v_started,
    total_runs = COALESCE(total_runs, 0) + 1,
    successful_runs = COALESCE(successful_runs, 0) + 1,
    success_rate = CASE
      WHEN COALESCE(total_runs, 0) + 1 > 0
        THEN ROUND(((COALESCE(successful_runs, 0) + 1)::numeric / (COALESCE(total_runs, 0) + 1)::numeric) * 100, 2)
      ELSE 0
    END,
    updated_at = v_finished
  WHERE id = v_agent.id;

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', execution_id_param,
    'agent_id', v_agent.id,
    'status', 'completed',
    'summary', v_summary,
    'result', v_result
  );

EXCEPTION
  WHEN OTHERS THEN
    v_error := SQLERRM;
    v_finished := now();

    UPDATE public.superadmin_agent_executions
    SET
      status = 'failed',
      finished_at = v_finished,
      error_message = v_error
    WHERE id = execution_id_param;

    UPDATE public.superadmin_ai_agents
    SET
      status = 'error',
      last_run_status = 'failed',
      last_run_at = v_started,
      total_runs = COALESCE(total_runs, 0) + 1,
      success_rate = CASE
        WHEN COALESCE(total_runs, 0) + 1 > 0
          THEN ROUND((COALESCE(successful_runs, 0)::numeric / (COALESCE(total_runs, 0) + 1)::numeric) * 100, 2)
        ELSE 0
      END,
      updated_at = v_finished
    WHERE id = v_agent.id;

    RETURN jsonb_build_object(
      'success', false,
      'execution_id', execution_id_param,
      'agent_id', v_agent.id,
      'status', 'failed',
      'error', v_error
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_pending_superadmin_agent_executions(max_rows integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_exec record;
  v_result jsonb;
  v_completed integer := 0;
  v_failed integer := 0;
BEGIN
  IF NOT public.is_super_admin()
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Super admin access required'
    );
  END IF;

  FOR v_exec IN
    SELECT e.id
    FROM public.superadmin_agent_executions e
    WHERE e.status = 'pending'
    ORDER BY e.started_at ASC
    LIMIT GREATEST(COALESCE(max_rows, 10), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    v_result := public.process_superadmin_agent_execution(v_exec.id);
    IF COALESCE((v_result->>'success')::boolean, false) THEN
      v_completed := v_completed + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_completed + v_failed,
    'completed', v_completed,
    'failed', v_failed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_superadmin_agent(agent_id_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_execution_id uuid;
  v_agent public.superadmin_ai_agents%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  SELECT *
  INTO v_agent
  FROM public.superadmin_ai_agents a
  WHERE a.id = agent_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found: %', agent_id_param;
  END IF;

  IF v_agent.status = 'disabled' THEN
    RAISE EXCEPTION 'Agent is disabled: %', agent_id_param;
  END IF;

  INSERT INTO public.superadmin_agent_executions (
    agent_id,
    triggered_by,
    trigger_type,
    status
  ) VALUES (
    agent_id_param,
    auth.uid(),
    'manual',
    'pending'
  )
  RETURNING id INTO v_execution_id;

  PERFORM public.process_superadmin_agent_execution(v_execution_id);
  RETURN v_execution_id;
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'superadmin-agent-execution-queue'
    ) THEN
      PERFORM cron.schedule(
        'superadmin-agent-execution-queue',
        '*/5 * * * *',
        'SELECT public.process_pending_superadmin_agent_executions(20);'
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping pg_cron schedule setup for superadmin-agent-execution-queue: %', SQLERRM;
END $$;
