BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stationery-evidence',
  'stationery-evidence',
  false,
  20971520,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS stationery_evidence_select ON storage.objects;
DROP POLICY IF EXISTS stationery_evidence_insert ON storage.objects;
DROP POLICY IF EXISTS stationery_evidence_update ON storage.objects;
DROP POLICY IF EXISTS stationery_evidence_delete ON storage.objects;

CREATE POLICY stationery_evidence_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'stationery-evidence'
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
          AND lower(COALESCE(p.role, '')) IN ('principal', 'principal_admin', 'admin', 'owner', 'superadmin', 'super_admin', 'teacher')
          AND COALESCE(p.organization_id, p.preschool_id)::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id::text = (storage.foldername(name))[2]
          AND COALESCE(s.preschool_id, s.organization_id)::text = (storage.foldername(name))[1]
          AND s.id IN (SELECT public.get_my_children_ids())
      )
    )
  );

CREATE POLICY stationery_evidence_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stationery-evidence'
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
          AND lower(COALESCE(p.role, '')) IN ('principal', 'principal_admin', 'admin', 'owner', 'superadmin', 'super_admin')
          AND COALESCE(p.organization_id, p.preschool_id)::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id::text = (storage.foldername(name))[2]
          AND COALESCE(s.preschool_id, s.organization_id)::text = (storage.foldername(name))[1]
          AND s.id IN (SELECT public.get_my_children_ids())
      )
    )
  );

CREATE POLICY stationery_evidence_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'stationery-evidence'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
          AND lower(COALESCE(p.role, '')) IN ('principal', 'principal_admin', 'admin', 'owner', 'superadmin', 'super_admin')
          AND COALESCE(p.organization_id, p.preschool_id)::text = (storage.foldername(name))[1]
      )
    )
  )
  WITH CHECK (bucket_id = 'stationery-evidence');

CREATE POLICY stationery_evidence_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'stationery-evidence'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
          AND lower(COALESCE(p.role, '')) IN ('principal', 'principal_admin', 'admin', 'owner', 'superadmin', 'super_admin')
          AND COALESCE(p.organization_id, p.preschool_id)::text = (storage.foldername(name))[1]
      )
    )
  );

COMMIT;
