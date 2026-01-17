-- Create registration-documents storage bucket for parent document uploads
-- This bucket stores Birth Certificates, Clinic Cards, and Guardian IDs

-- Insert bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'registration-documents',
  'registration-documents', 
  false,  -- Private bucket - requires authentication
  10485760,  -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for the bucket

-- Policy: Allow authenticated users to upload their own documents
DROP POLICY IF EXISTS "Users can upload registration documents" ON storage.objects;
CREATE POLICY "Users can upload registration documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to view their own documents
DROP POLICY IF EXISTS "Users can view own registration documents" ON storage.objects;
CREATE POLICY "Users can view own registration documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'registration-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to update their own documents
DROP POLICY IF EXISTS "Users can update own registration documents" ON storage.objects;
CREATE POLICY "Users can update own registration documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'registration-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own documents
DROP POLICY IF EXISTS "Users can delete own registration documents" ON storage.objects;
CREATE POLICY "Users can delete own registration documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'registration-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow principals/teachers to view documents for their organization
DROP POLICY IF EXISTS "Staff can view org registration documents" ON storage.objects;
CREATE POLICY "Staff can view org registration documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'registration-documents' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'teacher', 'super_admin')
  )
);
