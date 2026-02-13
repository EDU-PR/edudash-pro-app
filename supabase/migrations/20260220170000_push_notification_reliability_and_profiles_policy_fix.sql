-- =============================================================
-- Migration: Push notification reliability hardening (targeted critical)
-- 1) Add SECURITY DEFINER RPC for push_devices upsert to avoid RLS race issues.
-- 2) Harden current_user_org_id() lookup (auth_user_id OR id fallback).
-- 3) Replace profiles policy that referenced auth.jwt()->user_metadata.
-- =============================================================

-- -----------------------------------------------------------------
-- 1) SECURITY DEFINER RPC: upsert_push_device
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_push_device(
  p_expo_push_token text DEFAULT NULL,
  p_fcm_token text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_device_installation_id text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_device_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_platform text;
  v_installation_id text;
  v_device_id text;
  v_language text;
  v_timezone text;
  v_metadata jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_platform := lower(coalesce(nullif(trim(p_platform), ''), 'android'));
  IF v_platform NOT IN ('android', 'ios', 'web') THEN
    RAISE EXCEPTION 'INVALID_PLATFORM';
  END IF;

  v_installation_id := nullif(trim(coalesce(p_device_installation_id, p_device_id, '')), '');
  IF v_installation_id IS NULL THEN
    RAISE EXCEPTION 'DEVICE_INSTALLATION_ID_REQUIRED';
  END IF;

  v_device_id := nullif(trim(coalesce(p_device_id, v_installation_id)), '');
  v_language := lower(coalesce(nullif(trim(p_language), ''), 'en'));
  IF v_language NOT IN ('en', 'af', 'zu', 'st') THEN
    v_language := 'en';
  END IF;

  v_timezone := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  v_metadata := coalesce(p_device_metadata, '{}'::jsonb);

  INSERT INTO public.push_devices (
    user_id,
    expo_push_token,
    fcm_token,
    platform,
    is_active,
    device_id,
    device_installation_id,
    device_metadata,
    language,
    timezone,
    last_seen_at,
    revoked_at,
    updated_at
  ) VALUES (
    v_user_id,
    nullif(trim(p_expo_push_token), ''),
    nullif(trim(p_fcm_token), ''),
    v_platform,
    true,
    v_device_id,
    v_installation_id,
    v_metadata,
    v_language,
    v_timezone,
    now(),
    null,
    now()
  )
  ON CONFLICT (user_id, device_installation_id)
  DO UPDATE SET
    expo_push_token = COALESCE(EXCLUDED.expo_push_token, push_devices.expo_push_token),
    fcm_token = COALESCE(EXCLUDED.fcm_token, push_devices.fcm_token),
    platform = EXCLUDED.platform,
    is_active = true,
    device_id = COALESCE(EXCLUDED.device_id, push_devices.device_id),
    device_metadata = COALESCE(push_devices.device_metadata, '{}'::jsonb) || COALESCE(EXCLUDED.device_metadata, '{}'::jsonb),
    language = COALESCE(EXCLUDED.language, push_devices.language),
    timezone = COALESCE(EXCLUDED.timezone, push_devices.timezone),
    last_seen_at = now(),
    revoked_at = null,
    updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_device(text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_device(text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_push_device(text, text, text, text, text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.upsert_push_device(text, text, text, text, text, text, text, jsonb)
IS 'Safely upserts current authenticated user push device without client-side user_id writes.';

-- -----------------------------------------------------------------
-- 2) Harden current_user_org_id lookup helper
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, extensions
AS $$
  SELECT COALESCE(p.organization_id, p.preschool_id)
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
     OR p.id = auth.uid()
  ORDER BY CASE WHEN p.auth_user_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;
$$;

-- -----------------------------------------------------------------
-- 3) Replace profiles policy without user_metadata references
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view profiles in same org" ON public.profiles;

CREATE POLICY "Users can view profiles in same org"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR auth_user_id = auth.uid()
  OR COALESCE(organization_id, preschool_id) = public.current_user_org_id()
  OR public.is_superadmin_safe()
);

DO $$
DECLARE
  v_remaining_count integer;
BEGIN
  SELECT count(*)
  INTO v_remaining_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      COALESCE(qual, '') ILIKE '%user_metadata%'
      OR COALESCE(with_check, '') ILIKE '%user_metadata%'
    );

  RAISE NOTICE 'Remaining public policy user_metadata references: %', v_remaining_count;
END
$$;
