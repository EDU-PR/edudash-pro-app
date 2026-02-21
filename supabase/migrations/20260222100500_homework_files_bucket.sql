BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homework-files',
  'homework-files',
  true,
  104857600,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = true
WHERE id = 'homework-files';

DROP POLICY IF EXISTS homework_files_select ON storage.objects;
DROP POLICY IF EXISTS homework_files_insert ON storage.objects;
DROP POLICY IF EXISTS homework_files_update ON storage.objects;
DROP POLICY IF EXISTS homework_files_delete ON storage.objects;

CREATE POLICY homework_files_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
            p.preschool_id::text = (storage.foldername(name))[2]
            OR p.organization_id::text = (storage.foldername(name))[2]
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.students s
        WHERE (
            s.parent_id = auth.uid()
            OR s.guardian_id = auth.uid()
          )
          AND (
            s.id::text = (storage.foldername(name))[4]
            OR s.preschool_id::text = (storage.foldername(name))[2]
            OR s.organization_id::text = (storage.foldername(name))[2]
          )
      )
    )
  );

CREATE POLICY homework_files_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
          AND (
            p.preschool_id::text = (storage.foldername(name))[2]
            OR p.organization_id::text = (storage.foldername(name))[2]
          )
      )
      OR (
        (storage.foldername(name))[1] = 'homework_submissions'
        AND EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id::text = (storage.foldername(name))[4]
            AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
        )
      )
    )
  );

CREATE POLICY homework_files_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
          AND (
            p.preschool_id::text = (storage.foldername(name))[2]
            OR p.organization_id::text = (storage.foldername(name))[2]
          )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'homework-files'
  );

CREATE POLICY homework_files_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
          AND (
            p.preschool_id::text = (storage.foldername(name))[2]
            OR p.organization_id::text = (storage.foldername(name))[2]
          )
      )
    )
  );

COMMIT;
