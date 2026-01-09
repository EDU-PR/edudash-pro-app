-- Fix member_type for hlorisom@soilofafrica.org
-- Date: 2026-01-10
-- Purpose: Set member_type to 'youth_president' for hlorisom@soilofafrica.org
-- WARP.md Compliance: Fix user routing to youth president dashboard

BEGIN;

-- SOA Organization ID
\set SOA_ORG_ID '63b6139a-e21f-447c-b322-376fb0828992'
\set USER_EMAIL 'hlorisom@soilofafrica.org'

-- Step 1: Get user ID from profiles
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid := '63b6139a-e21f-447c-b322-376fb0828992';
  v_member_exists boolean;
  v_current_member_type text;
BEGIN
  -- Get user ID from profiles table
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = 'hlorisom@soilofafrica.org'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: hlorisom@soilofafrica.org';
  END IF;

  RAISE NOTICE 'Found user ID: %', v_user_id;

  -- Check if organization_members record exists
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user_id
    AND organization_id = v_org_id
  ) INTO v_member_exists;

  IF v_member_exists THEN
    -- Get current member_type
    SELECT member_type INTO v_current_member_type
    FROM public.organization_members
    WHERE user_id = v_user_id
    AND organization_id = v_org_id
    LIMIT 1;

    RAISE NOTICE 'Existing member record found. Current member_type: %', v_current_member_type;

    -- Update existing record
    UPDATE public.organization_members
    SET 
      member_type = 'youth_president',
      membership_status = COALESCE(membership_status, 'active'),
      seat_status = COALESCE(seat_status, 'active'),
      updated_at = NOW()
    WHERE user_id = v_user_id
    AND organization_id = v_org_id;

    RAISE NOTICE 'Updated member_type to youth_president for user: %', v_user_id;

  ELSE
    -- Create new organization_members record
    INSERT INTO public.organization_members (
      id,
      organization_id,
      user_id,
      member_type,
      membership_status,
      seat_status,
      membership_tier,
      wing,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_org_id,
      v_user_id,
      'youth_president',
      'active',
      'active',
      'standard',
      'youth',
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created new organization_members record with member_type=youth_president for user: %', v_user_id;
  END IF;

  -- Verify the update
  SELECT member_type INTO v_current_member_type
  FROM public.organization_members
  WHERE user_id = v_user_id
  AND organization_id = v_org_id
  LIMIT 1;

  IF v_current_member_type != 'youth_president' THEN
    RAISE EXCEPTION 'Failed to set member_type to youth_president. Current value: %', v_current_member_type;
  END IF;

  RAISE NOTICE '✅ Successfully set member_type=youth_president for hlorisom@soilofafrica.org';
END $$;

-- Step 2: Verify the fix
DO $$
DECLARE
  v_user_id uuid;
  v_member_type text;
  v_seat_status text;
  v_org_id uuid := '63b6139a-e21f-447c-b322-376fb0828992';
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = 'hlorisom@soilofafrica.org'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found for verification';
  END IF;

  -- Get member_type from organization_members
  SELECT member_type, seat_status INTO v_member_type, v_seat_status
  FROM public.organization_members
  WHERE user_id = v_user_id
  AND organization_id = v_org_id
  LIMIT 1;

  IF v_member_type IS NULL THEN
    RAISE EXCEPTION 'organization_members record not found after update';
  END IF;

  IF v_member_type != 'youth_president' THEN
    RAISE EXCEPTION 'member_type verification failed. Expected: youth_president, Got: %', v_member_type;
  END IF;

  RAISE NOTICE '✅ Verification successful:';
  RAISE NOTICE '   User: hlorisom@soilofafrica.org';
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Organization ID: %', v_org_id;
  RAISE NOTICE '   Member Type: %', v_member_type;
  RAISE NOTICE '   Seat Status: %', v_seat_status;
END $$;

COMMIT;
