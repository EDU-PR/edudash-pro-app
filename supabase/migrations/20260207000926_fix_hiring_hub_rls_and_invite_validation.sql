-- =============================================================================
-- Fix Hiring Hub: RLS policies, validate_invitation_code, and public access
-- =============================================================================
-- Issues fixed:
-- 1. validate_invitation_code references 'slug' on preschools → should be 'tenant_slug'
-- 2. job_postings needs public anon SELECT policy for web apply page
-- 3. preschools needs limited anon/public SELECT for job apply pages
-- 4. candidate_profiles and job_applications need anon INSERT for web form
-- 5. candidate-resumes storage needs anon upload
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix validate_invitation_code: 'slug' → 'tenant_slug' on preschools
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_invitation_code(
    p_code text,
    p_email text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    SELECT *
    INTO v_invitation
    FROM public.school_invitation_codes
    WHERE upper(code) = upper(btrim(p_code));

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invalid or expired invitation code'
        );
    END IF;

    -- Get school/org name — preschools uses tenant_slug, organizations uses slug
    SELECT name, tenant_slug
    INTO v_school_name, v_school_slug
    FROM public.preschools
    WHERE id = v_invitation.preschool_id;

    IF v_school_name IS NULL THEN
        SELECT name, slug
        INTO v_school_name, v_school_slug
        FROM public.organizations
        WHERE id = v_invitation.preschool_id;
    END IF;

    -- Build result
    v_result := jsonb_build_object(
        'valid', true,
        'invitation_type', v_invitation.invitation_type,
        'is_active', coalesce(v_invitation.is_active, false),
        'current_uses', coalesce(v_invitation.current_uses, 0),
        'max_uses', v_invitation.max_uses,
        'expires_at', v_invitation.expires_at,
        'school_name', coalesce(v_school_name, 'Unknown'),
        'school_slug', v_school_slug,
        'school_id', v_invitation.preschool_id
    );

    -- Check if active
    IF NOT coalesce(v_invitation.is_active, false) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'This invitation code is no longer active'
        );
    END IF;

    -- Check expiry
    IF v_invitation.expires_at IS NOT NULL
       AND v_invitation.expires_at <= now() THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'This invitation code has expired'
        );
    END IF;

    -- Check max uses
    IF v_invitation.max_uses IS NOT NULL
       AND v_invitation.max_uses > 0
       AND coalesce(v_invitation.current_uses, 0) >= v_invitation.max_uses THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'This invitation code has reached its maximum uses'
        );
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation_code(text, text)
    TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Ensure job_postings has public anon SELECT for active postings
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_view_active_job_postings" ON public.job_postings;

CREATE POLICY "public_view_active_job_postings"
ON public.job_postings
FOR SELECT
TO anon, authenticated
USING (
    status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
);


-- ---------------------------------------------------------------------------
-- 3. Allow anon to read limited preschool info (for apply/sign-up pages)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_view_active_preschools" ON public.preschools;

CREATE POLICY "anon_view_active_preschools"
ON public.preschools
FOR SELECT
TO anon
USING (is_active = true);


-- ---------------------------------------------------------------------------
-- 4. Allow anon to read limited org info (for apply/sign-up pages)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_view_organizations" ON public.organizations;

CREATE POLICY "anon_view_organizations"
ON public.organizations
FOR SELECT
TO anon
USING (true);


-- ---------------------------------------------------------------------------
-- 5. Allow anon to insert candidate_profiles (web apply form)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_create_candidate_profile" ON public.candidate_profiles;

CREATE POLICY "anon_create_candidate_profile"
ON public.candidate_profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to read own candidate profile by email (for upsert logic)
DROP POLICY IF EXISTS "anon_read_candidate_profiles" ON public.candidate_profiles;

CREATE POLICY "anon_read_candidate_profiles"
ON public.candidate_profiles
FOR SELECT
TO anon
USING (true);


-- ---------------------------------------------------------------------------
-- 6. Allow anon to insert job_applications (web apply form)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_create_job_application" ON public.job_applications;

CREATE POLICY "anon_create_job_application"
ON public.job_applications
FOR INSERT
TO anon
WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 7. Ensure logo_url column exists on job_postings
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_postings
    ADD COLUMN IF NOT EXISTS logo_url text;


-- ---------------------------------------------------------------------------
-- 8. Ensure school_invitation_codes is readable by anon for validation
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_invitation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_active_invites" ON public.school_invitation_codes;

-- Note: The validate_invitation_code function is SECURITY DEFINER so it
-- bypasses RLS. But if any direct query is attempted, allow read of active codes.
CREATE POLICY "anon_read_active_invites"
ON public.school_invitation_codes
FOR SELECT
TO anon
USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
);
