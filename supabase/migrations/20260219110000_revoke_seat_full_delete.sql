-- ============================================================================
-- Migration: rpc_revoke_teacher_seat — full delete on revoke
-- ============================================================================
-- When a principal revokes a teacher's seat, the teacher is now fully removed:
--   1. DELETE from subscription_seats (not just mark revoked)
--   2. DELETE from teachers table
--   3. DELETE from organization_members
--   4. Unassign from classes (set teacher_id to null)
--   5. DELETE pending teacher_invites for their email
--   6. Clear profile org linkage (role → 'parent', school → null)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_revoke_teacher_seat(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service   boolean := public.util_is_service_role();
  v_school       uuid    := public.util_caller_principal_school();
  v_subscription_id uuid;
  v_deleted_seats int;
  v_target_email  text;
  v_target_user_db_id uuid;
BEGIN
  -- ── Auth check ───────────────────────────────────────────────
  IF NOT v_is_service AND v_school IS NULL THEN
    RAISE EXCEPTION 'Only principals can revoke teacher seats';
  END IF;

  IF v_is_service AND v_school IS NULL THEN
    SELECT COALESCE(preschool_id, organization_id)
      INTO v_school
      FROM public.profiles
     WHERE id = target_user_id;
  END IF;

  IF v_school IS NULL THEN
    -- Fallback: try teachers table
    SELECT preschool_id
      INTO v_school
      FROM public.teachers
     WHERE (user_id = target_user_id OR auth_user_id = target_user_id)
     LIMIT 1;
  END IF;

  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Cannot determine school for operation';
  END IF;

  IF NOT public.util_acquire_school_lock(v_school) THEN
    RAISE EXCEPTION 'Seat update in progress; please retry';
  END IF;

  -- ── Find subscription ────────────────────────────────────────
  SELECT id INTO v_subscription_id
    FROM public.subscriptions
   WHERE school_id = v_school AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for school';
  END IF;

  -- ── Resolve target user DB ID ────────────────────────────────
  SELECT id INTO v_target_user_db_id
    FROM public.users WHERE auth_user_id = target_user_id;

  IF v_target_user_db_id IS NULL THEN
    SELECT id INTO v_target_user_db_id
      FROM public.users WHERE id = target_user_id;
  END IF;

  IF v_target_user_db_id IS NULL THEN
    SELECT user_id INTO v_target_user_db_id
      FROM public.teachers
     WHERE id = target_user_id
        OR user_id = target_user_id
        OR auth_user_id = target_user_id;
  END IF;

  -- ── Get teacher email for invite cleanup ─────────────────────
  SELECT email INTO v_target_email
    FROM public.profiles WHERE id = target_user_id;

  IF v_target_email IS NULL THEN
    SELECT email INTO v_target_email
      FROM public.teachers
     WHERE user_id = target_user_id
        OR auth_user_id = target_user_id
     LIMIT 1;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 1. DELETE subscription seats (not just mark revoked)
  -- ══════════════════════════════════════════════════════════════
  IF v_target_user_db_id IS NOT NULL THEN
    DELETE FROM public.subscription_seats
     WHERE subscription_id = v_subscription_id
       AND user_id = v_target_user_db_id
       AND preschool_id = v_school;

    GET DIAGNOSTICS v_deleted_seats = ROW_COUNT;
  ELSE
    -- Try with target_user_id directly
    DELETE FROM public.subscription_seats
     WHERE subscription_id = v_subscription_id
       AND user_id = target_user_id
       AND preschool_id = v_school;

    GET DIAGNOSTICS v_deleted_seats = ROW_COUNT;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 2. Unassign from classes
  -- ══════════════════════════════════════════════════════════════
  UPDATE public.classes
     SET teacher_id = NULL
   WHERE teacher_id = target_user_id
     AND preschool_id = v_school;

  -- ══════════════════════════════════════════════════════════════
  -- 3. DELETE from teachers table
  -- ══════════════════════════════════════════════════════════════
  DELETE FROM public.teachers
   WHERE preschool_id = v_school
     AND (user_id = target_user_id
       OR auth_user_id = target_user_id
       OR id = target_user_id);

  -- ══════════════════════════════════════════════════════════════
  -- 4. DELETE from organization_members
  -- ══════════════════════════════════════════════════════════════
  DELETE FROM public.organization_members
   WHERE user_id = target_user_id
     AND organization_id = v_school;

  -- ══════════════════════════════════════════════════════════════
  -- 5. DELETE pending teacher_invites
  -- ══════════════════════════════════════════════════════════════
  IF v_target_email IS NOT NULL THEN
    DELETE FROM public.teacher_invites
     WHERE email = v_target_email
       AND preschool_id = v_school;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 6. Clear profile org linkage (reset to parent)
  -- ══════════════════════════════════════════════════════════════
  UPDATE public.profiles
     SET organization_id = NULL,
         preschool_id    = NULL,
         seat_status     = 'inactive',
         role            = 'parent',
         updated_at      = NOW()
   WHERE id = target_user_id
     AND (organization_id = v_school OR preschool_id = v_school);

  -- ══════════════════════════════════════════════════════════════
  -- 7. Recount seats_used from actual records
  -- ══════════════════════════════════════════════════════════════
  UPDATE public.subscriptions
     SET seats_used = (
           SELECT COUNT(*)
             FROM public.subscription_seats
            WHERE subscription_id = v_subscription_id
              AND revoked_at IS NULL
         ),
         updated_at = NOW()
   WHERE id = v_subscription_id;

  IF v_deleted_seats = 0 THEN
    RETURN jsonb_build_object('status', 'removed_no_seat');
  END IF;

  RETURN jsonb_build_object('status', 'revoked');
END;
$$;
