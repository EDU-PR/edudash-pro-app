-- Fix legacy superadmin deletion RPC to work when public.users is sparse.
-- Many deployments keep canonical user rows in profiles/auth.users.

CREATE OR REPLACE FUNCTION public.superadmin_request_user_deletion(
  target_user_id uuid,
  deletion_reason text DEFAULT 'Administrative action'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_requester_id uuid;
  v_target_profile public.profiles%ROWTYPE;
  v_target_auth_id uuid;
  v_target_profile_id uuid;
  v_target_email text;
  v_target_role text;
  v_tenant_id uuid;
  v_request_id uuid;
BEGIN
  IF NOT is_superadmin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: Superadmin privileges required'
    );
  END IF;

  v_requester_id := auth.uid();
  IF v_requester_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  -- Resolve the target from profiles first (works for profile-id or auth-user-id input)
  SELECT p.*
  INTO v_target_profile
  FROM public.profiles p
  WHERE p.id = target_user_id OR p.auth_user_id = target_user_id
  ORDER BY CASE WHEN p.auth_user_id = target_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF FOUND THEN
    v_target_profile_id := v_target_profile.id;
    v_target_auth_id := COALESCE(v_target_profile.auth_user_id, v_target_profile.id);
    v_target_email := COALESCE(v_target_profile.email, '');
    v_target_role := lower(COALESCE(v_target_profile.role, ''));
    v_tenant_id := COALESCE(v_target_profile.organization_id, v_target_profile.preschool_id);
  ELSE
    -- Fallback to auth.users for users with missing local profile rows
    SELECT au.id, COALESCE(au.email, '')
    INTO v_target_auth_id, v_target_email
    FROM auth.users au
    WHERE au.id = target_user_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'User not found'
      );
    END IF;

    v_target_profile_id := target_user_id;
    v_target_role := '';
    v_tenant_id := NULL;
  END IF;

  IF v_target_auth_id = v_requester_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot request deletion for your own account'
    );
  END IF;

  IF v_target_role IN ('super_admin', 'superadmin', 'platform_admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot delete superadmin users'
    );
  END IF;

  -- Avoid duplicate pending requests for the same auth user.
  IF EXISTS (
    SELECT 1
    FROM public.superadmin_user_deletion_requests r
    WHERE r.user_id = v_target_auth_id
      AND r.status IN ('pending', 'in_progress')
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Deletion request already exists for this user'
    );
  END IF;

  INSERT INTO public.superadmin_user_deletion_requests (
    user_id,
    requester_id,
    tenant_id,
    deletion_type,
    reason,
    scheduled_for,
    metadata,
    target_user_id
  ) VALUES (
    v_target_auth_id,
    v_requester_id,
    v_tenant_id,
    'soft',
    deletion_reason,
    NOW() + INTERVAL '7 days',
    jsonb_build_object(
      'target_email', v_target_email,
      'target_profile_id', v_target_profile_id,
      'requested_via', 'legacy_superadmin_request_user_deletion'
    ),
    v_target_profile_id
  )
  RETURNING id INTO v_request_id;

  -- Keep legacy behavior: deactivate immediately while request is queued.
  UPDATE public.profiles
  SET is_active = false, updated_at = NOW()
  WHERE id = v_target_profile_id;

  UPDATE public.users
  SET is_active = false, updated_at = NOW()
  WHERE auth_user_id = v_target_auth_id OR id = v_target_profile_id;

  INSERT INTO public.error_logs (level, message, source, details)
  VALUES (
    'info',
    'User deletion requested by superadmin',
    'user_management',
    json_build_object(
      'request_id', v_request_id,
      'target_user_id', v_target_auth_id,
      'target_profile_id', v_target_profile_id,
      'target_email', v_target_email,
      'target_role', v_target_role,
      'deletion_reason', deletion_reason,
      'admin_user_id', v_requester_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'User deactivated and scheduled for deletion',
    'target_user_id', v_target_auth_id,
    'target_profile_id', v_target_profile_id,
    'scheduled_for', (NOW() + INTERVAL '7 days'),
    'action_taken', 'deactivation_and_queue'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

