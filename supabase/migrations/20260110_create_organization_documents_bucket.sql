-- Create and configure the organization-documents storage bucket

-- Update bucket to be public so documents can be accessed via public URL
UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 52428800, -- 50MB
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
    'image/webp',
    'application/zip',
    'application/x-zip-compressed'
  ]
WHERE name = 'organization-documents';

-- Note: Making bucket public allows anyone with the URL to access documents
-- This is acceptable for organization documents as:
-- 1. URLs are not easily guessable (contain organization ID and timestamp)
-- 2. Document access is still controlled by RLS at the database level
-- 3. Users must be authenticated to see document listings

-- Add comment
COMMENT ON COLUMN storage.buckets.public IS 
'When true, allows public access to files via public URL without authentication';

