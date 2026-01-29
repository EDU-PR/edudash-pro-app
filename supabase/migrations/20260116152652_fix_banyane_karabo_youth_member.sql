-- Fix banyanekarabo3@gmail.com routing issue
-- User was registered by youth president but has wrong role and no organization membership
-- Issue: role = 'parent' instead of 'student', and missing organization_members entry
-- Valid roles: parent, teacher, principal, superadmin, admin, instructor, student

DO $$
DECLARE
    v_user_id UUID;
    v_soa_org_id UUID := '63b6139a-e21f-447c-b322-376fb0828992'; -- Soil Of Africa organization
BEGIN
    -- Get the user's ID
    SELECT id INTO v_user_id
    FROM profiles
    WHERE email = 'banyanekarabo3@gmail.com';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User banyanekarabo3@gmail.com not found';
        RETURN;
    END IF;

    RAISE NOTICE 'Found user: %', v_user_id;

    -- Update profile role from 'parent' to 'student' (valid role for youth members)
    UPDATE profiles
    SET 
        role = 'student',
        updated_at = NOW()
    WHERE id = v_user_id
    AND role = 'parent';  -- Only update if currently 'parent'

    RAISE NOTICE 'Updated profile role to student';

    -- Check if organization membership already exists
    IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = v_user_id 
        AND organization_id = v_soa_org_id
    ) THEN
        -- Create organization membership as youth_member
        INSERT INTO organization_members (
            user_id,
            organization_id,
            member_type,
            role,
            membership_status,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_soa_org_id,
            'youth_member',
            'member',
            'active',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created organization membership as youth_member for SOA';
    ELSE
        -- Update existing membership to have correct member_type
        UPDATE organization_members
        SET 
            member_type = 'youth_member',
            membership_status = 'active',
            updated_at = NOW()
        WHERE user_id = v_user_id
        AND organization_id = v_soa_org_id;
        
        RAISE NOTICE 'Updated existing organization membership to youth_member';
    END IF;
END $$;

DO $$
DECLARE
    has_profiles boolean;
    has_org_members boolean;
    has_organizations boolean;
    has_full_name boolean;
BEGIN
    has_profiles := to_regclass('public.profiles') IS NOT NULL;
    has_org_members := to_regclass('public.organization_members') IS NOT NULL;
    has_organizations := to_regclass('public.organizations') IS NOT NULL;

    IF NOT has_profiles THEN
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'full_name'
    ) INTO has_full_name;

    IF NOT has_full_name THEN
        RETURN;
    END IF;

    -- Verification query (intentionally not returning rows in migration context)
    PERFORM 1
    FROM profiles p
    LEFT JOIN organization_members om ON om.user_id = p.id
    LEFT JOIN organizations o ON o.id = om.organization_id
    WHERE p.email = 'banyanekarabo3@gmail.com';
END $$;
