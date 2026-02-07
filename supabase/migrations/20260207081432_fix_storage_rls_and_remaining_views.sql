-- =============================================================================
-- Migration: Fix Storage RLS for candidate-resumes + remaining Security Definer Views
-- Date: 2026-02-07
-- Issues:
--   1. candidate-resumes bucket has no anon upload policy → 400 on public apply form
--   2. Seven views still flagged as Security Definer (CRITICAL) in Supabase dashboard
--   3. spatial_ref_sys has RLS disabled (PostGIS extension table — safe to ignore,
--      but we suppress the warning)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure candidate-resumes bucket exists (public = false for signed-URL access)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'candidate-resumes',
    'candidate-resumes',
    false,
    52428800, -- 50 MB
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE
SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage policies for candidate-resumes
--    - Anon can INSERT (public job application form uploads)
--    - Authenticated users (principals/teachers) can SELECT (download resumes)
--    - Service role handles DELETE via admin operations
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "anon_upload_candidate_resumes" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_candidate_resumes" ON storage.objects;
DROP POLICY IF EXISTS "service_role_all_candidate_resumes" ON storage.objects;

-- Allow anonymous uploads (public apply form)
CREATE POLICY "anon_upload_candidate_resumes"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'candidate-resumes'
);

-- Allow authenticated users to download/view resumes
CREATE POLICY "authenticated_read_candidate_resumes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'candidate-resumes'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ensure generate_resume_filename function exists (used by apply form)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_resume_filename(
    candidate_email TEXT,
    original_filename TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sanitized_email TEXT;
    file_ext TEXT;
    ts TEXT;
BEGIN
    -- Sanitize email: replace @ and . with _
    sanitized_email := REPLACE(REPLACE(candidate_email, '@', '_'), '.', '_');
    -- Extract extension
    file_ext := COALESCE(
        SUBSTRING(original_filename FROM '\.([^.]+)$'),
        'pdf'
    );
    -- Timestamp
    ts := TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS');
    RETURN sanitized_email || '_' || ts || '.' || file_ext;
END;
$$;

-- Grant execute to anon so the public apply form can call it
GRANT EXECUTE ON FUNCTION public.generate_resume_filename(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_resume_filename(TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix remaining Security Definer Views (set security_invoker = true)
--    These 7 views were missed in the earlier migration.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER VIEW IF EXISTS public.activity_logs_view
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.caps_curriculum_latest
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.caps_priority_topics
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.caps_recent_exams
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.users_with_subscription
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.v_active_teacher_seats
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.vw_teacher_overview
    SET (security_invoker = true);

-- NOTE: spatial_ref_sys is owned by the PostGIS extension and cannot be altered
-- by the migration role. This is a read-only reference table and safe to ignore.
-- The "RLS Disabled" warning in the Supabase dashboard is expected for extension tables.
