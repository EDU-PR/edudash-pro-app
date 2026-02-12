-- Migration: Fix rpc_assign_teacher_seat 409 conflict on users PK
-- Problem:  INSERT INTO users with ON CONFLICT (auth_user_id) fails with 409
--           when a users row already exists with the same PK (id = profiles.id)
--           but a different auth_user_id. The PK constraint fires before
--           the ON CONFLICT clause can handle it.
-- Fix:      Check for existing users row by id OR auth_user_id before inserting.
--           If found, UPDATE in place. Only INSERT when no row exists at all.

CREATE OR REPLACE FUNCTION public.rpc_assign_teacher_seat(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_auth_uid uuid := auth.uid();
  v_is_service boolean := public.util_is_service_role();
  v_school uuid := public.util_caller_principal_school();
  v_subscription_id uuid;
  v_limit int;
  v_used int;
  v_target_user_db_id uuid;
  v_assigned_by_db_id uuid;

  v_target_profile_id uuid;
  v_target_auth_user_id uuid;
  v_target_profile_role text;
  v_target_user_role text;
  v_target_profile_school uuid;
  v_target_email text;
  v_target_name text;

  v_caller_profile_id uuid;
  v_caller_auth_resolved uuid;
  v_caller_profile_role text;
  v_caller_profile_school uuid;
  v_caller_email text;
  v_caller_name text;

  v_existing_users_id uuid;

  v_audit_sub_restore text := COALESCE(v_caller_auth_uid::text, '');
BEGIN
  -- Authorization check
  IF NOT v_is_service AND v_school IS NULL THEN
    RAISE EXCEPTION 'Only principals can assign staff seats';
  END IF;

  -- Service-role path: infer school from target profile
  IF v_is_service AND v_school IS NULL THEN
    SELECT COALESCE(p.preschool_id, p.organization_id)
    INTO v_school
    FROM public.profiles p
    WHERE p.id = target_user_id OR p.auth_user_id = target_user_id
    ORDER BY CASE WHEN p.id = target_user_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_school IS NULL THEN
      RAISE EXCEPTION 'Cannot infer preschool for target user';
    END IF;
  END IF;

  -- Acquire advisory lock for concurrency control
  IF NOT public.util_acquire_school_lock(v_school) THEN
    RAISE EXCEPTION 'Seat assignment in progress; please retry';
  END IF;

  -- Resolve target profile first by profile/auth id
  SELECT
    p.id,
    COALESCE(p.auth_user_id, p.id),
    LOWER(COALESCE(p.role, '')),
    COALESCE(p.preschool_id, p.organization_id),
    LOWER(COALESCE(NULLIF(TRIM(p.email), ''), '')),
    COALESCE(
      NULLIF(TRIM(COALESCE(p.full_name, '')), ''),
      NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
      NULLIF(TRIM(COALESCE(p.email, '')), ''),
      'Staff'
    )
  INTO
    v_target_profile_id,
    v_target_auth_user_id,
    v_target_profile_role,
    v_target_profile_school,
    v_target_email,
    v_target_name
  FROM public.profiles p
  WHERE p.id = target_user_id OR p.auth_user_id = target_user_id
  ORDER BY CASE WHEN p.id = target_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  -- Fallback resolve via teachers row
  IF v_target_profile_id IS NULL THEN
    SELECT
      p.id,
      COALESCE(p.auth_user_id, p.id),
      LOWER(COALESCE(p.role, '')),
      COALESCE(p.preschool_id, p.organization_id),
      LOWER(COALESCE(NULLIF(TRIM(p.email), ''), '')),
      COALESCE(
        NULLIF(TRIM(COALESCE(p.full_name, '')), ''),
        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(p.email, '')), ''),
        'Staff'
      )
    INTO
      v_target_profile_id,
      v_target_auth_user_id,
      v_target_profile_role,
      v_target_profile_school,
      v_target_email,
      v_target_name
    FROM public.teachers t
    JOIN public.profiles p
      ON p.id = t.user_id
      OR p.auth_user_id = t.user_id
      OR p.id = t.auth_user_id
      OR p.auth_user_id = t.auth_user_id
      OR (p.email IS NOT NULL AND t.email IS NOT NULL AND LOWER(p.email) = LOWER(t.email))
    WHERE (t.id = target_user_id OR t.user_id = target_user_id OR t.auth_user_id = target_user_id)
      AND t.preschool_id = v_school
    ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Verify target school staff + same school
  IF v_target_profile_id IS NULL
     OR v_target_profile_role NOT IN ('teacher', 'admin', 'principal_admin')
     OR v_target_profile_school IS DISTINCT FROM v_school THEN
    RAISE EXCEPTION 'Target must be school staff (teacher/admin) in the same preschool';
  END IF;

  IF v_target_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Target staff account is not linked to auth user';
  END IF;

  v_target_user_role := CASE
    WHEN v_target_profile_role IN ('teacher', 'admin', 'principal_admin') THEN v_target_profile_role
    ELSE 'teacher'
  END;

  -- Get active subscription for the school
  SELECT id INTO v_subscription_id
  FROM public.subscriptions
  WHERE school_id = v_school
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for school';
  END IF;

  -- Map target auth user id -> users.id for subscription_seats.user_id
  -- Check by BOTH id and auth_user_id to avoid PK conflicts
  SELECT id INTO v_target_user_db_id
  FROM public.users
  WHERE auth_user_id = v_target_auth_user_id
     OR id = v_target_profile_id
  LIMIT 1;

  -- Auto-provision or update users row for target
  IF v_target_user_db_id IS NULL THEN
    -- No users row at all — safe to INSERT
    IF v_target_email IS NULL OR v_target_email = '' THEN
      v_target_email := format('staff-%s@placeholder.local', replace(v_target_auth_user_id::text, '-', ''));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.users u
      WHERE LOWER(u.email) = LOWER(v_target_email)
        AND COALESCE(u.auth_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_target_auth_user_id
        AND u.id <> v_target_profile_id
    ) THEN
      v_target_email := format('staff-%s@placeholder.local', replace(v_target_auth_user_id::text, '-', ''));
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '', true);

    INSERT INTO public.users (
      id,
      auth_user_id,
      email,
      name,
      role,
      preschool_id,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      v_target_profile_id,
      v_target_auth_user_id,
      v_target_email,
      COALESCE(v_target_name, 'Staff'),
      v_target_user_role,
      v_school,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      preschool_id = EXCLUDED.preschool_id,
      is_active = true,
      updated_at = NOW();

    PERFORM set_config('request.jwt.claim.sub', v_audit_sub_restore, true);

    SELECT id INTO v_target_user_db_id
    FROM public.users
    WHERE auth_user_id = v_target_auth_user_id OR id = v_target_profile_id
    LIMIT 1;
  ELSE
    -- Row exists — UPDATE it to ensure auth_user_id and school are current
    UPDATE public.users SET
      auth_user_id = v_target_auth_user_id,
      role = v_target_user_role,
      preschool_id = v_school,
      is_active = true,
      updated_at = NOW()
    WHERE id = v_target_user_db_id;
  END IF;

  IF v_target_user_db_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find user record for target user ID';
  END IF;

  -- Map caller auth uid -> users.id for assigned_by
  SELECT u.id INTO v_assigned_by_db_id
  FROM public.users u
  WHERE u.auth_user_id = v_caller_auth_uid OR u.id = v_caller_auth_uid
  LIMIT 1;

  -- Auto-provision missing caller users row to avoid audit FK issues
  IF v_assigned_by_db_id IS NULL AND v_caller_auth_uid IS NOT NULL THEN
    SELECT
      p.id,
      COALESCE(p.auth_user_id, p.id),
      LOWER(COALESCE(p.role, '')),
      COALESCE(p.preschool_id, p.organization_id),
      LOWER(COALESCE(NULLIF(TRIM(p.email), ''), '')),
      COALESCE(
        NULLIF(TRIM(COALESCE(p.full_name, '')), ''),
        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(p.email, '')), ''),
        'Principal'
      )
    INTO
      v_caller_profile_id,
      v_caller_auth_resolved,
      v_caller_profile_role,
      v_caller_profile_school,
      v_caller_email,
      v_caller_name
    FROM public.profiles p
    WHERE p.id = v_caller_auth_uid OR p.auth_user_id = v_caller_auth_uid
    ORDER BY CASE WHEN p.id = v_caller_auth_uid THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_caller_profile_id IS NOT NULL THEN
      IF v_caller_email IS NULL OR v_caller_email = '' THEN
        v_caller_email := format('staff-%s@placeholder.local', replace(v_caller_auth_resolved::text, '-', ''));
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.users u
        WHERE LOWER(u.email) = LOWER(v_caller_email)
          AND COALESCE(u.auth_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_caller_auth_resolved
          AND u.id <> COALESCE(v_caller_profile_id, v_caller_auth_resolved)
      ) THEN
        v_caller_email := format('staff-%s@placeholder.local', replace(v_caller_auth_resolved::text, '-', ''));
      END IF;

      PERFORM set_config('request.jwt.claim.sub', '', true);

      INSERT INTO public.users (
        id,
        auth_user_id,
        email,
        name,
        role,
        preschool_id,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        COALESCE(v_caller_profile_id, v_caller_auth_resolved),
        v_caller_auth_resolved,
        v_caller_email,
        COALESCE(v_caller_name, 'Principal'),
        CASE
          WHEN v_caller_profile_role IN ('teacher', 'admin', 'principal', 'principal_admin', 'staff') THEN v_caller_profile_role
          ELSE 'principal'
        END,
        COALESCE(v_caller_profile_school, v_school),
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        preschool_id = EXCLUDED.preschool_id,
        is_active = true,
        updated_at = NOW();

      PERFORM set_config('request.jwt.claim.sub', v_audit_sub_restore, true);

      SELECT u.id INTO v_assigned_by_db_id
      FROM public.users u
      WHERE u.auth_user_id = v_caller_auth_uid OR u.id = v_caller_auth_uid
      LIMIT 1;
    END IF;
  END IF;

  -- Prevent duplicate active seat for this user and subscription
  PERFORM 1
  FROM public.subscription_seats
  WHERE subscription_id = v_subscription_id
    AND user_id = v_target_user_db_id
    AND revoked_at IS NULL;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_assigned');
  END IF;

  -- Capacity check based on plan limit
  SELECT sp.max_teachers INTO v_limit
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.id = v_subscription_id;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used
    FROM public.subscription_seats
    WHERE subscription_id = v_subscription_id
      AND revoked_at IS NULL;

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'No staff seats available for this plan (used: %, limit: %)', v_used, v_limit;
    END IF;
  END IF;

  -- Avoid audit trigger FK failures when auth.uid is not present in public.users.id
  PERFORM set_config('request.jwt.claim.sub', '', true);

  INSERT INTO public.subscription_seats (
    subscription_id,
    user_id,
    assigned_at,
    assigned_by,
    preschool_id
  ) VALUES (
    v_subscription_id,
    v_target_user_db_id,
    NOW(),
    v_assigned_by_db_id,
    v_school
  );

  -- Update seats_used counter
  UPDATE public.subscriptions
  SET seats_used = (
      SELECT COUNT(*)
      FROM public.subscription_seats
      WHERE subscription_id = v_subscription_id
        AND revoked_at IS NULL
    ),
    updated_at = NOW()
  WHERE id = v_subscription_id;

  PERFORM set_config('request.jwt.claim.sub', v_audit_sub_restore, true);

  RETURN jsonb_build_object('status', 'assigned');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_assign_teacher_seat(uuid) TO authenticated;
