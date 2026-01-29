-- Fix register_organization_member RPC function timeout issue
-- Date: 2026-01-11
-- Issue: RPC times out due to excessive retry loop waiting for user
-- Solution: Reduce retry attempts and wait time, rely on single check

CREATE OR REPLACE FUNCTION public.register_organization_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_region_id uuid DEFAULT NULL::uuid,
  p_member_number text DEFAULT NULL::text,
  p_member_type text DEFAULT 'learner'::text,
  p_membership_tier text DEFAULT 'standard'::text,
  p_membership_status text DEFAULT 'pending_verification'::text,
  p_first_name text DEFAULT NULL::text,
  p_last_name text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_id_number text DEFAULT NULL::text,
  p_role text DEFAULT 'member'::text,
  p_invite_code_used text DEFAULT NULL::text,
  p_joined_via text DEFAULT 'direct_registration'::text,
  p_date_of_birth date DEFAULT NULL::date,
  p_physical_address text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $function$
DECLARE
  v_member_id UUID;
  v_existing_member_id UUID;
  v_member_number TEXT;
  v_user_exists BOOLEAN;
  v_wing TEXT;
  v_profile_exists BOOLEAN;
  v_error_message TEXT;
  v_normalized_status TEXT;
BEGIN
  -- Validate required parameters
  IF p_organization_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NULL_ORG_ID',
      'error', 'Organization ID is required'
    );
  END IF;
  
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NULL_USER_ID',
      'error', 'User ID is required'
    );
  END IF;
  
  -- Determine wing based on member_type
  v_wing := CASE
    WHEN p_member_type LIKE 'youth_%' THEN 'youth'
    WHEN p_member_type LIKE 'women_%' THEN 'women'
    WHEN p_member_type LIKE 'veterans_%' THEN 'veterans'
    ELSE 'main'
  END;
  
  -- Normalize membership_status
  v_normalized_status := CASE 
    WHEN p_membership_status = 'pending' THEN 'pending_verification'
    ELSE COALESCE(p_membership_status, 'pending_verification')
  END;
  
  -- Quick check if user exists (single attempt, no retry loop)
  -- The user should already exist from the auth.signUp call
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = p_user_id
  ) INTO v_user_exists;
  
  -- Also check profiles table as backup
  IF NOT v_user_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE id = p_user_id
    ) INTO v_user_exists;
  END IF;
  
  IF NOT v_user_exists THEN
    -- Single short wait then retry once
    PERFORM pg_sleep(0.5);
    SELECT EXISTS(
      SELECT 1 FROM auth.users WHERE id = p_user_id
    ) INTO v_user_exists;
  END IF;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'USER_NOT_FOUND',
      'error', 'User not found. Please try again in a moment.',
      'retryable', true
    );
  END IF;
  
  -- Check if member already exists for this organization
  SELECT id INTO v_existing_member_id
  FROM organization_members
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id
  LIMIT 1;
  
  IF v_existing_member_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'existing',
      'id', v_existing_member_id,
      'member_number', (SELECT member_number FROM organization_members WHERE id = v_existing_member_id),
      'message', 'Member already exists for this organization'
    );
  END IF;
  
  -- Also check by email if provided
  IF p_email IS NOT NULL AND p_email != '' THEN
    SELECT id INTO v_existing_member_id
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND LOWER(email) = LOWER(p_email);
    
    IF v_existing_member_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'action', 'existing',
        'id', v_existing_member_id,
        'member_number', (SELECT member_number FROM organization_members WHERE id = v_existing_member_id),
        'message', 'A member with this email already exists'
      );
    END IF;
  END IF;
  
  -- Generate member number if not provided
  v_member_number := p_member_number;
  IF v_member_number IS NULL OR v_member_number = '' THEN
    v_member_number := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  END IF;
  
  -- Insert the new member
  INSERT INTO organization_members (
    organization_id,
    user_id,
    region_id,
    member_number,
    member_type,
    membership_tier,
    membership_status,
    first_name,
    last_name,
    email,
    phone,
    id_number,
    role,
    invite_code_used,
    joined_via,
    seat_status,
    join_date,
    created_at,
    updated_at,
    wing,
    date_of_birth,
    physical_address
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_region_id,
    v_member_number,
    COALESCE(p_member_type, 'learner'),
    COALESCE(p_membership_tier, 'standard'),
    v_normalized_status,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_id_number,
    COALESCE(p_role, 'member'),
    p_invite_code_used,
    COALESCE(p_joined_via, 'direct_registration'),
    'active',
    CURRENT_DATE,
    NOW(),
    NOW(),
    v_wing,
    p_date_of_birth,
    p_physical_address
  )
  RETURNING id INTO v_member_id;
  
  -- Update the user's profile (optional - don't fail if it errors)
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE id = p_user_id
    ) INTO v_profile_exists;
    
    IF v_profile_exists THEN
      UPDATE profiles
      SET
        organization_id = p_organization_id,
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        phone = COALESCE(p_phone, phone),
        updated_at = NOW()
      WHERE id = p_user_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore profile update errors
      NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'id', v_member_id,
    'member_number', v_member_number,
    'message', 'Member registered successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DUPLICATE',
      'error', 'A member with this information already exists'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ERROR',
      'error', SQLERRM
    );
END;
$function$;

-- Grant execute to anon for web registration
GRANT EXECUTE ON FUNCTION public.register_organization_member(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text
) TO anon;
GRANT EXECUTE ON FUNCTION public.register_organization_member(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text
) TO authenticated;

COMMENT ON FUNCTION public.register_organization_member(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text
) IS
'Register a new organization member. Optimized for web registration with minimal timeout.';
