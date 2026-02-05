-- Enforce free-tier image upload limits for AI attachments

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects RLS enable: insufficient privilege';
    END;

    -- Ensure attachments bucket exists (idempotent)
    BEGIN
      EXECUTE $sql$
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          'attachments',
          'attachments',
          false,
          52428800,
          ARRAY[
            'image/jpeg','image/png','image/gif','image/webp','image/bmp',
            'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain','text/markdown','text/csv','application/json'
          ]
        )
        ON CONFLICT (id) DO UPDATE
        SET public = EXCLUDED.public,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
      $sql$;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping attachments bucket upsert: insufficient privilege';
    END;

    -- Restrictive policy: enforce free-tier image limit (10/day) for attachments bucket
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS attachments_upload_limit_images ON storage.objects';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping policy drop: insufficient privilege';
    END;

    BEGIN
      EXECUTE $sql$
        CREATE POLICY attachments_upload_limit_images
        ON storage.objects
        AS RESTRICTIVE
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id <> 'attachments'
          OR (
            bucket_id = 'attachments'
            AND (storage.foldername(name))[1] = auth.uid()::text
            AND (
              (
                COALESCE(metadata->>'mimetype','') NOT LIKE 'image/%'
                AND name !~* '\\.(jpg|jpeg|png|gif|webp|bmp)$'
              )
              OR get_user_subscription_tier(auth.uid()) NOT IN ('free','trial')
              OR (
                SELECT COUNT(*)
                FROM storage.objects o
                WHERE o.bucket_id = 'attachments'
                  AND (storage.foldername(o.name))[1] = auth.uid()::text
                  AND o.created_at::date = CURRENT_DATE
                  AND (
                    COALESCE(o.metadata->>'mimetype','') LIKE 'image/%'
                    OR o.name ~* '\\.(jpg|jpeg|png|gif|webp|bmp)$'
                  )
              ) < 10
            )
          )
        );
      $sql$;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping attachments upload policy: insufficient privilege';
    END;
  ELSE
    RAISE NOTICE 'Skipping storage.objects policies: storage.objects table missing';
  END IF;
END$$;
