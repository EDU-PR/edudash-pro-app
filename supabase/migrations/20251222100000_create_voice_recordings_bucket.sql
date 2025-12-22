-- Migration: Create voice_recordings bucket with proper RLS policies
-- This fixes the 400 error when accessing signed URLs for voice recordings
-- The bucket was referenced in code but never officially created in migrations

-- Create the voice_recordings bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice_recordings',
  'voice_recordings',
  false,  -- Private bucket, requires signed URLs
  52428800,  -- 50MB limit per file
  ARRAY['audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a', 'audio/aac']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if any (clean slate)
DROP POLICY IF EXISTS "voice_recordings_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "voice_recordings_select_own" ON storage.objects;
DROP POLICY IF EXISTS "voice_recordings_update_own" ON storage.objects;
DROP POLICY IF EXISTS "voice_recordings_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "voice_recordings_service_role" ON storage.objects;

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can INSERT their own voice recordings
-- Path structure: {user_id}/{thread_id}/{filename} OR {user_id}/{filename}
CREATE POLICY "voice_recordings_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice_recordings'
  AND (
    -- Format: user_id/thread_id/filename
    (storage.foldername(name))[1] = auth.uid()::text
    -- OR Format: user_id/filename (direct upload)
    OR split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Policy: Users can SELECT/read their own voice recordings
-- Also allow access to recordings in threads they're part of
CREATE POLICY "voice_recordings_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice_recordings'
  AND (
    -- Own recordings
    (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
    -- OR recordings in threads they participate in
    OR EXISTS (
      SELECT 1 FROM message_threads mt
      WHERE mt.id::text = (storage.foldername(name))[2]
      AND (mt.parent_id = auth.uid() OR mt.teacher_id = auth.uid())
    )
  )
);

-- Policy: Users can UPDATE their own voice recordings (metadata)
CREATE POLICY "voice_recordings_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice_recordings'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'voice_recordings'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Policy: Users can DELETE their own voice recordings
CREATE POLICY "voice_recordings_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice_recordings'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Policy: Service role has full access (for Edge Functions)
CREATE POLICY "voice_recordings_service_role"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'voice_recordings')
WITH CHECK (bucket_id = 'voice_recordings');

-- Comment for documentation
COMMENT ON POLICY "voice_recordings_insert_own" ON storage.objects IS 
  'Allows authenticated users to upload voice recordings to their own folder';
COMMENT ON POLICY "voice_recordings_select_own" ON storage.objects IS 
  'Allows users to access their own recordings and recordings in threads they participate in';
