-- Migration: Allow 'admin' role to create organizations
-- Date: 2025-12-12
-- Purpose: Enable organization admins (Skills Development, Tertiary, Other) to create organizations
-- Context: Organization onboarding flow creates users with 'admin' role, not 'principal'

-- Update create_organization RPC to allow 'admin' role
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name TEXT,
  p_type TEXT DEFAULT 'preschool',
  p_phone TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  phone TEXT,
  status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_new_org RECORD;
  v_has_org_id_column BOOLEAN;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();

  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Get user's role from profiles table
  SELECT profiles.role INTO v_user_role
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  -- Allow principals, superadmins, and admins to create organizations
  -- 'admin' role is for Skills Development Centres, Tertiary Institutions, and Other Organizations
  IF v_user_role NOT IN ('principal', 'superadmin', 'admin') THEN
    RAISE EXCEPTION 'Only principals, superadmins, and admins can create organizations'
      USING ERRCODE = '42501';
  END IF;

  -- Validate organization name
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required' USING ERRCODE = '22023';
  END IF;

  -- Validate organization type
  IF p_type NOT IN (
    'preschool',
    'daycare',
    'primary_school',
    'skills',
    'tertiary',
    'org',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid organization type' USING ERRCODE = '22023';
  END IF;

  -- Validate status
  IF p_status NOT IN ('active', 'inactive', 'pending') THEN
    RAISE EXCEPTION 'Invalid organization status' USING ERRCODE = '22023';
  END IF;

  -- Insert the new organization
  INSERT INTO public.organizations (
    name,
    type,
    phone,
    status,
    created_by
  )
  VALUES (
    TRIM(p_name),
    p_type,
    p_phone,
    p_status,
    v_user_id
  )
  RETURNING
    organizations.id,
    organizations.name,
    organizations.type,
    organizations.phone,
    organizations.status,
    organizations.created_by,
    organizations.created_at
  INTO v_new_org;

  -- Check if profiles has organization_id column
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'organization_id'
  ) INTO v_has_org_id_column;

  -- Update the creator's profile to link to this organization
  IF v_has_org_id_column THEN
    -- Use organization_id if it exists
    UPDATE public.profiles
    SET organization_id = v_new_org.id
    WHERE profiles.id = v_user_id;
  ELSE
    -- For backwards compatibility, try updating preschool_id
    -- but only if preschools table exists and we can create a matching record
    -- For now, skip this to avoid foreign key errors
    -- The profile linking can be handled separately
    NULL;
  END IF;

  -- Return the created organization
  id := v_new_org.id;
  name := v_new_org.name;
  type := v_new_org.type;
  phone := v_new_org.phone;
  status := v_new_org.status;
  created_by := v_new_org.created_by;
  created_at := v_new_org.created_at;

  RETURN NEXT;

END;
$$;

-- Update comment
COMMENT ON FUNCTION public.create_organization IS
'Server-side function to create a new organization. Allows principals, superadmins, and admins '
'to create organizations. Links creator to organization via organization_id if available. '
'Supports types: preschool, daycare, primary_school, skills, tertiary, org, other. '
'Note: ''admin'' role is for Skills Development Centres, Tertiary Institutions, and Other Organizations.';

