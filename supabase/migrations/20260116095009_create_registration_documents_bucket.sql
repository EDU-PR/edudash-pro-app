-- Migration: Create registration-documents storage bucket
-- Description: Storage bucket for parent document uploads (Birth Certificate, Clinic Card, Guardian ID)

-- Create the registration-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'registration-documents',
  'registration-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "reg_docs_parent_upload" ON storage.objects;
DROP POLICY IF EXISTS "reg_docs_authenticated_view" ON storage.objects;
DROP POLICY IF EXISTS "reg_docs_principal_view" ON storage.objects;
DROP POLICY IF EXISTS "reg_docs_update" ON storage.objects;

-- Policy: Authenticated users can upload to registration-documents bucket
CREATE POLICY "reg_docs_parent_upload" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents'
);

-- Policy: Authenticated users can view files in registration-documents bucket
CREATE POLICY "reg_docs_authenticated_view" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'registration-documents'
);

-- Policy: Authenticated users can update their uploads
CREATE POLICY "reg_docs_update" ON storage.objects
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'registration-documents'
)
WITH CHECK (
  bucket_id = 'registration-documents'
);

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets configuration. registration-documents bucket stores parent uploaded documents.';
