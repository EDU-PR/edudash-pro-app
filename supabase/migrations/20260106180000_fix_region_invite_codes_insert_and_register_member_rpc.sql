-- ============================================================================
-- Migration: Fix region_invite_codes INSERT policy + Create register_organization_member RPC
-- Date: 2026-01-06
-- 
-- Issues Fixed:
-- 1. region_invite_codes table doesn't allow INSERT for regional managers
-- 2. register_organization_member RPC function is missing (causes FK errors)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix region_invite_codes INSERT policy
-- ============================================================================

-- Drop the existing ALL policy that doesn't work properly for inserts
DROP POLICY IF EXISTS "Regional managers can manage their region codes" ON region_invite_codes;

-- Create separate policies for each operation

-- SELECT: Regional managers and national admins can see their org's codes
CREATE POLICY "regional_managers_select_codes"
  ON region_invite_codes
  FOR SELECT
  USING (
    -- Anyone can read active codes (for validation)
    is_active = true
    OR
    -- Or user is admin/manager in the organization (check both role and member_type)
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = region_invite_codes.organization_id
        AND (
          om.role IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
        )
    )
  );

-- INSERT: Regional managers can create codes for their region
CREATE POLICY "regional_managers_insert_codes"
  ON region_invite_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = region_invite_codes.organization_id
        AND (
          om.role IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
        )
        AND (
          -- National/org-level admins can create for any region
          om.role IN ('national_admin', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'ceo', 'president', 'youth_president')
          -- Regional managers can only create for their region
          OR om.region_id = region_invite_codes.region_id
        )
    )
    -- Also ensure created_by is set to current user
    AND created_by = auth.uid()
  );

-- UPDATE: Regional managers can update their own region's codes
CREATE POLICY "regional_managers_update_codes"
  ON region_invite_codes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = region_invite_codes.organization_id
        AND (
          om.role IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
        )
        AND (
          om.role IN ('national_admin', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'ceo', 'president', 'youth_president')
          OR om.region_id = region_invite_codes.region_id
        )
    )
  );

-- DELETE: Regional managers can delete their own region's codes
CREATE POLICY "regional_managers_delete_codes"
  ON region_invite_codes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = region_invite_codes.organization_id
        AND (
          om.role IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'regional_manager', 'ceo', 'president', 'youth_president')
        )
        AND (
          om.role IN ('national_admin', 'ceo', 'president', 'youth_president')
          OR om.member_type IN ('national_admin', 'ceo', 'president', 'youth_president')
          OR om.region_id = region_invite_codes.region_id
        )
    )
  );

-- Drop the old "Anyone can read active codes" policy since we merged it above
DROP POLICY IF EXISTS "Anyone can read active codes" ON region_invite_codes;


-- ============================================================================
-- PART 2: Create register_organization_member RPC function
-- This is a SECURITY DEFINER function to register new members during signup
-- when the user's session may not be fully established
-- ============================================================================

-- Drop existing function if exists (to update parameters)
DROP FUNCTION IF EXISTS register_organization_member(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create the register_organization_member function
CREATE OR REPLACE FUNCTION register_organization_member(
  p_organization_id UUID,
  p_user_id UUID,
  p_region_id UUID DEFAULT NULL,
  p_member_number TEXT DEFAULT NULL,
  p_member_type TEXT DEFAULT 'learner',
  p_membership_tier TEXT DEFAULT 'standard',
  p_membership_status TEXT DEFAULT 'pending_verification',
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_id_number TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'member',
  p_invite_code_used TEXT DEFAULT NULL,
  p_joined_via TEXT DEFAULT 'direct_registration'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as function owner (postgres) to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_existing_member_id UUID;
  v_member_number TEXT;
  v_user_exists BOOLEAN;
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

  -- Verify the user exists in auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = p_user_id
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'USER_NOT_FOUND',
      'error', 'User does not exist in auth system. Account may not be fully created yet.'
    );
  END IF;

  -- Check if member already exists for this user+org combination
  SELECT id INTO v_existing_member_id
  FROM organization_members
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id;

  IF v_existing_member_id IS NOT NULL THEN
    -- Member already exists, return existing
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
    -- Generate simple random 6-digit number
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
    updated_at
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_region_id,
    v_member_number,
    COALESCE(p_member_type, 'learner'),
    COALESCE(p_membership_tier, 'standard'),
    COALESCE(p_membership_status, 'pending_verification'),
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
    NOW()
  )
  RETURNING id INTO v_member_id;

  -- Update the user's profile to link them to the organization
  UPDATE profiles
  SET 
    organization_id = p_organization_id,
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Return success with member details
  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'id', v_member_id,
    'member_number', v_member_number,
    'message', 'Member registered successfully'
  );

EXCEPTION 
  WHEN unique_violation THEN
    -- Handle race condition where member was created between check and insert
    SELECT id, member_number INTO v_existing_member_id, v_member_number
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND (user_id = p_user_id OR (p_email IS NOT NULL AND LOWER(email) = LOWER(p_email)));

    IF v_existing_member_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'action', 'existing',
        'id', v_existing_member_id,
        'member_number', v_member_number,
        'message', 'Member already exists (concurrent registration)'
      );
    END IF;

    -- Some other unique violation
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DUPLICATE_ERROR',
      'error', 'A duplicate entry was detected. Please try again.'
    );

  WHEN foreign_key_violation THEN
    -- This shouldn't happen since we check user existence, but handle gracefully
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FK_VIOLATION',
      'error', 'User account not fully created yet. Please wait a moment and try again.'
    );

  WHEN OTHERS THEN
    -- Catch any other errors
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNKNOWN_ERROR',
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to both anon and authenticated roles
GRANT EXECUTE ON FUNCTION register_organization_member(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION register_organization_member(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION register_organization_member IS 
'SECURITY DEFINER function to register new organization members.
Can be called by anon users during registration (before email confirmation)
and by authenticated users joining organizations.

Returns JSONB: {success, action, id, member_number, code?, error?, message}';


-- ============================================================================
-- PART 3: Ensure required columns exist on organization_members
-- ============================================================================

-- Add invite_code_used column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'invite_code_used'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN invite_code_used TEXT;
  END IF;
END $$;

-- Add joined_via column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'joined_via'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN joined_via TEXT DEFAULT 'direct_registration';
  END IF;
END $$;

-- Add seat_status column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'seat_status'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN seat_status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Add join_date column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_members' AND column_name = 'join_date'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN join_date DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- ============================================================================
-- Migration complete!
-- ============================================================================
