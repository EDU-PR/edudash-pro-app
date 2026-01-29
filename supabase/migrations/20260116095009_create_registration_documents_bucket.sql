-- Migration: Create registration-documents storage bucket
-- Description: Storage bucket for parent document uploads (Birth Certificate, Clinic Card, Guardian ID)

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    BEGIN
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
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.buckets insert: insufficient privilege';
    END;

    BEGIN
      EXECUTE 'COMMENT ON TABLE storage.buckets IS ''Storage buckets configuration. registration-documents bucket stores parent uploaded documents.''';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.buckets comment: insufficient privilege';
    END;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.objects RLS enable: insufficient privilege';
    END;

    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "reg_docs_parent_upload" ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS "reg_docs_authenticated_view" ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS "reg_docs_principal_view" ON storage.objects';
      EXECUTE 'DROP POLICY IF EXISTS "reg_docs_update" ON storage.objects';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.objects policy drops: insufficient privilege';
    END;

    BEGIN
      EXECUTE $ddl$
        CREATE POLICY "reg_docs_parent_upload" ON storage.objects
        FOR INSERT 
        TO authenticated
        WITH CHECK (
          bucket_id = 'registration-documents'
        );
      $ddl$;
      EXECUTE $ddl$
        CREATE POLICY "reg_docs_authenticated_view" ON storage.objects
        FOR SELECT 
        TO authenticated
        USING (
          bucket_id = 'registration-documents'
        );
      $ddl$;
      EXECUTE $ddl$
        CREATE POLICY "reg_docs_update" ON storage.objects
        FOR UPDATE 
        TO authenticated
        USING (
          bucket_id = 'registration-documents'
        )
        WITH CHECK (
          bucket_id = 'registration-documents'
        );
      $ddl$;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.objects policies: insufficient privilege';
    END;
  END IF;
END $$;
