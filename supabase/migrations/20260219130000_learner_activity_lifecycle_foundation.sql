-- Learner Activity Lifecycle Foundation
-- Implements strict active consistency, inactivity case model, action RPC,
-- and daily data quality reporting.

BEGIN;

-- 1) Canonical strict-active consistency on students
-- ------------------------------------------------------------------

-- Backfill status from is_active where status is missing/invalid.
UPDATE public.students
SET status = CASE
  WHEN is_active IS TRUE THEN 'active'
  ELSE 'inactive'
END
WHERE status IS NULL
   OR lower(status) NOT IN ('active', 'inactive', 'pending');

-- Backfill is_active from status (strict rule: only active => true).
UPDATE public.students
SET is_active = (lower(status) = 'active')
WHERE is_active IS DISTINCT FROM (lower(status) = 'active');

CREATE OR REPLACE FUNCTION public.sync_student_active_flags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize status text first.
  IF NEW.status IS NOT NULL THEN
    NEW.status := lower(NEW.status);
  END IF;

  -- Fill missing status from is_active.
  IF NEW.status IS NULL THEN
    NEW.status := CASE WHEN COALESCE(NEW.is_active, false) THEN 'active' ELSE 'inactive' END;
  END IF;

  -- Canonical rule: strict-active means status='active' AND is_active=true.
  IF NEW.status = 'active' THEN
    NEW.is_active := true;
  ELSE
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_active_flags ON public.students;
CREATE TRIGGER trg_sync_student_active_flags
BEFORE INSERT OR UPDATE OF status, is_active
ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_active_flags();

-- 2) Data quality views and daily report table
-- ------------------------------------------------------------------

CREATE OR REPLACE VIEW public.student_status_consistency_report AS
SELECT
  s.id AS student_id,
  COALESCE(s.organization_id, s.preschool_id) AS preschool_id,
  s.first_name,
  s.last_name,
  s.status,
  s.is_active,
  CASE
    WHEN lower(COALESCE(s.status, '')) = 'active' AND s.is_active IS DISTINCT FROM true THEN 'active_status_but_inactive_flag'
    WHEN lower(COALESCE(s.status, '')) <> 'active' AND s.is_active IS DISTINCT FROM false THEN 'non_active_status_but_active_flag'
    ELSE 'ok'
  END AS issue_type,
  s.created_at,
  s.updated_at
FROM public.students s
WHERE (
  lower(COALESCE(s.status, '')) = 'active' AND s.is_active IS DISTINCT FROM true
) OR (
  lower(COALESCE(s.status, '')) <> 'active' AND s.is_active IS DISTINCT FROM false
);

CREATE OR REPLACE VIEW public.student_duplicate_candidates AS
WITH normalized AS (
  SELECT
    s.id,
    COALESCE(s.organization_id, s.preschool_id) AS preschool_id,
    lower(regexp_replace(COALESCE(s.first_name, ''), '[^a-z0-9]', '', 'g')) AS first_key,
    lower(regexp_replace(COALESCE(s.last_name, ''), '[^a-z0-9]', '', 'g')) AS last_key,
    s.date_of_birth,
    COALESCE(s.parent_id, s.guardian_id) AS caregiver_id,
    s.first_name,
    s.last_name,
    s.status,
    s.is_active,
    s.class_id,
    s.created_at
  FROM public.students s
  WHERE COALESCE(s.first_name, '') <> ''
), grouped AS (
  SELECT
    preschool_id,
    first_key,
    date_of_birth,
    caregiver_id,
    COUNT(*) AS candidate_count,
    ARRAY_AGG(id ORDER BY created_at DESC) AS student_ids,
    ARRAY_AGG(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ORDER BY created_at DESC) AS names,
    ARRAY_AGG(status ORDER BY created_at DESC) AS statuses,
    ARRAY_AGG(is_active ORDER BY created_at DESC) AS active_flags,
    MAX(created_at) AS latest_created_at
  FROM normalized
  WHERE date_of_birth IS NOT NULL
  GROUP BY preschool_id, first_key, date_of_birth, caregiver_id
  HAVING COUNT(*) > 1
)
SELECT
  g.preschool_id,
  g.first_key,
  g.date_of_birth,
  g.caregiver_id,
  g.candidate_count,
  g.student_ids,
  g.names,
  g.statuses,
  g.active_flags,
  g.latest_created_at
FROM grouped g;

CREATE TABLE IF NOT EXISTS public.student_data_quality_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  duplicate_group_count INTEGER NOT NULL DEFAULT 0,
  mismatch_samples JSONB NOT NULL DEFAULT '[]'::jsonb,
  duplicate_samples JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_date, preschool_id)
);

CREATE INDEX IF NOT EXISTS idx_student_data_quality_daily_reports_school_date
  ON public.student_data_quality_daily_reports (preschool_id, report_date DESC);

ALTER TABLE public.student_data_quality_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_data_quality_daily_reports_select ON public.student_data_quality_daily_reports;
CREATE POLICY student_data_quality_daily_reports_select
ON public.student_data_quality_daily_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_data_quality_daily_reports.preschool_id
  )
);

DROP POLICY IF EXISTS student_data_quality_daily_reports_manage ON public.student_data_quality_daily_reports;
CREATE POLICY student_data_quality_daily_reports_manage
ON public.student_data_quality_daily_reports
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_data_quality_daily_reports.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_data_quality_daily_reports.preschool_id
  )
);

CREATE OR REPLACE FUNCTION public.generate_student_data_quality_daily_report(
  p_preschool_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school RECORD;
  v_processed INTEGER := 0;
  v_mismatch_count INTEGER;
  v_duplicate_count INTEGER;
  v_mismatch_samples JSONB;
  v_duplicate_samples JSONB;
BEGIN
  FOR v_school IN
    SELECT id
    FROM public.preschools
    WHERE p_preschool_id IS NULL OR id = p_preschool_id
  LOOP
    SELECT COUNT(*)
      INTO v_mismatch_count
    FROM public.student_status_consistency_report r
    WHERE r.preschool_id = v_school.id;

    SELECT COUNT(*)
      INTO v_duplicate_count
    FROM public.student_duplicate_candidates d
    WHERE d.preschool_id = v_school.id;

    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'student_id', x.student_id,
        'name', TRIM(COALESCE(x.first_name, '') || ' ' || COALESCE(x.last_name, '')),
        'status', x.status,
        'is_active', x.is_active,
        'issue_type', x.issue_type
      )),
      '[]'::jsonb
    )
    INTO v_mismatch_samples
    FROM (
      SELECT *
      FROM public.student_status_consistency_report
      WHERE preschool_id = v_school.id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 15
    ) x;

    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'student_ids', y.student_ids,
        'names', y.names,
        'statuses', y.statuses,
        'active_flags', y.active_flags,
        'date_of_birth', y.date_of_birth,
        'candidate_count', y.candidate_count
      )),
      '[]'::jsonb
    )
    INTO v_duplicate_samples
    FROM (
      SELECT *
      FROM public.student_duplicate_candidates
      WHERE preschool_id = v_school.id
      ORDER BY latest_created_at DESC NULLS LAST
      LIMIT 10
    ) y;

    INSERT INTO public.student_data_quality_daily_reports (
      report_date,
      preschool_id,
      mismatch_count,
      duplicate_group_count,
      mismatch_samples,
      duplicate_samples
    ) VALUES (
      CURRENT_DATE,
      v_school.id,
      COALESCE(v_mismatch_count, 0),
      COALESCE(v_duplicate_count, 0),
      COALESCE(v_mismatch_samples, '[]'::jsonb),
      COALESCE(v_duplicate_samples, '[]'::jsonb)
    )
    ON CONFLICT (report_date, preschool_id)
    DO UPDATE SET
      mismatch_count = EXCLUDED.mismatch_count,
      duplicate_group_count = EXCLUDED.duplicate_group_count,
      mismatch_samples = EXCLUDED.mismatch_samples,
      duplicate_samples = EXCLUDED.duplicate_samples,
      created_at = NOW();

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_student_data_quality_daily_report(UUID) TO authenticated;

-- 3) Attendance lifecycle policy helper
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_attendance_lifecycle_policy(
  p_preschool_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_policy JSONB;
  v_default_policy JSONB := jsonb_build_object(
    'enabled', true,
    'trigger_absent_days', 5,
    'grace_days', 7,
    'require_principal_approval', false,
    'billing_behavior', 'stop_new_fees_keep_debt',
    'auto_unassign_class_on_inactive', true,
    'notify_channels', jsonb_build_object(
      'push', true,
      'email', false,
      'sms', false,
      'whatsapp', false
    )
  );
BEGIN
  SELECT COALESCE(settings, '{}'::jsonb)
  INTO v_settings
  FROM public.preschools
  WHERE id = p_preschool_id;

  IF NOT FOUND THEN
    RETURN v_default_policy;
  END IF;

  v_policy := COALESCE(v_settings->'attendanceLifecycle', '{}'::jsonb);

  RETURN jsonb_build_object(
    'enabled', COALESCE((v_policy->>'enabled')::boolean, (v_default_policy->>'enabled')::boolean),
    'trigger_absent_days', GREATEST(1, COALESCE((v_policy->>'trigger_absent_days')::integer, (v_default_policy->>'trigger_absent_days')::integer)),
    'grace_days', GREATEST(1, COALESCE((v_policy->>'grace_days')::integer, (v_default_policy->>'grace_days')::integer)),
    'require_principal_approval', COALESCE((v_policy->>'require_principal_approval')::boolean, (v_default_policy->>'require_principal_approval')::boolean),
    'billing_behavior', COALESCE(NULLIF(v_policy->>'billing_behavior', ''), v_default_policy->>'billing_behavior'),
    'auto_unassign_class_on_inactive', COALESCE((v_policy->>'auto_unassign_class_on_inactive')::boolean, (v_default_policy->>'auto_unassign_class_on_inactive')::boolean),
    'notify_channels', jsonb_build_object(
      'push', COALESCE((v_policy->'notify_channels'->>'push')::boolean, true),
      'email', COALESCE((v_policy->'notify_channels'->>'email')::boolean, false),
      'sms', COALESCE((v_policy->'notify_channels'->>'sms')::boolean, false),
      'whatsapp', COALESCE((v_policy->'notify_channels'->>'whatsapp')::boolean, false)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_lifecycle_policy(UUID) TO authenticated;

-- 4) Inactivity case model
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_inactivity_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,

  case_state TEXT NOT NULL DEFAULT 'at_risk'
    CHECK (case_state IN ('at_risk', 'resolved', 'inactive', 'dismissed')),

  trigger_absence_days INTEGER NOT NULL DEFAULT 5,
  trigger_absence_streak INTEGER NOT NULL DEFAULT 0,
  streak_started_on DATE,
  last_absent_date DATE,
  last_present_date DATE,

  warning_sent_at TIMESTAMPTZ,
  warning_deadline_at TIMESTAMPTZ,
  auto_inactivated_at TIMESTAMPTZ,

  principal_action TEXT NOT NULL DEFAULT 'none'
    CHECK (principal_action IN ('none', 'contacted', 'extended_grace', 'kept_active', 'force_inactivated', 'dismissed')),
  principal_action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  principal_action_at TIMESTAMPTZ,
  principal_action_notes TEXT,

  parent_response TEXT NOT NULL DEFAULT 'none'
    CHECK (parent_response IN ('none', 'contacted', 'excused', 'disputed', 'returning')),
  parent_response_at TIMESTAMPTZ,
  parent_response_notes TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_inactivity_cases_school_state
  ON public.student_inactivity_cases (preschool_id, case_state, warning_deadline_at);

CREATE INDEX IF NOT EXISTS idx_student_inactivity_cases_student
  ON public.student_inactivity_cases (student_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_inactivity_cases_one_open
  ON public.student_inactivity_cases (student_id)
  WHERE case_state = 'at_risk' AND closed_at IS NULL;

DROP TRIGGER IF EXISTS trg_student_inactivity_cases_updated_at ON public.student_inactivity_cases;
CREATE TRIGGER trg_student_inactivity_cases_updated_at
BEFORE UPDATE ON public.student_inactivity_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.student_inactivity_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.student_inactivity_cases(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'case_created',
      'warning_sent',
      'status_changed',
      'principal_action',
      'parent_response',
      'auto_inactivated',
      'case_resolved',
      'case_dismissed',
      'case_extended'
    )),

  actor_type TEXT NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('system', 'principal', 'teacher', 'parent')),
  actor_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_inactivity_case_events_case
  ON public.student_inactivity_case_events (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_inactivity_case_events_school
  ON public.student_inactivity_case_events (preschool_id, created_at DESC);

ALTER TABLE public.student_inactivity_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_inactivity_case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_inactivity_cases_staff_select ON public.student_inactivity_cases;
CREATE POLICY student_inactivity_cases_staff_select
ON public.student_inactivity_cases
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_inactivity_cases.preschool_id
  )
);

DROP POLICY IF EXISTS student_inactivity_cases_parent_select ON public.student_inactivity_cases;
CREATE POLICY student_inactivity_cases_parent_select
ON public.student_inactivity_cases
FOR SELECT
USING (
  student_id IN (SELECT public.get_my_children_ids())
  AND case_state IN ('at_risk', 'inactive')
);

DROP POLICY IF EXISTS student_inactivity_cases_manage ON public.student_inactivity_cases;
CREATE POLICY student_inactivity_cases_manage
ON public.student_inactivity_cases
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_inactivity_cases.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_inactivity_cases.preschool_id
  )
);

DROP POLICY IF EXISTS student_inactivity_case_events_staff_select ON public.student_inactivity_case_events;
CREATE POLICY student_inactivity_case_events_staff_select
ON public.student_inactivity_case_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_inactivity_case_events.preschool_id
  )
);

DROP POLICY IF EXISTS student_inactivity_case_events_parent_select ON public.student_inactivity_case_events;
CREATE POLICY student_inactivity_case_events_parent_select
ON public.student_inactivity_case_events
FOR SELECT
USING (
  student_id IN (SELECT public.get_my_children_ids())
  AND event_type IN ('warning_sent', 'auto_inactivated', 'case_resolved', 'status_changed')
);

DROP POLICY IF EXISTS student_inactivity_case_events_manage ON public.student_inactivity_case_events;
CREATE POLICY student_inactivity_case_events_manage
ON public.student_inactivity_case_events
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_inactivity_case_events.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
      AND COALESCE(p.organization_id, p.preschool_id) = student_inactivity_case_events.preschool_id
  )
);

-- Helper to append immutable events
CREATE OR REPLACE FUNCTION public.log_student_inactivity_case_event(
  p_case_id UUID,
  p_event_type TEXT,
  p_actor_type TEXT DEFAULT 'system',
  p_actor_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
BEGIN
  SELECT id, preschool_id, student_id
  INTO v_case
  FROM public.student_inactivity_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactivity case not found';
  END IF;

  INSERT INTO public.student_inactivity_case_events (
    case_id,
    preschool_id,
    student_id,
    event_type,
    actor_type,
    actor_id,
    payload
  ) VALUES (
    v_case.id,
    v_case.preschool_id,
    v_case.student_id,
    p_event_type,
    COALESCE(p_actor_type, 'system'),
    p_actor_id,
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_student_inactivity_case_event(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;

-- Principal action RPC
CREATE OR REPLACE FUNCTION public.apply_student_inactivity_action(
  p_case_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL,
  p_extend_days INTEGER DEFAULT NULL
)
RETURNS public.student_inactivity_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_case public.student_inactivity_cases%ROWTYPE;
  v_action TEXT := lower(COALESCE(p_action, ''));
  v_reason TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_case
  FROM public.student_inactivity_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactivity case not found';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id
    AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    AND COALESCE(p.organization_id, p.preschool_id) = v_case.preschool_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF v_action NOT IN ('contacted', 'extend_grace', 'keep_active', 'dismiss', 'force_inactivate') THEN
    RAISE EXCEPTION 'Unsupported action: %', p_action;
  END IF;

  IF v_action = 'contacted' THEN
    UPDATE public.student_inactivity_cases c
    SET
      principal_action = 'contacted',
      principal_action_by = v_user_id,
      principal_action_at = NOW(),
      principal_action_notes = COALESCE(p_notes, c.principal_action_notes)
    WHERE c.id = p_case_id
    RETURNING * INTO v_case;

    PERFORM public.log_student_inactivity_case_event(
      p_case_id,
      'principal_action',
      'principal',
      v_user_id,
      jsonb_build_object('action', 'contacted', 'notes', p_notes)
    );

  ELSIF v_action = 'extend_grace' THEN
    UPDATE public.student_inactivity_cases c
    SET
      principal_action = 'extended_grace',
      principal_action_by = v_user_id,
      principal_action_at = NOW(),
      principal_action_notes = COALESCE(p_notes, c.principal_action_notes),
      warning_deadline_at = COALESCE(c.warning_deadline_at, NOW()) + make_interval(days => COALESCE(NULLIF(p_extend_days, 0), 7))
    WHERE c.id = p_case_id
    RETURNING * INTO v_case;

    PERFORM public.log_student_inactivity_case_event(
      p_case_id,
      'case_extended',
      'principal',
      v_user_id,
      jsonb_build_object('extend_days', COALESCE(NULLIF(p_extend_days, 0), 7), 'notes', p_notes)
    );

  ELSIF v_action = 'keep_active' THEN
    UPDATE public.student_inactivity_cases c
    SET
      case_state = 'resolved',
      principal_action = 'kept_active',
      principal_action_by = v_user_id,
      principal_action_at = NOW(),
      principal_action_notes = COALESCE(p_notes, c.principal_action_notes),
      resolved_at = NOW(),
      closed_at = NOW(),
      closed_reason = 'principal_kept_active'
    WHERE c.id = p_case_id
    RETURNING * INTO v_case;

    PERFORM public.log_student_inactivity_case_event(
      p_case_id,
      'case_resolved',
      'principal',
      v_user_id,
      jsonb_build_object('action', 'keep_active', 'notes', p_notes)
    );

  ELSIF v_action = 'dismiss' THEN
    UPDATE public.student_inactivity_cases c
    SET
      case_state = 'dismissed',
      principal_action = 'dismissed',
      principal_action_by = v_user_id,
      principal_action_at = NOW(),
      principal_action_notes = COALESCE(p_notes, c.principal_action_notes),
      closed_at = NOW(),
      closed_reason = 'principal_dismissed'
    WHERE c.id = p_case_id
    RETURNING * INTO v_case;

    PERFORM public.log_student_inactivity_case_event(
      p_case_id,
      'case_dismissed',
      'principal',
      v_user_id,
      jsonb_build_object('action', 'dismiss', 'notes', p_notes)
    );

  ELSIF v_action = 'force_inactivate' THEN
    v_reason := COALESCE(NULLIF(TRIM(p_notes), ''), 'attendance_lifecycle_force_inactivate');

    PERFORM public.deactivate_student(v_case.student_id, v_reason);

    UPDATE public.student_inactivity_cases c
    SET
      case_state = 'inactive',
      principal_action = 'force_inactivated',
      principal_action_by = v_user_id,
      principal_action_at = NOW(),
      principal_action_notes = COALESCE(p_notes, c.principal_action_notes),
      auto_inactivated_at = NOW(),
      closed_at = NOW(),
      closed_reason = 'force_inactivated'
    WHERE c.id = p_case_id
    RETURNING * INTO v_case;

    PERFORM public.log_student_inactivity_case_event(
      p_case_id,
      'auto_inactivated',
      'principal',
      v_user_id,
      jsonb_build_object('action', 'force_inactivate', 'notes', p_notes)
    );
  END IF;

  RETURN v_case;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_student_inactivity_action(UUID, TEXT, TEXT, INTEGER) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_inactivity_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_inactivity_case_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_data_quality_daily_reports TO authenticated;

-- 5) Daily schedules: data quality rollup + lifecycle monitor
-- ------------------------------------------------------------------

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule SQL-only daily quality report at 04:10 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'student-data-quality-daily') THEN
    PERFORM cron.unschedule('student-data-quality-daily');
  END IF;

  PERFORM cron.schedule(
    'student-data-quality-daily',
    '10 4 * * *',
    $job$SELECT public.generate_student_data_quality_daily_report(NULL);$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule student-data-quality-daily: %', SQLERRM;
END $$;

-- Schedule edge function call for lifecycle monitor at 04:30 UTC
DO $$
DECLARE
  v_url text;
  v_cron_secret text;
BEGIN
  v_url := coalesce(
    current_setting('app.settings.supabase_url', true),
    current_setting('app.supabase_url', true)
  );
  v_cron_secret := coalesce(
    current_setting('app.settings.cron_secret', true),
    current_setting('app.cron_secret', true)
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'student-activity-monitor-daily') THEN
    PERFORM cron.unschedule('student-activity-monitor-daily');
  END IF;

  IF v_url IS NOT NULL AND v_cron_secret IS NOT NULL THEN
    PERFORM cron.schedule(
      'student-activity-monitor-daily',
      '30 4 * * *',
      format(
        $sql$
        SELECT net.http_post(
          url := '%s/functions/v1/student-activity-monitor',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer %s'
          ),
          body := jsonb_build_object(
            'scheduled', true,
            'source', 'pg_cron',
            'run_at', now()::text
          )
        )
        $sql$,
        v_url, v_cron_secret
      )
    );
  ELSE
    RAISE NOTICE 'student-activity-monitor schedule skipped: missing app.settings supabase_url/cron_secret';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule student-activity-monitor-daily: %', SQLERRM;
END $$;

COMMIT;
