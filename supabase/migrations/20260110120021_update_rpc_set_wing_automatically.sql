-- Update register_organization_member RPC to automatically set wing based on member_type
-- This ensures members are correctly assigned to youth, women, veterans, or main wing

DO $$
DECLARE
  has_members boolean;
  has_profiles boolean;
  has_wing boolean;
  has_membership_status boolean;
  has_seat_status boolean;
  has_join_date boolean;
  has_updated_at boolean;
BEGIN
  has_members := to_regclass('public.organization_members') IS NOT NULL;
  has_profiles := to_regclass('public.profiles') IS NOT NULL;

  IF NOT has_members OR NOT has_profiles THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'wing'
  ) INTO has_wing;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'membership_status'
  ) INTO has_membership_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'seat_status'
  ) INTO has_seat_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'join_date'
  ) INTO has_join_date;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'updated_at'
  ) INTO has_updated_at;

  IF NOT has_wing OR NOT has_membership_status OR NOT has_seat_status OR NOT has_join_date OR NOT has_updated_at THEN
    RETURN;
  END IF;

  EXECUTE $rpc$
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
      p_joined_via text DEFAULT 'direct_registration'::text
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $function$
    DECLARE
      v_member_id UUID;
      v_existing_member_id UUID;
      v_member_number TEXT;
      v_user_exists BOOLEAN;
      v_wing TEXT;
    BEGIN
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

      v_wing := CASE
        WHEN p_member_type LIKE 'youth_%' THEN 'youth'
        WHEN p_member_type LIKE 'women_%' THEN 'women'
        WHEN p_member_type LIKE 'veterans_%' THEN 'veterans'
        ELSE 'main'
      END;

      FOR i IN 1..10 LOOP
        SELECT EXISTS(
          SELECT 1 FROM auth.users WHERE id = p_user_id
        ) INTO v_user_exists;

        IF NOT v_user_exists THEN
          SELECT EXISTS(
            SELECT 1 FROM profiles WHERE id = p_user_id
          ) INTO v_user_exists;
        END IF;

        IF v_user_exists THEN
          EXIT;
        END IF;

        PERFORM pg_sleep(0.5 * i);
      END LOOP;

      IF NOT v_user_exists THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'USER_NOT_FOUND',
          'error', 'User does not exist in auth system after extended retry period. Account creation may be delayed. Please wait a few moments and try again, or contact support if this persists.',
          'retries_exhausted', true,
          'max_wait_seconds', 27.5
        );
      END IF;

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

      v_member_number := p_member_number;
      IF v_member_number IS NULL OR v_member_number = '' THEN
        v_member_number := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
      END IF;

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
        wing
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
        NOW(),
        v_wing
      )
      RETURNING id INTO v_member_id;

      UPDATE profiles
      SET
        organization_id = p_organization_id,
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        phone = COALESCE(p_phone, phone),
        updated_at = NOW()
      WHERE id = p_user_id;

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
          'error', 'A duplicate entry was detected. Please try again.'
        );

      WHEN foreign_key_violation THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'FK_VIOLATION',
          'error', 'User account not fully created yet. Please wait a moment and try again.'
        );

      WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'UNKNOWN_ERROR',
          'error', SQLERRM
        );
    END;
    $function$;

    COMMENT ON FUNCTION public.register_organization_member(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
    'Registers a new organization member with automatic wing assignment based on member_type. Wing is set to: youth (for youth_* types), women (for women_* types), veterans (for veterans_* types), or main (for others). Includes retry logic for timing issues when user is just created.';
  $rpc$;
END $$;
