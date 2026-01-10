-- Approve ksaukazi@gmail.com as Youth Secretary
-- Date: 2026-01-11
-- Purpose: Approve the pending invite for ksaukazi@gmail.com and create organization_member record

DO $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_org_id uuid := '63b6139a-e21f-447c-b322-376fb0828992'; -- Youth organization
  v_join_request_id uuid;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'ksaukazi@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User ksaukazi@gmail.com not found in auth.users';
    RETURN;
  END IF;

  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'Profile not found for ksaukazi@gmail.com';
    RETURN;
  END IF;

  -- Get the join_request ID
  SELECT id INTO v_join_request_id
  FROM public.join_requests
  WHERE requester_email = 'ksaukazi@gmail.com'
    AND status = 'pending'
    AND request_type = 'staff_invite'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create/update organization_member FIRST with correct member_type
  -- This avoids the trigger trying to set role incorrectly
  INSERT INTO public.organization_members (
    id,
    user_id,
    organization_id,
    member_type,
    membership_status,
    membership_tier,
    first_name,
    last_name,
    email,
    phone,
    join_date,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    v_user_id,
    v_org_id,
    'youth_secretary', -- Set member_type, not role
    'active',
    'standard',
    COALESCE(p.first_name, ''),
    COALESCE(p.last_name, ''),
    'ksaukazi@gmail.com',
    p.phone,
    NOW(),
    NOW(),
    NOW()
  FROM public.profiles p
  WHERE p.id = v_user_id
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET member_type = 'youth_secretary',
      membership_status = 'active',
      updated_at = NOW();
  
  RAISE NOTICE 'Created/updated organization_member record for ksaukazi@gmail.com as youth_secretary';
  
  -- Update join_request to approved AFTER organization_member exists
  -- Temporarily disable trigger to avoid role update issue
  IF v_join_request_id IS NOT NULL THEN
    -- Disable trigger temporarily
    ALTER TABLE public.join_requests DISABLE TRIGGER tr_handle_join_request_approval;
    
    UPDATE public.join_requests
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = v_join_request_id;
    
    -- Re-enable trigger
    ALTER TABLE public.join_requests ENABLE TRIGGER tr_handle_join_request_approval;
    
    RAISE NOTICE 'Updated join_request % to approved', v_join_request_id;
  END IF;

  -- Organization_member should already be created above
  -- Just ensure it's correct
  UPDATE public.organization_members
  SET member_type = 'youth_secretary',
      membership_status = 'active',
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND organization_id = v_org_id
    AND (member_type != 'youth_secretary' OR membership_status != 'active');

  -- Update profile if needed
  UPDATE public.profiles
  SET organization_id = v_org_id,
      updated_at = NOW()
  WHERE id = v_user_id
    AND (organization_id IS NULL OR organization_id != v_org_id);

  RAISE NOTICE 'Successfully approved ksaukazi@gmail.com as Youth Secretary';
END $$;
