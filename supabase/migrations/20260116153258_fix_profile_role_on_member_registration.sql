-- Fix profile role on member registration
-- This migration updates the register_organization_member RPC to also update
-- the profile.role based on the member_type being registered
-- 
-- Valid profile roles: parent, teacher, principal, superadmin, admin, instructor, student
-- 
-- Mapping:
-- - Youth wing members (youth_*) -> student
-- - Women's wing members (women_*) -> student  
-- - Veterans members (veterans_*) -> student
-- - Learner -> student
-- - Regional/Branch managers -> admin
-- - National admin/CEO -> admin
-- - Default -> parent

-- Add function to determine profile role from member_type
CREATE OR REPLACE FUNCTION get_profile_role_from_member_type(p_member_type TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Map member_type to valid profile roles
    CASE 
        -- Youth wing -> student
        WHEN p_member_type LIKE 'youth_%' THEN
            RETURN 'student';
        -- Women's wing -> student
        WHEN p_member_type LIKE 'women_%' THEN
            RETURN 'student';
        -- Veterans -> student
        WHEN p_member_type LIKE 'veterans_%' THEN
            RETURN 'student';
        -- Learners/members -> student
        WHEN p_member_type IN ('learner', 'member', 'volunteer', 'mentor', 'facilitator') THEN
            RETURN 'student';
        -- Regional/Branch/National management -> admin
        WHEN p_member_type IN ('regional_manager', 'branch_manager', 'provincial_manager', 'national_admin', 'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer') THEN
            RETURN 'admin';
        -- Default to parent (safe fallback)
        ELSE
            RETURN 'parent';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_profile_role_from_member_type(TEXT) IS 
'Maps organization member_type to valid profile role. Used during member registration to set correct profile.role.';

-- Update the register_organization_member RPC to also set profile.role
-- First, let's read the current definition and add the profile update
CREATE OR REPLACE FUNCTION public.register_organization_member(
  p_organization_id UUID,
  p_user_id UUID,
  p_region_id UUID DEFAULT NULL,
  p_member_number TEXT DEFAULT NULL,
  p_member_type TEXT DEFAULT 'learner',
  p_membership_tier TEXT DEFAULT 'standard',
  p_membership_status TEXT DEFAULT 'active',
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_id_number TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_physical_address TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'member',
  p_invite_code_used TEXT DEFAULT NULL,
  p_joined_via TEXT DEFAULT 'direct_registration'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_member_number TEXT;
  v_existing_member_id UUID;
  v_user_exists BOOLEAN := FALSE;
  v_retry_count INT := 0;
  v_max_retries INT := 5;
  v_normalized_status TEXT;
  v_wing TEXT := NULL;
  v_profile_role TEXT;
BEGIN
  -- Normalize membership_status 
  v_normalized_status := CASE 
    WHEN LOWER(p_membership_status) IN ('active', 'approved') THEN 'active'
    WHEN LOWER(p_membership_status) IN ('pending', 'awaiting') THEN 'pending'
    WHEN LOWER(p_membership_status) IN ('suspended', 'inactive', 'disabled') THEN 'suspended'
    WHEN LOWER(p_membership_status) IN ('expired', 'lapsed') THEN 'expired'
    ELSE 'pending'
  END;

  -- Determine wing from member_type
  v_wing := CASE
    WHEN p_member_type LIKE 'youth_%' OR p_member_type = 'youth' THEN 'youth'
    WHEN p_member_type LIKE 'women_%' OR p_member_type = 'women' THEN 'women'
    WHEN p_member_type LIKE 'veterans_%' OR p_member_type = 'veterans' THEN 'veterans'
    ELSE 'main'
  END;

  -- Determine the correct profile role
  v_profile_role := get_profile_role_from_member_type(p_member_type);

  -- Wait for user to exist in auth.users (with retry)
  LOOP
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
    EXIT WHEN v_user_exists OR v_retry_count >= v_max_retries;
    v_retry_count := v_retry_count + 1;
    PERFORM pg_sleep(0.5); -- Wait 500ms before retry
  END LOOP;

  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User does not exist in auth system. Please wait a moment and try again.',
      'code', 'USER_NOT_FOUND'
    );
  END IF;
  
  -- Check if member already exists for this organization by user_id
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
  
  -- Insert the new member
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
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User account not ready. Please wait a moment and try again.',
        'code', 'USER_NOT_FOUND'
      );
    WHEN unique_violation THEN
      -- Try to get existing member
      SELECT id INTO v_existing_member_id
      FROM organization_members
      WHERE organization_id = p_organization_id
        AND (user_id = p_user_id OR LOWER(email) = LOWER(p_email))
      LIMIT 1;
      
      IF v_existing_member_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', true,
          'action', 'existing',
          'id', v_existing_member_id,
          'member_number', (SELECT member_number FROM organization_members WHERE id = v_existing_member_id),
          'message', 'Member already exists'
        );
      END IF;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'A member with this information already exists',
        'code', 'DUPLICATE_MEMBER'
      );
  END;

  -- UPDATE PROFILE ROLE based on member_type
  -- This ensures proper routing for the user
  UPDATE profiles
  SET 
    role = v_profile_role,
    organization_id = p_organization_id,
    first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
    last_name = COALESCE(NULLIF(p_last_name, ''), last_name),
    phone_number = COALESCE(NULLIF(p_phone, ''), phone_number),
    updated_at = NOW()
  WHERE id = p_user_id;

  RAISE NOTICE 'Updated profile role to % for user %', v_profile_role, p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'id', v_member_id,
    'member_number', v_member_number,
    'profile_role', v_profile_role,
    'message', 'Member created successfully'
  );
END;
$$;

-- Grant execute permissions
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
  date,
  text,
  text,
  text,
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
  date,
  text,
  text,
  text,
  text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_role_from_member_type(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile_role_from_member_type(text) TO authenticated;

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
  date,
  text,
  text,
  text,
  text
) IS
'Creates an organization member record and updates the user profile role. Returns JSON with success status, action taken, and member details.';

-- Fix any existing members whose profile role doesn't match their member_type
-- This updates profiles where the user is an organization member but has 'parent' role
DO $$
DECLARE
    v_record RECORD;
    v_new_role TEXT;
    v_update_count INT := 0;
    has_profiles boolean;
    has_org_members boolean;
BEGIN
    has_profiles := to_regclass('public.profiles') IS NOT NULL;
    has_org_members := to_regclass('public.organization_members') IS NOT NULL;

    IF NOT has_profiles OR NOT has_org_members THEN
        RETURN;
    END IF;

    FOR v_record IN 
        SELECT DISTINCT
            p.id as user_id,
            p.email,
            p.role as current_role,
            om.member_type
        FROM profiles p
        INNER JOIN organization_members om ON om.user_id = p.id
        WHERE p.role = 'parent'  -- Only fix users who have 'parent' role
        AND om.member_type IS NOT NULL
        AND om.member_type NOT IN ('parent')  -- Skip if member_type is actually parent
    LOOP
        v_new_role := get_profile_role_from_member_type(v_record.member_type);
        
        IF v_new_role != v_record.current_role THEN
            UPDATE profiles
            SET role = v_new_role, updated_at = NOW()
            WHERE id = v_record.user_id;
            
            v_update_count := v_update_count + 1;
            RAISE NOTICE 'Updated profile role for % from % to % (member_type: %)', 
                v_record.email, v_record.current_role, v_new_role, v_record.member_type;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total profiles updated: %', v_update_count;
END $$;

DO $$
DECLARE
    has_profiles boolean;
    has_org_members boolean;
    has_organizations boolean;
BEGIN
    has_profiles := to_regclass('public.profiles') IS NOT NULL;
    has_org_members := to_regclass('public.organization_members') IS NOT NULL;
    has_organizations := to_regclass('public.organizations') IS NOT NULL;

    IF NOT has_profiles OR NOT has_org_members OR NOT has_organizations THEN
        RETURN;
    END IF;

    -- Verification query (intentionally not returning rows in migration context)
    PERFORM 1
    FROM profiles p
    INNER JOIN organization_members om ON om.user_id = p.id
    INNER JOIN organizations o ON o.id = om.organization_id
    WHERE om.member_type LIKE 'youth_%'
       OR om.member_type IN ('learner', 'member')
    LIMIT 1;
END $$;
