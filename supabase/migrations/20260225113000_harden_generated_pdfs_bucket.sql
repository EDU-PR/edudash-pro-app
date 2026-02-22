-- Harden generated-pdfs storage bucket for Dash PDF export links.
-- Idempotent: can run repeatedly across environments.

BEGIN;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Skipping generated-pdfs bucket setup: storage.buckets table missing';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'generated-pdfs',
    'generated-pdfs',
    false,
    10485760,
    ARRAY['application/pdf']::text[]
  )
  ON CONFLICT (id) DO UPDATE
  SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
END
$$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Skipping generated-pdfs policies: storage.objects table missing';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS generated_pdfs_select_own ON storage.objects;
  DROP POLICY IF EXISTS generated_pdfs_select_org ON storage.objects;
  DROP POLICY IF EXISTS generated_pdfs_insert_own ON storage.objects;
  DROP POLICY IF EXISTS generated_pdfs_update_own ON storage.objects;
  DROP POLICY IF EXISTS generated_pdfs_delete_own ON storage.objects;

  CREATE POLICY generated_pdfs_select_own ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'generated-pdfs'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[2] = auth.uid()::text
      )
    );

  CREATE POLICY generated_pdfs_select_org ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'generated-pdfs'
      AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND (
            profiles.preschool_id::text = (storage.foldername(name))[1]
            OR profiles.organization_id::text = (storage.foldername(name))[1]
          )
      )
    );

  CREATE POLICY generated_pdfs_insert_own ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'generated-pdfs'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (
          (storage.foldername(name))[2] = auth.uid()::text
          AND EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND (
                profiles.preschool_id::text = (storage.foldername(name))[1]
                OR profiles.organization_id::text = (storage.foldername(name))[1]
              )
          )
        )
      )
    );

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

  CREATE POLICY generated_pdfs_delete_own ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'generated-pdfs'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[2] = auth.uid()::text
      )
    );
END
$$;

COMMIT;
