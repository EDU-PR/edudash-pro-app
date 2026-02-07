-- Adaptive Admin Dashboard Foundation (Mobile v1)
-- Adds screening metadata + secure RPCs for principal-appointed admin workflows.

BEGIN;

ALTER TABLE public.join_requests
  ADD COLUMN IF NOT EXISTS screened_by uuid,
  ADD COLUMN IF NOT EXISTS screened_at timestamptz,
  ADD COLUMN IF NOT EXISTS screening_status text NOT NULL DEFAULT 'not_screened',
  ADD COLUMN IF NOT EXISTS screening_notes text,
  ADD COLUMN IF NOT EXISTS screening_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS principal_decision_required boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'join_requests_screening_status_check'
      AND conrelid = 'public.join_requests'::regclass
  ) THEN
    ALTER TABLE public.join_requests
      ADD CONSTRAINT join_requests_screening_status_check
      CHECK (
        screening_status = ANY (
          ARRAY['not_screened'::text, 'recommended'::text, 'hold'::text, 'reject_recommended'::text]
        )
      );
  END IF;
END $$;

UPDATE public.join_requests
SET principal_decision_required = CASE
  WHEN request_type IN ('teacher_invite', 'staff_invite') THEN true
  ELSE false
END
WHERE principal_decision_required IS DISTINCT FROM CASE
  WHEN request_type IN ('teacher_invite', 'staff_invite') THEN true
  ELSE false
END;

CREATE OR REPLACE FUNCTION public.screen_join_request(
  p_request_id uuid,
  p_screening_status text,
  p_notes text DEFAULT NULL,
  p_checklist jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_org uuid;
  v_is_super boolean := false;
  v_request public.join_requests%ROWTYPE;
  v_target_org uuid;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_screening_status NOT IN ('recommended', 'hold', 'reject_recommended', 'not_screened') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid screening status');
  END IF;

  SELECT p.role, COALESCE(p.organization_id, p.preschool_id)
  INTO v_actor_role, v_actor_org
  FROM public.profiles p
  WHERE p.id = v_actor OR p.auth_user_id = v_actor
  ORDER BY CASE WHEN p.id = v_actor THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_is_super := lower(v_actor_role) IN ('super_admin', 'superadmin');

  IF lower(v_actor_role) NOT IN ('admin', 'principal', 'principal_admin', 'super_admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  SELECT *
  INTO v_request
  FROM public.join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Join request not found');
  END IF;

  v_target_org := COALESCE(v_request.organization_id, v_request.preschool_id);
  IF v_target_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Join request has no organization scope');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM v_target_org THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  UPDATE public.join_requests
  SET
    screened_by = v_actor,
    screened_at = NOW(),
    screening_status = p_screening_status,
    screening_notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    screening_checklist = COALESCE(p_checklist, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request.id,
    'screening_status', v_request.screening_status,
    'screened_at', v_request.screened_at,
    'screened_by', v_request.screened_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_work_queue(
  p_org_id uuid,
  p_org_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_org uuid;
  v_is_super boolean := false;
  v_hiring jsonb := '[]'::jsonb;
  v_admissions jsonb := '[]'::jsonb;
  v_finance_ops jsonb := '[]'::jsonb;
  v_inbox jsonb := '[]'::jsonb;
  v_escalations jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
  v_pending_hiring integer := 0;
  v_pending_admissions integer := 0;
  v_pending_finance integer := 0;
  v_pending_ops integer := 0;
  v_total_pending integer := 0;
  v_urgent integer := 0;
  v_awaiting_principal integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT p.role, COALESCE(p.organization_id, p.preschool_id)
  INTO v_actor_role, v_actor_org
  FROM public.profiles p
  WHERE p.id = v_actor OR p.auth_user_id = v_actor
  ORDER BY CASE WHEN p.id = v_actor THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_is_super := lower(v_actor_role) IN ('super_admin', 'superadmin');
  IF lower(v_actor_role) NOT IN ('admin', 'principal', 'principal_admin', 'super_admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM p_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE jr.status = 'pending' AND jr.request_type IN ('teacher_invite', 'staff_invite'))::int,
    COUNT(*) FILTER (WHERE jr.status = 'pending' AND jr.request_type IN ('parent_join', 'guardian_claim', 'learner_enroll'))::int,
    COUNT(*) FILTER (WHERE jr.status = 'pending')::int,
    COUNT(*) FILTER (
      WHERE jr.status = 'pending'
        AND jr.principal_decision_required = true
        AND jr.screening_status IN ('recommended', 'hold', 'reject_recommended')
    )::int,
    COUNT(*) FILTER (
      WHERE jr.status = 'pending'
        AND jr.created_at < NOW() - INTERVAL '72 hours'
    )::int
  INTO
    v_pending_hiring,
    v_pending_admissions,
    v_total_pending,
    v_awaiting_principal,
    v_urgent
  FROM public.join_requests jr
  WHERE COALESCE(jr.organization_id, jr.preschool_id) = p_org_id;

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'created_at')::timestamptz DESC),
    '[]'::jsonb
  )
  INTO v_hiring
  FROM (
    SELECT jsonb_build_object(
      'id', jr.id::text,
      'request_id', jr.id::text,
      'lane', 'hiring',
      'request_type', jr.request_type::text,
      'title', CASE
        WHEN jr.request_type = 'teacher_invite' THEN 'Teacher hiring review'
        ELSE 'Staff hiring review'
      END,
      'subtitle', COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', req.first_name, req.last_name)), ''),
        jr.requester_email,
        jr.requester_phone,
        'Unknown requester'
      ),
      'status', jr.status::text,
      'screening_status', jr.screening_status,
      'principal_decision_required', jr.principal_decision_required,
      'requested_role', jr.requested_role,
      'created_at', jr.created_at,
      'aging_hours', FLOOR(EXTRACT(EPOCH FROM (NOW() - jr.created_at)) / 3600)::int,
      'urgent', jr.created_at < NOW() - INTERVAL '72 hours'
    ) AS item
    FROM public.join_requests jr
    LEFT JOIN public.profiles req ON req.id = jr.requester_id
    WHERE COALESCE(jr.organization_id, jr.preschool_id) = p_org_id
      AND jr.status = 'pending'
      AND jr.request_type IN ('teacher_invite', 'staff_invite')
    ORDER BY jr.created_at DESC
    LIMIT 60
  ) t;

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'created_at')::timestamptz DESC),
    '[]'::jsonb
  )
  INTO v_admissions
  FROM (
    SELECT jsonb_build_object(
      'id', jr.id::text,
      'request_id', jr.id::text,
      'lane', 'admissions',
      'request_type', jr.request_type::text,
      'title', CASE
        WHEN jr.request_type = 'parent_join' THEN 'Parent join request'
        WHEN jr.request_type = 'guardian_claim' THEN 'Guardian claim verification'
        ELSE 'Learner enrollment intake'
      END,
      'subtitle', COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', req.first_name, req.last_name)), ''),
        jr.requester_email,
        jr.requester_phone,
        'Unknown requester'
      ),
      'status', jr.status::text,
      'screening_status', jr.screening_status,
      'principal_decision_required', jr.principal_decision_required,
      'requested_role', jr.requested_role,
      'created_at', jr.created_at,
      'aging_hours', FLOOR(EXTRACT(EPOCH FROM (NOW() - jr.created_at)) / 3600)::int,
      'urgent', jr.created_at < NOW() - INTERVAL '72 hours'
    ) AS item
    FROM public.join_requests jr
    LEFT JOIN public.profiles req ON req.id = jr.requester_id
    WHERE COALESCE(jr.organization_id, jr.preschool_id) = p_org_id
      AND jr.status = 'pending'
      AND jr.request_type IN ('parent_join', 'guardian_claim', 'learner_enroll')
    ORDER BY jr.created_at DESC
    LIMIT 60
  ) t;

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'created_at')::timestamptz DESC),
    '[]'::jsonb
  )
  INTO v_escalations
  FROM (
    SELECT jsonb_build_object(
      'id', jr.id::text,
      'request_id', jr.id::text,
      'request_type', jr.request_type::text,
      'screening_status', jr.screening_status,
      'principal_decision_required', jr.principal_decision_required,
      'title', 'Awaiting principal decision',
      'subtitle', COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', req.first_name, req.last_name)), ''),
        jr.requester_email,
        jr.requester_phone,
        'Unknown requester'
      ),
      'created_at', jr.created_at
    ) AS item
    FROM public.join_requests jr
    LEFT JOIN public.profiles req ON req.id = jr.requester_id
    WHERE COALESCE(jr.organization_id, jr.preschool_id) = p_org_id
      AND jr.status = 'pending'
      AND jr.principal_decision_required = true
      AND jr.screening_status IN ('recommended', 'hold', 'reject_recommended')
    ORDER BY jr.updated_at DESC
    LIMIT 30
  ) t;

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'timestamp')::timestamptz DESC),
    '[]'::jsonb
  )
  INTO v_activity
  FROM (
    SELECT jsonb_build_object(
      'id', jr.id::text,
      'request_id', jr.id::text,
      'action', CASE
        WHEN jr.reviewed_at IS NOT NULL THEN 'principal_decision'
        WHEN jr.screened_at IS NOT NULL THEN 'screened'
        ELSE 'request_created'
      END,
      'request_type', jr.request_type::text,
      'summary', CASE
        WHEN jr.reviewed_at IS NOT NULL THEN CONCAT('Final decision: ', jr.status::text)
        WHEN jr.screened_at IS NOT NULL THEN CONCAT('Screened as ', jr.screening_status)
        ELSE 'New workflow item created'
      END,
      'by', COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', reviewer.first_name, reviewer.last_name)), ''),
        NULLIF(BTRIM(CONCAT_WS(' ', screener.first_name, screener.last_name)), ''),
        NULLIF(BTRIM(CONCAT_WS(' ', requester.first_name, requester.last_name)), ''),
        jr.requester_email,
        'Unknown user'
      ),
      'timestamp', COALESCE(jr.reviewed_at, jr.screened_at, jr.created_at)
    ) AS item
    FROM public.join_requests jr
    LEFT JOIN public.profiles reviewer ON reviewer.id = jr.reviewed_by
    LEFT JOIN public.profiles screener ON screener.id = jr.screened_by
    LEFT JOIN public.profiles requester ON requester.id = jr.requester_id
    WHERE COALESCE(jr.organization_id, jr.preschool_id) = p_org_id
    ORDER BY COALESCE(jr.reviewed_at, jr.screened_at, jr.created_at) DESC
    LIMIT 40
  ) t;

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'priority_rank')::int ASC, (item->>'created_at')::timestamptz DESC),
    '[]'::jsonb
  )
  INTO v_inbox
  FROM (
    SELECT jsonb_build_object(
      'id', jr.id::text,
      'request_id', jr.id::text,
      'title', CASE
        WHEN jr.request_type IN ('teacher_invite', 'staff_invite') THEN 'Hiring screening'
        WHEN jr.request_type IN ('parent_join', 'guardian_claim', 'learner_enroll') THEN 'Admissions screening'
        ELSE 'Workflow screening'
      END,
      'subtitle', COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', req.first_name, req.last_name)), ''),
        jr.requester_email,
        jr.requester_phone,
        'Unknown requester'
      ),
      'request_type', jr.request_type::text,
      'screening_status', jr.screening_status,
      'created_at', jr.created_at,
      'urgent', jr.created_at < NOW() - INTERVAL '72 hours',
      'priority', CASE
        WHEN jr.created_at < NOW() - INTERVAL '72 hours' THEN 'urgent'
        WHEN jr.request_type IN ('teacher_invite', 'staff_invite') THEN 'high'
        ELSE 'normal'
      END,
      'priority_rank', CASE
        WHEN jr.created_at < NOW() - INTERVAL '72 hours' THEN 1
        WHEN jr.request_type IN ('teacher_invite', 'staff_invite') THEN 2
        ELSE 3
      END
    ) AS item
    FROM public.join_requests jr
    LEFT JOIN public.profiles req ON req.id = jr.requester_id
    WHERE COALESCE(jr.organization_id, jr.preschool_id) = p_org_id
      AND jr.status = 'pending'
    ORDER BY
      CASE
        WHEN jr.created_at < NOW() - INTERVAL '72 hours' THEN 1
        WHEN jr.request_type IN ('teacher_invite', 'staff_invite') THEN 2
        ELSE 3
      END ASC,
      jr.created_at DESC
    LIMIT 12
  ) ranked;

  RETURN jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'org_type', p_org_type,
    'counters', jsonb_build_object(
      'urgent', v_urgent,
      'awaiting_principal', v_awaiting_principal,
      'pending_hiring', v_pending_hiring,
      'pending_admissions', v_pending_admissions,
      'pending_finance', v_pending_finance,
      'pending_ops', v_pending_ops,
      'total_pending', v_total_pending
    ),
    'workflows', jsonb_build_object(
      'hiring', v_hiring,
      'admissions', v_admissions,
      'finance_ops', v_finance_ops
    ),
    'inbox', v_inbox,
    'escalations', v_escalations,
    'activity', v_activity,
    'generated_at', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_bundle(
  p_org_id uuid,
  p_org_type text,
  p_platform text DEFAULT 'mobile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_queue jsonb;
  v_org_settings jsonb := '{}'::jsonb;
  v_org_name text := 'Organization';
  v_admin_settings jsonb := '{}'::jsonb;
  v_pack_version text := 'v1';
  v_overrides jsonb := '{}'::jsonb;
BEGIN
  v_queue := public.list_admin_work_queue(p_org_id, p_org_type);
  IF COALESCE((v_queue->>'success')::boolean, false) = false THEN
    RETURN v_queue;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'settings'
  ) THEN
    EXECUTE
      'SELECT settings, name FROM public.organizations WHERE id = $1 LIMIT 1'
    INTO v_org_settings, v_org_name
    USING p_org_id;
  END IF;

  IF v_org_name IS NULL OR v_org_name = '' THEN
    SELECT name
    INTO v_org_name
    FROM public.preschools
    WHERE id = p_org_id
    LIMIT 1;
  END IF;

  v_org_name := COALESCE(v_org_name, 'Organization');
  v_org_settings := COALESCE(v_org_settings, '{}'::jsonb);
  v_admin_settings := COALESCE(v_org_settings->'admin_dashboard', '{}'::jsonb);
  v_pack_version := COALESCE(NULLIF(v_admin_settings->>'task_pack_version', ''), 'v1');
  v_overrides := COALESCE(v_admin_settings->'overrides', '{}'::jsonb);

  RETURN jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'org_name', v_org_name,
    'org_type', p_org_type,
    'platform', COALESCE(NULLIF(p_platform, ''), 'mobile'),
    'task_pack_version', v_pack_version,
    'overrides', v_overrides,
    'settings', v_admin_settings,
    'counters', COALESCE(v_queue->'counters', '{}'::jsonb),
    'workflows', COALESCE(v_queue->'workflows', '{}'::jsonb),
    'inbox', COALESCE(v_queue->'inbox', '[]'::jsonb),
    'escalations', COALESCE(v_queue->'escalations', '[]'::jsonb),
    'activity', COALESCE(v_queue->'activity', '[]'::jsonb),
    'generated_at', COALESCE(v_queue->'generated_at', to_jsonb(NOW()))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_join_request_screening_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_org uuid;
  v_target_org uuid := COALESCE(NEW.organization_id, NEW.preschool_id, OLD.organization_id, OLD.preschool_id);
  v_is_super boolean := false;
  v_old_payload jsonb;
  v_new_payload jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.role, COALESCE(p.organization_id, p.preschool_id)
  INTO v_actor_role, v_actor_org
  FROM public.profiles p
  WHERE p.id = v_actor OR p.auth_user_id = v_actor
  ORDER BY CASE WHEN p.id = v_actor THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found for actor %', v_actor;
  END IF;

  v_is_super := lower(v_actor_role) IN ('super_admin', 'superadmin');

  IF NOT v_is_super AND v_target_org IS NOT NULL AND v_actor_org IS DISTINCT FROM v_target_org THEN
    RAISE EXCEPTION 'Cross-organization updates are not allowed for join_requests';
  END IF;

  IF lower(v_actor_role) = 'admin' THEN
    IF NEW.request_type IN ('teacher_invite', 'staff_invite')
      AND NEW.status IN ('approved', 'rejected')
      AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Admins cannot finalize hiring decisions';
    END IF;

    v_old_payload := to_jsonb(OLD) - ARRAY[
      'screened_by',
      'screened_at',
      'screening_status',
      'screening_notes',
      'screening_checklist',
      'updated_at'
    ];
    v_new_payload := to_jsonb(NEW) - ARRAY[
      'screened_by',
      'screened_at',
      'screening_status',
      'screening_notes',
      'screening_checklist',
      'updated_at'
    ];

    IF v_old_payload IS DISTINCT FROM v_new_payload THEN
      RAISE EXCEPTION 'Admins may only update screening fields on join_requests';
    END IF;
  END IF;

  IF NEW.request_type IN ('teacher_invite', 'staff_invite')
    AND NEW.status IN ('approved', 'rejected')
    AND NEW.status IS DISTINCT FROM OLD.status
    AND lower(v_actor_role) NOT IN ('principal', 'principal_admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only principals can finalize hiring decisions';
  END IF;

  IF NEW.request_type IN ('teacher_invite', 'staff_invite') THEN
    NEW.principal_decision_required := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_join_request_screening_rules ON public.join_requests;
CREATE TRIGGER trg_enforce_join_request_screening_rules
BEFORE UPDATE ON public.join_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_join_request_screening_rules();

DO $$
BEGIN
  CREATE POLICY join_requests_school_admin_update_same_org
  ON public.join_requests
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(organization_id, preschool_id) IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
        AND lower(p.role) IN ('admin', 'principal', 'principal_admin', 'super_admin', 'superadmin')
    )
  )
  WITH CHECK (
    COALESCE(organization_id, preschool_id) IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
        AND lower(p.role) IN ('admin', 'principal', 'principal_admin', 'super_admin', 'superadmin')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.screen_join_request(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_work_queue(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_bundle(uuid, text, text) TO authenticated;

COMMIT;
