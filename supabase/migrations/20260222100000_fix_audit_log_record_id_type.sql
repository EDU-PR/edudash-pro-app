-- ============================================================================
-- Fix: superadmin_audit_log.record_id type + RPC audit insert casts
--
-- Problem: record_id column is UUID but RPCs insert `p_entity_id::text`.
-- Solution: ALTER the column to TEXT — audit logs should store any entity
-- identifier (UUID, composite key, etc.) as text for flexibility.
-- Also fix both RPCs to use p_entity_id (UUID) directly without ::text cast
-- if we keep UUID — but TEXT is more flexible for audit, so we convert.
-- ============================================================================

-- Step 1: Alter audit log column from UUID → TEXT
ALTER TABLE IF EXISTS public.superadmin_audit_log
  ALTER COLUMN record_id TYPE text USING record_id::text;

-- Step 2: Re-create superadmin_update_entity_type with corrected audit insert
-- (record_id no longer needs ::text cast — column is now TEXT)
CREATE OR REPLACE FUNCTION public.superadmin_update_entity_type(
  p_entity_type text,
  p_entity_id uuid,
  p_next_type text,
  p_sync_duplicates boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_admin_profile_id uuid := NULL;
  v_admin_email text := 'service-role@system.local';
  v_entity_type text := lower(trim(coalesce(p_entity_type, '')));
  v_next_type text := lower(trim(coalesce(p_next_type, '')));
  v_prev_type text := NULL;
  v_prev_school_type text := NULL;
  v_effective_org_type text := NULL;
  v_legacy_type text := NULL;
  v_table_name text := NULL;
  v_changed boolean := false;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_allowed_org_types text[] := ARRAY[
    'org', 'preschool', 'daycare', 'k12', 'primary_school', 'skills',
    'tertiary', 'other'
  ];
  v_allowed_school_types text[] := ARRAY[
    'preschool', 'combined', 'community_school', 'primary', 'secondary'
  ];
BEGIN
  IF v_role <> 'service_role' THEN
    v_is_admin := public.is_superadmin_safe();
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Access denied: Only super admins can update entity type';
    END IF;

    SELECT p.id, COALESCE(p.email, p.full_name, 'superadmin@system.local')
    INTO v_admin_profile_id, v_admin_email
    FROM public.profiles p
    WHERE p.id = v_uid OR p.auth_user_id = v_uid
    ORDER BY p.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_entity_type NOT IN ('preschool', 'organization') THEN
    RAISE EXCEPTION 'Unsupported entity type for type change: %. Only preschool and organization are supported.', p_entity_type;
  END IF;

  IF v_entity_type = 'organization' THEN
    IF NOT (v_next_type = ANY(v_allowed_org_types)) THEN
      RAISE EXCEPTION 'Invalid organization_type: %', p_next_type;
    END IF;

    SELECT row_to_json(o)::jsonb, o.organization_type
    INTO v_old, v_prev_type
    FROM public.organizations o
    WHERE o.id = p_entity_id
    FOR UPDATE;

    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Organization not found for id %', p_entity_id;
    END IF;

    v_legacy_type := CASE
      WHEN v_next_type = 'preschool' THEN 'preschool'
      WHEN v_next_type = 'k12' THEN 'k12_school'
      WHEN v_next_type = 'daycare' THEN 'daycare'
      WHEN v_next_type = 'skills' THEN 'skills_development'
      WHEN v_next_type = 'tertiary' THEN 'tertiary'
      WHEN v_next_type = 'primary_school' THEN 'primary_school'
      WHEN v_next_type = 'other' THEN 'other'
      ELSE 'org'
    END;

    UPDATE public.organizations
    SET organization_type = v_next_type,
        type = v_legacy_type,
        updated_at = NOW()
    WHERE id = p_entity_id;

    v_changed := FOUND;
    v_table_name := 'organizations';

    IF p_sync_duplicates THEN
      UPDATE public.preschools
      SET school_type = CASE
          WHEN v_next_type IN ('k12', 'primary_school') THEN 'combined'
          WHEN v_next_type IN ('preschool', 'daycare') THEN 'preschool'
          ELSE school_type
        END,
        updated_at = NOW()
      WHERE id = p_entity_id;
    END IF;

    SELECT row_to_json(o)::jsonb INTO v_new
    FROM public.organizations o
    WHERE o.id = p_entity_id;
  ELSE
    IF NOT (v_next_type = ANY(v_allowed_school_types)) THEN
      RAISE EXCEPTION 'Invalid school_type for preschool: %', p_next_type;
    END IF;

    SELECT row_to_json(p)::jsonb, p.school_type
    INTO v_old, v_prev_school_type
    FROM public.preschools p
    WHERE p.id = p_entity_id
    FOR UPDATE;

    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Preschool not found for id %', p_entity_id;
    END IF;

    UPDATE public.preschools
    SET school_type = v_next_type,
        updated_at = NOW()
    WHERE id = p_entity_id;

    v_changed := FOUND;
    v_table_name := 'preschools';

    IF p_sync_duplicates THEN
      v_effective_org_type := CASE
        WHEN v_next_type IN ('combined', 'community_school', 'primary', 'secondary', 'k12') THEN 'k12'
        WHEN v_next_type = 'preschool' THEN 'preschool'
        ELSE 'org'
      END;

      UPDATE public.organizations
      SET organization_type = v_effective_org_type,
          type = CASE
            WHEN v_effective_org_type = 'k12' THEN 'k12_school'
            WHEN v_effective_org_type = 'preschool' THEN 'preschool'
            ELSE 'org'
          END,
          updated_at = NOW()
      WHERE id = p_entity_id;
    END IF;

    SELECT row_to_json(p)::jsonb INTO v_new
    FROM public.preschools p
    WHERE p.id = p_entity_id;
  END IF;

  IF v_changed AND to_regclass('public.superadmin_audit_log') IS NOT NULL THEN
    INSERT INTO public.superadmin_audit_log (
      action, superadmin_user_id, superadmin_email,
      table_name, record_id, old_values, new_values, created_at
    ) VALUES (
      'update_entity_type', v_admin_profile_id,
      COALESCE(v_admin_email, 'service-role@system.local'),
      v_table_name, p_entity_id::text, v_old, v_new, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', v_changed,
    'entity_type', v_entity_type,
    'entity_id', p_entity_id,
    'previous_type', COALESCE(v_prev_type, v_prev_school_type),
    'next_type', v_next_type
  );
END;
$$;

-- Step 3: Re-create superadmin_update_entity_profile with corrected audit insert
CREATE OR REPLACE FUNCTION public.superadmin_update_entity_profile(
  p_entity_type text,
  p_entity_id uuid,
  p_name text,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_is_verified boolean DEFAULT NULL,
  p_sync_duplicates boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_admin_profile_id uuid := NULL;
  v_admin_email text := 'service-role@system.local';
  v_entity_type text := lower(trim(coalesce(p_entity_type, '')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(trim(coalesce(p_contact_email, '')), '');
  v_phone text := nullif(trim(coalesce(p_contact_phone, '')), '');
  v_address text := nullif(trim(coalesce(p_address, '')), '');
  v_city text := nullif(trim(coalesce(p_city, '')), '');
  v_province text := nullif(trim(coalesce(p_province, '')), '');
  v_country text := nullif(trim(coalesce(p_country, '')), '');
  v_table_name text := NULL;
  v_changed boolean := false;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
BEGIN
  IF v_role <> 'service_role' THEN
    v_is_admin := public.is_superadmin_safe();
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Access denied: Only super admins can update entity profile';
    END IF;

    SELECT p.id, COALESCE(p.email, p.full_name, 'superadmin@system.local')
    INTO v_admin_profile_id, v_admin_email
    FROM public.profiles p
    WHERE p.id = v_uid OR p.auth_user_id = v_uid
    ORDER BY p.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_entity_type NOT IN ('preschool', 'organization', 'school') THEN
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF v_entity_type = 'preschool' THEN
    SELECT row_to_json(p)::jsonb INTO v_old
    FROM public.preschools p
    WHERE p.id = p_entity_id
    FOR UPDATE;

    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Preschool not found for id %', p_entity_id;
    END IF;

    UPDATE public.preschools
    SET
      name = v_name,
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      address = COALESCE(v_address, address),
      city = COALESCE(v_city, city),
      province = COALESCE(v_province, province),
      country = COALESCE(v_country, country),
      is_active = COALESCE(p_is_active, is_active),
      is_verified = COALESCE(p_is_verified, is_verified),
      updated_at = NOW()
    WHERE id = p_entity_id;

    v_changed := FOUND;
    v_table_name := 'preschools';

    IF p_sync_duplicates THEN
      UPDATE public.organizations
      SET
        name = v_name,
        contact_email = COALESCE(v_email, contact_email),
        contact_phone = COALESCE(v_phone, contact_phone),
        address = COALESCE(v_address, address),
        city = COALESCE(v_city, city),
        province = COALESCE(v_province, province),
        country = COALESCE(v_country, country),
        is_active = COALESCE(p_is_active, is_active),
        is_verified = COALESCE(p_is_verified, is_verified),
        updated_at = NOW()
      WHERE id = p_entity_id;
    END IF;

    SELECT row_to_json(p)::jsonb INTO v_new
    FROM public.preschools p
    WHERE p.id = p_entity_id;
  ELSIF v_entity_type = 'organization' THEN
    SELECT row_to_json(o)::jsonb INTO v_old
    FROM public.organizations o
    WHERE o.id = p_entity_id
    FOR UPDATE;

    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Organization not found for id %', p_entity_id;
    END IF;

    UPDATE public.organizations
    SET
      name = v_name,
      contact_email = COALESCE(v_email, contact_email),
      contact_phone = COALESCE(v_phone, contact_phone),
      address = COALESCE(v_address, address),
      city = COALESCE(v_city, city),
      province = COALESCE(v_province, province),
      country = COALESCE(v_country, country),
      is_active = COALESCE(p_is_active, is_active),
      is_verified = COALESCE(p_is_verified, is_verified),
      updated_at = NOW()
    WHERE id = p_entity_id;

    v_changed := FOUND;
    v_table_name := 'organizations';

    IF p_sync_duplicates THEN
      UPDATE public.preschools
      SET
        name = v_name,
        email = COALESCE(v_email, email),
        phone = COALESCE(v_phone, phone),
        address = COALESCE(v_address, address),
        city = COALESCE(v_city, city),
        province = COALESCE(v_province, province),
        country = COALESCE(v_country, country),
        is_active = COALESCE(p_is_active, is_active),
        is_verified = COALESCE(p_is_verified, is_verified),
        updated_at = NOW()
      WHERE id = p_entity_id;
    END IF;

    SELECT row_to_json(o)::jsonb INTO v_new
    FROM public.organizations o
    WHERE o.id = p_entity_id;
  ELSE
    SELECT row_to_json(s)::jsonb INTO v_old
    FROM public.schools s
    WHERE s.id = p_entity_id
    FOR UPDATE;

    IF v_old IS NULL THEN
      RAISE EXCEPTION 'School not found for id %', p_entity_id;
    END IF;

    UPDATE public.schools
    SET
      name = v_name,
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      address = COALESCE(v_address, address),
      city = COALESCE(v_city, city),
      province = COALESCE(v_province, province),
      country = COALESCE(v_country, country),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = NOW()
    WHERE id = p_entity_id;

    v_changed := FOUND;
    v_table_name := 'schools';

    SELECT row_to_json(s)::jsonb INTO v_new
    FROM public.schools s
    WHERE s.id = p_entity_id;
  END IF;

  IF v_changed AND to_regclass('public.superadmin_audit_log') IS NOT NULL THEN
    INSERT INTO public.superadmin_audit_log (
      action, superadmin_user_id, superadmin_email,
      table_name, record_id, old_values, new_values, created_at
    ) VALUES (
      'update_entity_profile', v_admin_profile_id,
      COALESCE(v_admin_email, 'service-role@system.local'),
      v_table_name, p_entity_id::text, v_old, v_new, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', v_changed,
    'entity_type', v_entity_type,
    'entity_id', p_entity_id
  );
END;
$$;

-- Grants (re-apply)
GRANT EXECUTE ON FUNCTION public.superadmin_update_entity_type TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_update_entity_profile TO authenticated, service_role;
