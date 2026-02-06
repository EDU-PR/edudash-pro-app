-- Fix "infinite recursion detected in policy for relation objects"
-- on proof-of-payments storage bucket.
--
-- The existing policies likely contain self-referencing subqueries
-- on storage.objects. This migration drops ALL existing policies
-- for the bucket and recreates simple, non-recursive ones.
--
-- Path convention: proof-of-payments/{user_id}/{child_id}/{filename}

BEGIN;

-- Ensure the bucket exists with correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'proof-of-payments',
    'proof-of-payments',
    true,
    52428800, -- 50 MB
    ARRAY[
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf'
    ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf'
    ]::text[];

-- Drop ALL existing policies for this bucket to eliminate recursion
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND qual::text LIKE '%proof-of-payments%'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON storage.objects',
            pol.policyname
        );
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- SELECT: Authenticated users can read files in their own folder
CREATE POLICY pop_select_own ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'proof-of-payments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- SELECT: Principals/teachers can read any file in their org
CREATE POLICY pop_select_org ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'proof-of-payments'
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'principal_admin', 'teacher', 'super_admin')
        )
    );

-- INSERT: Authenticated users can upload to their own folder
CREATE POLICY pop_insert_own ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'proof-of-payments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- UPDATE: Authenticated users can update their own files
CREATE POLICY pop_update_own ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'proof-of-payments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'proof-of-payments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- DELETE: Authenticated users can delete their own files
CREATE POLICY pop_delete_own ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'proof-of-payments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

COMMIT;
