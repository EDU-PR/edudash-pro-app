BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'name-practice-snapshots',
  'name-practice-snapshots',
  false,
  20971520,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS name_practice_snapshots_select ON storage.objects;
DROP POLICY IF EXISTS name_practice_snapshots_insert ON storage.objects;
DROP POLICY IF EXISTS name_practice_snapshots_update ON storage.objects;
DROP POLICY IF EXISTS name_practice_snapshots_delete ON storage.objects;

CREATE POLICY name_practice_snapshots_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'name-practice-snapshots'
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
          AND (
            p.preschool_id::text = (storage.foldername(name))[1]
            OR p.organization_id::text = (storage.foldername(name))[1]
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id::text = (storage.foldername(name))[2]
          AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      )
    )
  );

CREATE POLICY name_practice_snapshots_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'name-practice-snapshots'
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
          AND (
            p.preschool_id::text = (storage.foldername(name))[1]
            OR p.organization_id::text = (storage.foldername(name))[1]
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id::text = (storage.foldername(name))[2]
          AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      )
    )
  );

CREATE POLICY name_practice_snapshots_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'name-practice-snapshots'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'name-practice-snapshots'
  );

CREATE POLICY name_practice_snapshots_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'name-practice-snapshots'
    AND owner = auth.uid()
  );

COMMIT;
