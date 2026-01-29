-- Add missing payment_verified_at and payment_verified_by columns to registration_requests table
-- These columns are already in child_registration_requests but were missing in registration_requests
-- This fixes the "Could not find the 'payment_verified_at' column" error when verifying payments

DO $$
DECLARE
  has_reg_requests boolean;
  has_storage_buckets boolean;
  has_storage_objects boolean;
BEGIN
  has_reg_requests := to_regclass('public.registration_requests') IS NOT NULL;
  has_storage_buckets := to_regclass('storage.buckets') IS NOT NULL;
  has_storage_objects := to_regclass('storage.objects') IS NOT NULL;

  IF has_reg_requests THEN
    EXECUTE 'ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES auth.users(id)';
    EXECUTE 'COMMENT ON COLUMN public.registration_requests.payment_verified_at IS ''When payment was verified by principal''';
    EXECUTE 'COMMENT ON COLUMN public.registration_requests.payment_verified_by IS ''User ID of principal who verified payment''';
  END IF;

  IF has_storage_buckets THEN
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'registration-documents',
        'registration-documents',
        false,
        10485760,
        ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping storage.buckets insert: insufficient privilege';
    END;
  END IF;

  IF has_storage_objects THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Users can upload their own registration documents'
    ) THEN
      BEGIN
        EXECUTE $ddl$
          CREATE POLICY "Users can upload their own registration documents"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'registration-documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
        $ddl$;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'Skipping storage.objects upload policy: insufficient privilege';
      END;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Users can view their own registration documents'
    ) THEN
      BEGIN
        EXECUTE $ddl$
          CREATE POLICY "Users can view their own registration documents"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (
            bucket_id = 'registration-documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
        $ddl$;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'Skipping storage.objects view policy: insufficient privilege';
      END;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Principals can view registration documents for their school'
    ) THEN
      BEGIN
        EXECUTE $ddl$
          CREATE POLICY "Principals can view registration documents for their school"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (
            bucket_id = 'registration-documents' AND
            EXISTS (
              SELECT 1 FROM profiles p
              WHERE p.id = auth.uid()
              AND p.role IN ('principal', 'super_admin')
            )
          );
        $ddl$;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'Skipping storage.objects principal policy: insufficient privilege';
      END;
    END IF;
  END IF;
END $$;
