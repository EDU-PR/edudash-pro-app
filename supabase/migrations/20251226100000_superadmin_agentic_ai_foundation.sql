-- ============================================
-- Super Admin Agentic AI Foundation
-- ============================================
-- Provides full agentic AI capabilities for platform super admins
-- including autonomous agents, scheduled tasks, platform insights,
-- and direct database/code/deployment management.
--
-- Tables:
-- - superadmin_ai_agents: AI agent configurations and status
-- - superadmin_autonomous_tasks: Scheduled autonomous operations
-- - superadmin_platform_insights: AI-generated platform insights
-- - superadmin_agent_executions: Execution history for agents
-- - superadmin_command_log: Audit log of all admin AI commands
--
-- NO RLS - super admins bypass all row-level security
-- ============================================

-- ============================================
-- TABLE: superadmin_ai_agents
-- Purpose: Store AI agent configurations for platform management
-- ============================================
CREATE TABLE IF NOT EXISTS public.superadmin_ai_agents (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    agent_type text NOT NULL,
    status text NOT NULL DEFAULT 'idle',
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_run_at timestamptz,
    last_run_status text,
    success_rate numeric(5, 2) DEFAULT 0,
    total_runs integer DEFAULT 0,
    successful_runs integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT superadmin_ai_agents_type_check CHECK (
        agent_type IN (
            'content_moderation',
            'usage_optimization',
            'churn_prediction',
            'revenue_forecasting',
            'support_automation',
            'security_scanning',
            'database_maintenance',
            'backup_management',
            'deployment_automation',
            'code_analysis',
            'custom'
        )
    ),
    CONSTRAINT superadmin_ai_agents_status_check CHECK (
        status IN ('active', 'idle', 'running', 'error', 'disabled', 'maintenance')
    )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_superadmin_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER superadmin_ai_agents_updated_at_trigger
    BEFORE UPDATE ON public.superadmin_ai_agents
    FOR EACH ROW EXECUTE FUNCTION update_superadmin_ai_agents_updated_at();

-- ============================================
-- TABLE: superadmin_autonomous_tasks
-- Purpose: Scheduled autonomous operations
-- ============================================
CREATE TABLE IF NOT EXISTS public.superadmin_autonomous_tasks (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    task_type text NOT NULL,
    schedule_cron text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    last_execution_at timestamptz,
    next_execution_at timestamptz,
    last_execution_status text,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT superadmin_autonomous_tasks_type_check CHECK (
        task_type IN (
            'database_backup',
            'analytics_report',
            'quota_rebalance',
            'session_cleanup',
            'usage_alerts',
            'security_scan',
            'content_review',
            'performance_optimization',
            'log_rotation',
            'cache_purge',
            'custom'
        )
    ),
    CONSTRAINT superadmin_autonomous_tasks_status_check CHECK (
        last_execution_status IS NULL OR last_execution_status IN ('success', 'pending', 'failed', 'running', 'skipped')
    )
);

CREATE TRIGGER superadmin_autonomous_tasks_updated_at_trigger
    BEFORE UPDATE ON public.superadmin_autonomous_tasks
    FOR EACH ROW EXECUTE FUNCTION update_superadmin_ai_agents_updated_at();

-- ============================================
-- TABLE: superadmin_platform_insights
-- Purpose: AI-generated platform insights and recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS public.superadmin_platform_insights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type text NOT NULL,
    priority text NOT NULL DEFAULT 'medium',
    title text NOT NULL,
    description text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    action_label text,
    action_route text,
    is_dismissed boolean NOT NULL DEFAULT false,
    dismissed_by uuid REFERENCES auth.users(id),
    dismissed_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT superadmin_platform_insights_type_check CHECK (
        insight_type IN ('warning', 'opportunity', 'action', 'info', 'critical', 'success')
    ),
    CONSTRAINT superadmin_platform_insights_priority_check CHECK (
        priority IN ('critical', 'high', 'medium', 'low')
    )
);

CREATE INDEX idx_superadmin_insights_active 
    ON public.superadmin_platform_insights(created_at DESC) 
    WHERE is_dismissed = false;

CREATE INDEX idx_superadmin_insights_type 
    ON public.superadmin_platform_insights(insight_type, created_at DESC);

-- ============================================
-- TABLE: superadmin_agent_executions
-- Purpose: Detailed execution history for agents
-- ============================================
CREATE TABLE IF NOT EXISTS public.superadmin_agent_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id text NOT NULL REFERENCES public.superadmin_ai_agents(id) ON DELETE CASCADE,
    triggered_by uuid REFERENCES auth.users(id),
    trigger_type text NOT NULL DEFAULT 'manual',
    status text NOT NULL DEFAULT 'pending',
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    result jsonb,
    error_message text,
    tokens_used integer DEFAULT 0,
    cost_usd numeric(10, 6) DEFAULT 0,
    
    CONSTRAINT superadmin_agent_executions_trigger_check CHECK (
        trigger_type IN ('manual', 'scheduled', 'webhook', 'system', 'cascade')
    ),
    CONSTRAINT superadmin_agent_executions_status_check CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')
    )
);

CREATE INDEX idx_superadmin_agent_executions_agent 
    ON public.superadmin_agent_executions(agent_id, started_at DESC);

CREATE INDEX idx_superadmin_agent_executions_status 
    ON public.superadmin_agent_executions(status) 
    WHERE status IN ('pending', 'running');

-- ============================================
-- TABLE: superadmin_command_log
-- Purpose: Audit log of all admin AI commands and actions
-- ============================================
CREATE TABLE IF NOT EXISTS public.superadmin_command_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL REFERENCES auth.users(id),
    command_type text NOT NULL,
    command_input text NOT NULL,
    command_output text,
    target_entity text,
    target_id text,
    status text NOT NULL DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    tokens_used integer DEFAULT 0,
    model_used text,
    duration_ms integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT superadmin_command_log_type_check CHECK (
        command_type IN (
            'query',
            'analysis',
            'modification',
            'bulk_operation',
            'deployment',
            'code_change',
            'database_operation',
            'agent_control',
            'system_config',
            'report_generation'
        )
    ),
    CONSTRAINT superadmin_command_log_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    )
);

CREATE INDEX idx_superadmin_command_log_admin 
    ON public.superadmin_command_log(admin_id, created_at DESC);

CREATE INDEX idx_superadmin_command_log_type 
    ON public.superadmin_command_log(command_type, created_at DESC);

-- ============================================
-- TABLE: superadmin_integrations
-- Purpose: Store integration credentials and configurations
-- ============================================
CREATE TABLE IF NOT EXISTS public.superadmin_integrations (
    id text PRIMARY KEY,
    name text NOT NULL,
    integration_type text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT false,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    credentials_encrypted text,  -- Encrypted credentials
    last_sync_at timestamptz,
    last_sync_status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT superadmin_integrations_type_check CHECK (
        integration_type IN (
            'github',
            'eas_expo',
            'vercel',
            'sentry',
            'posthog',
            'stripe',
            'payfast',
            'whatsapp',
            'sendgrid',
            'custom'
        )
    )
);

CREATE TRIGGER superadmin_integrations_updated_at_trigger
    BEFORE UPDATE ON public.superadmin_integrations
    FOR EACH ROW EXECUTE FUNCTION update_superadmin_ai_agents_updated_at();

-- ============================================
-- INSERT DEFAULT AI AGENTS
-- ============================================
INSERT INTO public.superadmin_ai_agents (id, name, description, agent_type, status, configuration) VALUES
('content-moderator', 'Content Moderator', 'Auto-reviews and flags inappropriate content across all schools', 'content_moderation', 'active', '{"auto_flag": true, "sensitivity": "medium", "review_queue": true}'::jsonb),
('usage-optimizer', 'Usage Optimizer', 'Analyzes platform usage patterns and recommends optimizations', 'usage_optimization', 'active', '{"analysis_interval_hours": 6, "auto_recommendations": true}'::jsonb),
('churn-predictor', 'Churn Predictor', 'Identifies at-risk schools and recommends retention actions', 'churn_prediction', 'active', '{"prediction_horizon_days": 30, "risk_threshold": 0.7}'::jsonb),
('revenue-forecaster', 'Revenue Forecaster', 'Predicts monthly revenue based on subscription trends', 'revenue_forecasting', 'active', '{"forecast_months": 3, "include_churn_factor": true}'::jsonb),
('support-automator', 'Support Automator', 'Handles tier-1 support queries automatically', 'support_automation', 'active', '{"auto_response": true, "escalation_threshold": 0.6}'::jsonb),
('security-scanner', 'Security Scanner', 'Scans for security vulnerabilities and suspicious activity', 'security_scanning', 'active', '{"scan_frequency_hours": 1, "alert_on_critical": true}'::jsonb),
('database-maintainer', 'Database Maintainer', 'Performs routine database maintenance and optimization', 'database_maintenance', 'active', '{"vacuum_schedule": "daily", "analyze_tables": true}'::jsonb),
('deployment-manager', 'Deployment Manager', 'Manages app deployments via EAS and Vercel', 'deployment_automation', 'idle', '{"auto_deploy": false, "require_approval": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    configuration = EXCLUDED.configuration,
    updated_at = now();

-- ============================================
-- INSERT DEFAULT AUTONOMOUS TASKS
-- ============================================
INSERT INTO public.superadmin_autonomous_tasks (id, name, description, task_type, schedule_cron, is_enabled, configuration) VALUES
('daily-backup', 'Database Backup', 'Full database backup to secure cloud storage', 'database_backup', '0 2 * * *', true, '{"retention_days": 30, "compression": true}'::jsonb),
('weekly-report', 'Weekly Analytics Report', 'Generate and email comprehensive platform report to admins', 'analytics_report', '0 8 * * 1', true, '{"include_revenue": true, "include_usage": true}'::jsonb),
('quota-rebalance', 'AI Quota Rebalancing', 'Automatically adjust AI quotas based on usage patterns', 'quota_rebalance', '0 */6 * * *', true, '{"auto_adjust": true, "alert_threshold": 0.85}'::jsonb),
('session-cleanup', 'Stale Session Cleanup', 'Remove inactive sessions and expired tokens', 'session_cleanup', '0 * * * *', true, '{"max_idle_hours": 24, "preserve_active": true}'::jsonb),
('usage-alerts', 'Usage Threshold Alerts', 'Alert schools approaching their plan limits', 'usage_alerts', '0 */4 * * *', true, '{"threshold_percent": 85, "notify_principal": true}'::jsonb),
('security-scan', 'Security Vulnerability Scan', 'Comprehensive security scan of all endpoints', 'security_scan', '0 3 * * *', true, '{"scan_depth": "full", "check_dependencies": true}'::jsonb),
('log-rotation', 'Log Rotation', 'Archive and compress old log entries', 'log_rotation', '0 4 * * *', true, '{"retention_days": 90, "compress": true}'::jsonb),
('cache-purge', 'Cache Purge', 'Clear stale caches and regenerate critical paths', 'cache_purge', '0 5 * * 0', true, '{"preserve_hot": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    schedule_cron = EXCLUDED.schedule_cron,
    configuration = EXCLUDED.configuration,
    updated_at = now();

-- ============================================
-- INSERT DEFAULT INTEGRATIONS (disabled by default)
-- ============================================
INSERT INTO public.superadmin_integrations (id, name, integration_type, is_enabled, configuration) VALUES
('github-main', 'GitHub Repository', 'github', false, '{"repo": "DashSoil/NewDash", "branch": "main", "auto_pr": false}'::jsonb),
('eas-expo', 'EAS Build Service', 'eas_expo', false, '{"project_id": "", "auto_submit": false}'::jsonb),
('vercel-web', 'Vercel Web Deployment', 'vercel', false, '{"project_id": "", "production_branch": "main"}'::jsonb),
('sentry-monitoring', 'Sentry Error Tracking', 'sentry', false, '{"dsn": "", "environment": "production"}'::jsonb),
('posthog-analytics', 'PostHog Analytics', 'posthog', false, '{"api_key": "", "host": "https://app.posthog.com"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    configuration = EXCLUDED.configuration,
    updated_at = now();

-- ============================================
-- RPC FUNCTIONS FOR SUPER ADMIN AI
-- ============================================

-- Get all active AI agents with execution stats
CREATE OR REPLACE FUNCTION get_superadmin_ai_agents()
RETURNS TABLE (
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
AS $$
BEGIN
    -- Check if caller is super admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
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
            SELECT e.duration_ms 
            FROM superadmin_agent_executions e 
            WHERE e.agent_id = a.id 
            ORDER BY e.started_at DESC 
            LIMIT 1
        ) as last_execution_duration_ms
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
$$;

-- Get autonomous tasks with next execution times
CREATE OR REPLACE FUNCTION get_superadmin_autonomous_tasks()
RETURNS TABLE (
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
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
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
$$;

-- Get active platform insights
CREATE OR REPLACE FUNCTION get_superadmin_platform_insights(
    limit_count integer DEFAULT 10
)
RETURNS TABLE (
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
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
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
$$;

-- Execute an AI agent manually
CREATE OR REPLACE FUNCTION execute_superadmin_agent(
    agent_id_param text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    execution_id uuid;
    agent_record record;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Super admin access required';
    END IF;
    
    -- Get agent and verify it exists
    SELECT * INTO agent_record FROM public.superadmin_ai_agents WHERE id = agent_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found: %', agent_id_param;
    END IF;
    
    -- Update agent status to running
    UPDATE public.superadmin_ai_agents 
    SET status = 'running', last_run_at = now() 
    WHERE id = agent_id_param;
    
    -- Create execution record
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
    ) RETURNING id INTO execution_id;
    
    RETURN execution_id;
END;
$$;

-- Toggle agent status
CREATE OR REPLACE FUNCTION toggle_superadmin_agent(
    agent_id_param text,
    new_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
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
$$;

-- Toggle autonomous task
CREATE OR REPLACE FUNCTION toggle_superadmin_task(
    task_id_param text,
    is_enabled_param boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Super admin access required';
    END IF;
    
    UPDATE public.superadmin_autonomous_tasks 
    SET is_enabled = is_enabled_param, updated_at = now() 
    WHERE id = task_id_param;
    
    RETURN FOUND;
END;
$$;

-- Log admin AI command
CREATE OR REPLACE FUNCTION log_superadmin_command(
    command_type_param text,
    command_input_param text,
    target_entity_param text DEFAULT NULL,
    target_id_param text DEFAULT NULL,
    metadata_param jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Super admin access required';
    END IF;
    
    INSERT INTO public.superadmin_command_log (
        admin_id,
        command_type,
        command_input,
        target_entity,
        target_id,
        metadata,
        status
    ) VALUES (
        auth.uid(),
        command_type_param,
        command_input_param,
        target_entity_param,
        target_id_param,
        metadata_param,
        'pending'
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- Get integrations status
CREATE OR REPLACE FUNCTION get_superadmin_integrations()
RETURNS TABLE (
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
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'superadmin')
    ) THEN
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
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.superadmin_ai_agents IS 'AI agent configurations for platform-wide automated operations';
COMMENT ON TABLE public.superadmin_autonomous_tasks IS 'Scheduled autonomous tasks for platform maintenance';
COMMENT ON TABLE public.superadmin_platform_insights IS 'AI-generated insights and recommendations for admins';
COMMENT ON TABLE public.superadmin_agent_executions IS 'Execution history for AI agents';
COMMENT ON TABLE public.superadmin_command_log IS 'Audit log of all admin AI commands';
COMMENT ON TABLE public.superadmin_integrations IS 'External integrations (GitHub, EAS, Vercel, etc.)';
