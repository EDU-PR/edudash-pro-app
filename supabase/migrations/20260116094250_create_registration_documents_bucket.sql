-- Create storage bucket for registration documents (Birth Certificate, Clinic Card, Guardian ID)
-- This bucket is used by parents to upload required registration documents

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'registration-documents',
  'registration-documents',
  true,  -- Public bucket so documents can be viewed by principals
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Allow authenticated uploads to registration-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from registration-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to registration-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from registration-documents" ON storage.objects;

-- Create RLS policies for the bucket
-- Allow authenticated users to upload their own documents
CREATE POLICY "Allow authenticated uploads to registration-documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents'
);

-- Allow authenticated users to view documents (principals need to review)
CREATE POLICY "Allow authenticated reads from registration-documents" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'registration-documents'
);

-- Allow authenticated users to update their documents
CREATE POLICY "Allow authenticated updates to registration-documents" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'registration-documents'
)
WITH CHECK (
  bucket_id = 'registration-documents'
);

-- Allow public read access for shared document URLs
CREATE POLICY "Allow public reads from registration-documents" ON storage.objects
FOR SELECT TO anon
USING (
  bucket_id = 'registration-documents'
);
