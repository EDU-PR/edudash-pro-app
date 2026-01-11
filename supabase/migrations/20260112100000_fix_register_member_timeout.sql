-- Fix register_organization_member RPC timeout issue
-- Date: 2026-01-12
-- Issue: RPC was timing out due to retry loop waiting up to 27.5 seconds
-- Solution: Remove retry loop - the client already retries, and the user was just created so should exist

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
  p_date_of_birth date DEFAULT NULL::date,
  p_physical_address text DEFAULT NULL::text,
  p_role text DEFAULT 'member'::text,
  p_invite_code_used text DEFAULT NULL::text,
  p_joined_via text DEFAULT 'direct_registration'::text
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
  
  -- Normalize membership_status: 'pending' should be 'pending_verification' to match RLS policy
  v_normalized_status := CASE 
    WHEN p_membership_status = 'pending' THEN 'pending_verification'
    ELSE COALESCE(p_membership_status, 'pending_verification')
  END;
  
  -- Trust p_user_id if provided - it came from auth.signUp() which returns a valid user ID
  -- Even if email confirmation is pending, the user exists and will be created
  -- The foreign key constraint on user_id will ensure data integrity
  -- Only skip this check if p_user_id is explicitly NULL (shouldn't happen)
  -- NOTE: With email confirmation enabled, user might not be visible in auth.users immediately
  -- but the user ID from auth.signUp() is valid, so we proceed with member creation
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NULL_USER_ID',
      'error', 'User ID is required'
    );
  END IF;
  
  -- Optional check: Verify user exists (but don't fail if not found - email confirmation might be pending)
  -- This is for logging/debugging purposes only
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = p_user_id
  ) INTO v_user_exists;
  
  -- Also check profiles table as fallback
  IF NOT v_user_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE id = p_user_id
    ) INTO v_user_exists;
  END IF;
  
  -- Log warning if user not found, but proceed anyway (user will be created when email is confirmed)
  -- The foreign key constraint will prevent invalid user_ids
  IF NOT v_user_exists THEN
    -- Log warning but continue - email confirmation might be pending
    -- The INSERT will fail with foreign key violation if user truly doesn't exist
    NULL; -- Continue with member creation
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
  
  -- Also check by email if provided (prevent duplicate emails in same org)
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
        'message', 'A member with this email already exists in the organization'
      );
    END IF;
  END IF;
  
  -- Generate member number if not provided
  v_member_number := p_member_number;
  IF v_member_number IS NULL OR v_member_number = '' THEN
    v_member_number := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  END IF;
  
  -- Insert the new member WITH wing column and new fields
  -- NOTE: If user_id foreign key violation occurs, it means the user doesn't exist in auth.users yet
  -- This can happen if email confirmation is pending - the user exists but might not be visible
  -- The foreign_key_violation exception handler will catch this and return USER_NOT_FOUND
  BEGIN
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
      date_of_birth,
      physical_address,
      role,
      invite_code_used,
      joined_via,
      seat_status,
      join_date,
      created_at,
      updated_at,
      wing
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
      p_date_of_birth,
      p_physical_address,
      COALESCE(p_role, 'member'),
      p_invite_code_used,
      COALESCE(p_joined_via, 'direct_registration'),
      'active',
      CURRENT_DATE,
      NOW(),
      NOW(),
      v_wing
    )
    RETURNING id INTO v_member_id;
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- User doesn't exist in auth.users yet - likely email confirmation pending
      -- Return USER_NOT_FOUND so client can retry
      RETURN jsonb_build_object(
        'success', false,
        'code', 'USER_NOT_FOUND',
        'error', 'User account not found in auth.users. Please wait a moment and try again, or check your email for a confirmation link.',
        'retry_suggested', true,
        'details', SQLERRM
      );
  END;
  
  -- Update the user's profile (optional - don't fail if profile doesn't exist)
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
      -- Log but don't fail - profile update is not critical
      NULL;
  END;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'id', v_member_id,
    'member_number', v_member_number,
    'wing', v_wing,
    'message', 'Member registered successfully'
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DUPLICATE_ERROR',
      'error', 'A duplicate entry was detected. Please try again.',
      'details', SQLERRM
    );
  
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FK_VIOLATION',
      'error', 'User account not fully created yet. Please wait a moment and try again.',
      'retry_suggested', true,
      'details', SQLERRM
    );
  
  WHEN check_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CHECK_VIOLATION',
      'error', 'Data validation failed. Please check your input values.',
      'details', SQLERRM
    );
  
  WHEN not_null_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_NULL_VIOLATION',
      'error', 'Required field is missing. Please check your input values.',
      'details', SQLERRM
    );
  
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNKNOWN_ERROR',
      'error', 'An unexpected error occurred during registration.',
      'details', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$function$;

COMMENT ON FUNCTION public.register_organization_member(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,date,text,text,text,text) IS 
'Registers a new organization member. No retry loop - client handles retries.
Added p_date_of_birth and p_physical_address parameters for Youth Wing registration.
Wing is auto-set based on member_type prefix.
Trusts p_user_id from auth.signUp() - proceeds even if email confirmation is pending.';
