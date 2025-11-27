-- ============================================================
-- Create homework-files Storage Bucket
-- ============================================================
-- Purpose: Store parent/student homework submissions (images, videos, audio, PDFs, docs)
-- Access: Parents can upload for their children, Teachers can view/download
-- Organization: Files organized by preschool_id/assignment_id/student_id/filename

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homework-files',
  'homework-files',
  true, -- Public bucket (files accessible via public URL)
  52428800, -- 50MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- RLS Policies for homework-files bucket
-- ============================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Parents can upload homework files for their children" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework files in their preschool" ON storage.objects;
DROP POLICY IF EXISTS "Parents can view homework files for their children" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploaded homework files" ON storage.objects;

-- Policy 1: Parents can upload files for their children's homework
-- Pattern: homework_submissions/{preschool_id}/{assignment_id}/{student_id}/{filename}
CREATE POLICY "Parents can upload homework files for their children"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files'
  AND (
    -- Check if the user is a parent of the student in the path via parent_child_links
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_child_links.student_id::text = (string_to_array(name, '/'))[4]
      AND parent_child_links.parent_id = auth.uid()
      AND parent_child_links.relationship_status = 'active'
    )
    OR
    -- Or if the user is the student themselves
    auth.uid()::text = (string_to_array(name, '/'))[4]
  )
);

-- Policy 2: Teachers can view all homework files in their preschool
CREATE POLICY "Teachers can view homework files in their preschool"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    -- Teacher can see files in their preschool
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'teacher'
      AND users.preschool_id::text = (string_to_array(name, '/'))[2]
    )
    OR
    -- Principal can see files in their preschool
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'principal'
      AND users.preschool_id::text = (string_to_array(name, '/'))[2]
    )
  )
);

-- Policy 3: Parents can view homework files for their children
CREATE POLICY "Parents can view homework files for their children"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    -- Parent can see files for their children via parent_child_links
    EXISTS (
      SELECT 1 FROM public.parent_child_links
      WHERE parent_child_links.student_id::text = (string_to_array(name, '/'))[4]
      AND parent_child_links.parent_id = auth.uid()
      AND parent_child_links.relationship_status = 'active'
    )
    OR
    -- Student can see their own files
    auth.uid()::text = (string_to_array(name, '/'))[4]
  )
);

-- Policy 4: Users can delete their own uploaded files (within 24 hours)
CREATE POLICY "Users can delete their own uploaded homework files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    -- Can delete if uploaded recently (within 24 hours) and user is the uploader
    owner = auth.uid()
    AND created_at > now() - interval '24 hours'
  )
);

-- ============================================================
-- Grant necessary permissions
-- ============================================================

-- Note: GRANT statements for storage.objects require superuser privileges
-- These are typically configured at the Supabase project level
-- If running manually, ensure you have appropriate permissions or skip these

-- ============================================================
-- Verification query (optional - run manually to test)
-- ============================================================

-- To verify bucket creation:
-- SELECT * FROM storage.buckets WHERE id = 'homework-files';

-- To verify policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%homework%';
