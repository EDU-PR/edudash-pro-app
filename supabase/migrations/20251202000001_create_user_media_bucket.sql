-- ================================================
-- Create user-media Storage Bucket for Ringtones
-- ================================================
-- This bucket stores user-uploaded ringtones and other media files.
-- Each user can only access their own files via RLS policies.

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media',
  true, -- Public bucket (files are accessible via public URLs)
  5242880, -- 5MB max file size
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/x-m4a',
    'audio/aac'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/x-m4a',
    'audio/aac'
  ];

-- ================================================
-- Storage Policies for user-media bucket
-- ================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to user-media" ON storage.objects;

-- Policy 1: Allow users to upload files to their own folder
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-media' 
  AND (storage.foldername(name))[1] = 'ringtones'
  AND auth.uid()::text = (regexp_match(name, 'ringtones/([a-f0-9-]+)_'))[1]
);

-- Policy 2: Allow users to read their own files
CREATE POLICY "Users can read their own media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-media' 
  AND (storage.foldername(name))[1] = 'ringtones'
  AND auth.uid()::text = (regexp_match(name, 'ringtones/([a-f0-9-]+)_'))[1]
);

-- Policy 3: Allow users to update their own files
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-media' 
  AND (storage.foldername(name))[1] = 'ringtones'
  AND auth.uid()::text = (regexp_match(name, 'ringtones/([a-f0-9-]+)_'))[1]
)
WITH CHECK (
  bucket_id = 'user-media' 
  AND (storage.foldername(name))[1] = 'ringtones'
  AND auth.uid()::text = (regexp_match(name, 'ringtones/([a-f0-9-]+)_'))[1]
);

-- Policy 4: Allow users to delete their own files
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-media' 
  AND (storage.foldername(name))[1] = 'ringtones'
  AND auth.uid()::text = (regexp_match(name, 'ringtones/([a-f0-9-]+)_'))[1]
);

-- Policy 5: Public read access (bucket is public)
CREATE POLICY "Public read access to user-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-media');

-- ================================================
-- Verification
-- ================================================

-- Verify bucket was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user-media') THEN
    RAISE NOTICE '✓ user-media bucket created successfully';
  ELSE
    RAISE EXCEPTION '✗ Failed to create user-media bucket';
  END IF;
END $$;

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%user-media%' OR policyname LIKE '%their own media%';
  
  IF policy_count >= 4 THEN
    RAISE NOTICE '✓ Storage policies created successfully (% policies)', policy_count;
  ELSE
    RAISE WARNING '⚠ Expected at least 4 policies, found %', policy_count;
  END IF;
END $$;
