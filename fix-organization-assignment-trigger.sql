-- ============================================
-- FIX: Auto-assign organization_id on profile creation
-- ============================================
-- This migration ensures all new profiles get an organization_id automatically
-- and fixes the trigger that was missing or not working properly

-- ============================================
-- FUNCTION: Auto-create organization and assign to new profile
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_assign_organization_to_profile()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  user_email TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- Only proceed if organization_id is NULL
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip for superadmin role - they don't need organization
  IF NEW.role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  -- Get user info
  user_email := COALESCE(NEW.email, '');
  user_first_name := COALESCE(NEW.first_name, SPLIT_PART(user_email, '@', 1));
  user_last_name := COALESCE(NEW.last_name, '');

  -- Generate organization name and slug
  org_name := TRIM(user_first_name || ' ' || user_last_name || ' Education');
  org_slug := LOWER(REPLACE(TRIM(user_first_name || '-' || user_last_name || '-' || SUBSTRING(MD5(user_email) FROM 1 FOR 8)), ' ', '-'));

  -- Create organization
  INSERT INTO public.organizations (
    name,
    slug,
    status,
    primary_contact_email
  ) VALUES (
    org_name,
    org_slug,
    'active',
    user_email
  )
  RETURNING id INTO new_org_id;

  -- Assign organization to profile
  NEW.organization_id := new_org_id;

  RAISE NOTICE 'Auto-created organization % for profile %', new_org_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block profile creation
    RAISE WARNING 'Failed to auto-create organization for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER: Apply on profile INSERT
-- ============================================

DROP TRIGGER IF EXISTS trigger_auto_assign_organization ON public.profiles;

CREATE TRIGGER trigger_auto_assign_organization
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_organization_to_profile();

-- ============================================
-- BACKFILL: Fix existing profiles without organization_id
-- ============================================

DO $$
DECLARE
  profile_record RECORD;
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
  fixed_count INT := 0;
BEGIN
  FOR profile_record IN 
    SELECT * FROM public.profiles 
    WHERE organization_id IS NULL 
    AND role != 'superadmin'
  LOOP
    -- Generate organization details
    org_name := TRIM(
      COALESCE(profile_record.first_name, SPLIT_PART(profile_record.email, '@', 1)) || ' ' || 
      COALESCE(profile_record.last_name, '') || ' Education'
    );
    
    org_slug := LOWER(REPLACE(
      TRIM(
        COALESCE(profile_record.first_name, SPLIT_PART(profile_record.email, '@', 1)) || '-' || 
        COALESCE(profile_record.last_name, '') || '-' || 
        SUBSTRING(MD5(profile_record.email) FROM 1 FOR 8)
      ), 
      ' ', '-'
    ));

    -- Create organization
    INSERT INTO public.organizations (
      name,
      slug,
      status,
      primary_contact_email
    ) VALUES (
      org_name,
      org_slug,
      'active',
      profile_record.email
    )
    ON CONFLICT (slug) DO UPDATE SET slug = organizations.slug || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)
    RETURNING id INTO new_org_id;

    -- Update profile
    UPDATE public.profiles
    SET organization_id = new_org_id
    WHERE id = profile_record.id;

    fixed_count := fixed_count + 1;

    RAISE NOTICE 'Fixed profile % - assigned org %', profile_record.email, new_org_id;
  END LOOP;

  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ BACKFILL COMPLETE';
  RAISE NOTICE '   Fixed % profiles', fixed_count;
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check remaining profiles without org_id (should only be superadmins)
DO $$
DECLARE
  remaining_count INT;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM public.profiles
  WHERE organization_id IS NULL;

  IF remaining_count > 0 THEN
    RAISE NOTICE 'Profiles still without organization_id: %', remaining_count;
    RAISE NOTICE 'These should only be superadmin accounts.';
  ELSE
    RAISE NOTICE '✅ All profiles have organization_id assigned!';
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.auto_assign_organization_to_profile() IS 
  'Automatically creates an organization and assigns it to new profiles (except superadmin)';

COMMENT ON TRIGGER trigger_auto_assign_organization ON public.profiles IS 
  'Ensures all new profiles get an organization_id on creation';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ ORGANIZATION AUTO-ASSIGNMENT FIXED';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  1. Created auto_assign_organization_to_profile() function';
  RAISE NOTICE '  2. Added trigger on profiles table';
  RAISE NOTICE '  3. Backfilled all existing profiles';
  RAISE NOTICE '';
  RAISE NOTICE 'Future profiles will automatically get organization_id';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
