-- Allow principals/admins to promote or demote staff roles within their own school.
-- This is used by Class & Teacher Management so principals can appoint school admins.

DO $sql$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.organization_members') IS NULL THEN
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.set_school_staff_role(
    p_target_profile_id uuid,
    p_school_id uuid,
    p_role text
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public, auth, extensions
  SET row_security TO off
  AS $fn$
  DECLARE
    v_actor public.profiles%rowtype;
    v_target public.profiles%rowtype;
    v_actor_role text;
    v_actor_school uuid;
    v_target_school uuid;
    v_target_auth_id uuid;
    v_profile_role text;
    v_org_role text;
    v_member_type text;
  BEGIN
    SELECT *
    INTO v_actor
    FROM public.profiles
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;

    IF v_actor.id IS NULL THEN
      RAISE EXCEPTION 'actor_not_found';
    END IF;

    v_actor_role := lower(coalesce(v_actor.role, ''));
    IF v_actor_role NOT IN ('principal', 'principal_admin', 'admin', 'super_admin', 'superadmin') THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;

    IF p_target_profile_id IS NULL OR p_school_id IS NULL THEN
      RAISE EXCEPTION 'target_and_school_required';
    END IF;

    v_profile_role := lower(coalesce(p_role, ''));
    IF v_profile_role NOT IN ('teacher', 'admin', 'principal_admin') THEN
      RAISE EXCEPTION 'invalid_role';
    END IF;

    SELECT *
    INTO v_target
    FROM public.profiles
    WHERE id = p_target_profile_id OR auth_user_id = p_target_profile_id
    LIMIT 1;

    IF v_target.id IS NULL THEN
      RAISE EXCEPTION 'target_not_found';
    END IF;

    v_actor_school := coalesce(v_actor.organization_id, v_actor.preschool_id);
    v_target_school := coalesce(v_target.organization_id, v_target.preschool_id);

    IF v_actor_role NOT IN ('super_admin', 'superadmin') THEN
      IF v_actor_school IS NULL OR v_actor_school <> p_school_id THEN
        RAISE EXCEPTION 'not_authorized_for_school';
      END IF;

      IF v_target_school IS NOT NULL AND v_target_school <> p_school_id THEN
        RAISE EXCEPTION 'target_in_different_school';
      END IF;
    END IF;

    IF v_target.id = v_actor.id AND v_profile_role = 'teacher' THEN
      RAISE EXCEPTION 'cannot_downgrade_self';
    END IF;

    v_target_auth_id := coalesce(v_target.auth_user_id, v_target.id);
    v_org_role := CASE WHEN v_profile_role = 'principal_admin' THEN 'admin' ELSE v_profile_role END;
    v_member_type := CASE WHEN v_profile_role = 'teacher' THEN 'staff' ELSE 'admin' END;

    UPDATE public.profiles
    SET
      role = v_profile_role,
      organization_id = p_school_id,
      preschool_id = p_school_id,
      auth_user_id = coalesce(auth_user_id, id),
      updated_at = now()
    WHERE id = v_target.id;

    INSERT INTO public.organization_members (
      user_id,
      organization_id,
      role,
      member_type,
      seat_status,
      membership_status,
      first_name,
      last_name,
      email,
      phone,
      invited_by,
      updated_at
    )
    VALUES (
      v_target_auth_id,
      p_school_id,
      v_org_role,
      v_member_type,
      'active',
      'active',
      v_target.first_name,
      v_target.last_name,
      v_target.email,
      v_target.phone,
      v_actor.id,
      now()
    )
    ON CONFLICT (user_id, organization_id)
    DO UPDATE SET
      role = excluded.role,
      member_type = excluded.member_type,
      seat_status = 'active',
      membership_status = coalesce(organization_members.membership_status, 'active'),
      first_name = coalesce(excluded.first_name, organization_members.first_name),
      last_name = coalesce(excluded.last_name, organization_members.last_name),
      email = coalesce(excluded.email, organization_members.email),
      phone = coalesce(excluded.phone, organization_members.phone),
      updated_at = now();

    RETURN jsonb_build_object(
      'success', true,
      'profile_id', v_target.id,
      'user_id', v_target_auth_id,
      'role', v_profile_role,
      'organization_role', v_org_role
    );
  END;
  $fn$;

  GRANT EXECUTE ON FUNCTION public.set_school_staff_role(uuid, uuid, text) TO authenticated;
END $sql$;

COMMENT ON FUNCTION public.set_school_staff_role(uuid, uuid, text)
  IS 'Promotes/demotes school staff role (teacher/admin/principal_admin) with principal/admin authorization.';
