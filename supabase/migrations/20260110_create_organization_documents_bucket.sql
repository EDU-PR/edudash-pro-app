-- Create and configure the organization-documents storage bucket

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-documents',
  'organization-documents',
  false, -- Not public by default, use RLS policies
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET 
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can view documents" ON storage.objects;

-- Create storage policies for organization-documents bucket
-- Allow admins/executives to upload documents
CREATE POLICY "Admins can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'organization-documents'
  AND user_can_manage_org_members((storage.foldername(name))[1]::uuid)
);

-- Allow admins/executives to update documents
CREATE POLICY "Admins can update documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'organization-documents'
  AND user_can_manage_org_members((storage.foldername(name))[1]::uuid)
);

-- Allow admins/executives to delete documents
CREATE POLICY "Admins can delete documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'organization-documents'
  AND user_can_manage_org_members((storage.foldername(name))[1]::uuid)
);

-- Allow members to view/download documents from their organization
CREATE POLICY "Members can view documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'organization-documents'
  AND user_can_view_org_members((storage.foldername(name))[1]::uuid)
);

-- Add comments
COMMENT ON POLICY "Admins can upload documents" ON storage.objects IS
'Allows admins and executives to upload documents to their organization folder';

COMMENT ON POLICY "Admins can update documents" ON storage.objects IS
'Allows admins and executives to update documents in their organization folder';

COMMENT ON POLICY "Admins can delete documents" ON storage.objects IS
'Allows admins and executives to delete documents from their organization folder';

COMMENT ON POLICY "Members can view documents" ON storage.objects IS
'Allows members to view and download documents from their organization folder';
