-- ============================================
-- Public validation RPCs (program + invitation)
-- Date: 2025-12-18
-- Purpose:
--  1) Fix invite code validation for school_invitation_codes (used by mobile + deep links)
--  2) Add a safe public program-code validation RPC to avoid RLS blocking registration flows
-- ============================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Validate invitation codes (school_invitation_codes)
-- ------------------------------------------------------------
-- NOTE:
-- There were multiple historical implementations of validate_invitation_code.
-- The mobile app expects named args (p_code, p_email) and a JSON response with 'valid'.
-- This implementation matches the app and the existing use_invitation_code() flow.

CREATE OR REPLACE FUNCTION public.validate_invitation_code(
  p_code text,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.school_invitation_codes%rowtype;
  v_school_name text;
  v_school_slug text;
  v_result jsonb;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Missing invitation code');
  END IF;

  -- Find invitation code (case-insensitive)
  SELECT * INTO v_invitation
  FROM public.school_invitation_codes
  WHERE upper(code) = upper(btrim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired invitation code');
  END IF;

  -- Get school/org name (support both preschools and organizations as "school_id")
  SELECT name, slug INTO v_school_name, v_school_slug
  FROM public.preschools
  WHERE id = v_invitation.preschool_id;

  IF v_school_name IS NULL THEN
    SELECT name, slug INTO v_school_name, v_school_slug
    FROM public.organizations
    WHERE id = v_invitation.preschool_id;
  END IF;

  -- Build response payload
  v_result := jsonb_build_object(
    'valid', true,
    'invitation_type', v_invitation.invitation_type,
    'is_active', COALESCE(v_invitation.is_active, false),
    'current_uses', COALESCE(v_invitation.current_uses, 0),
    'max_uses', v_invitation.max_uses,
    'expires_at', v_invitation.expires_at,
    'school_name', COALESCE(v_school_name, 'Unknown'),
    'school_slug', v_school_slug,
    'school_id', v_invitation.preschool_id
  );

  -- Active checks (return friendly errors)
  IF NOT COALESCE(v_invitation.is_active, false) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation code is no longer active');
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation code has expired');
  END IF;

  IF v_invitation.max_uses IS NOT NULL AND v_invitation.max_uses > 0
     AND COALESCE(v_invitation.current_uses, 0) >= v_invitation.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation code has reached its maximum uses');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation_code(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(text, text) TO authenticated;

COMMENT ON FUNCTION public.validate_invitation_code(text, text) IS
'Validates a school/org invitation code (school_invitation_codes) and returns JSON with school info for signup/join flows.';

-- ------------------------------------------------------------
-- 2) Validate program codes (courses.course_code) for public registration
-- ------------------------------------------------------------
-- NOTE:
-- Registration flows need to validate a program code before a user is authenticated.
-- RLS often blocks direct SELECT on courses, so we expose a minimal RPC that only returns
-- a single active course matching the provided code or UUID.

CREATE OR REPLACE FUNCTION public.validate_program_code(
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := btrim(COALESCE(p_code, ''));
  v_course record;
  v_org record;
BEGIN
  IF v_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Missing program code');
  END IF;

  SELECT
    c.id,
    c.title,
    c.description,
    c.course_code,
    c.organization_id
  INTO v_course
  FROM public.courses c
  WHERE c.is_active = true
    AND (
      upper(c.course_code) = upper(v_code)
      OR c.id::text = v_code
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive program code');
  END IF;

  SELECT o.id, o.name, o.slug
  INTO v_org
  FROM public.organizations o
  WHERE o.id = v_course.organization_id;

  RETURN jsonb_build_object(
    'valid', true,
    'course', jsonb_build_object(
      'id', v_course.id,
      'title', v_course.title,
      'description', v_course.description,
      'course_code', v_course.course_code
    ),
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_program_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_program_code(text) TO authenticated;

COMMENT ON FUNCTION public.validate_program_code(text) IS
'Public-safe program code validator. Returns minimal active course + organization info for registration flows.';

COMMIT;


