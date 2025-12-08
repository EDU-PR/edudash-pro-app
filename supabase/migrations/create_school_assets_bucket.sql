-- Create storage bucket for school assets (logos, signatures, etc.)
-- Run this in Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-assets',
  'school-assets',
  true,  -- Public bucket so logos/signatures can be viewed
  5242880,  -- 5MB file size limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
);

-- Add RLS policies for the bucket

-- Allow authenticated users to upload files to their own preschool folder
CREATE POLICY "Principals can upload school assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'school-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT preschool_id::text
    FROM profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'admin')
  )
);

-- Allow authenticated users to update files in their own preschool folder
CREATE POLICY "Principals can update school assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'school-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT preschool_id::text
    FROM profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'admin')
  )
);

-- Allow public read access (since logos/signatures need to be viewed in reports)
CREATE POLICY "Public can view school assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'school-assets');

-- Verify bucket was created
SELECT 
  id,
  name, 
  public,
  file_size_limit / 1024 / 1024 as max_size_mb,
  allowed_mime_types
FROM storage.buckets 
WHERE name = 'school-assets';

-- Verify policies
SELECT 
  policyname,
  tablename,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%school%';
