-- Recreate generated-pdfs storage policies with organization_id support

BEGIN;

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-pdfs',
  'generated-pdfs',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS generated_pdfs_select_own ON storage.objects;
DROP POLICY IF EXISTS generated_pdfs_select_org ON storage.objects;
DROP POLICY IF EXISTS generated_pdfs_insert_own ON storage.objects;
DROP POLICY IF EXISTS generated_pdfs_update_own ON storage.objects;
DROP POLICY IF EXISTS generated_pdfs_delete_own ON storage.objects;

-- Users can view their own PDFs (user folder or org/user folder)
CREATE POLICY generated_pdfs_select_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- Organization members can view org PDFs (if path starts with preschool_id or organization_id)
CREATE POLICY generated_pdfs_select_org ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.preschool_id::text = (storage.foldername(name))[1]
          OR profiles.organization_id::text = (storage.foldername(name))[1]
        )
    )
  );

-- Users can upload to their own folder or org/user folder
CREATE POLICY generated_pdfs_insert_own ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[2] = auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (
              profiles.preschool_id::text = (storage.foldername(name))[1]
              OR profiles.organization_id::text = (storage.foldername(name))[1]
            )
        )
      )
    )
  );

-- Users can update their own files
CREATE POLICY generated_pdfs_update_own ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- Users can delete their own files
CREATE POLICY generated_pdfs_delete_own ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

COMMIT;
