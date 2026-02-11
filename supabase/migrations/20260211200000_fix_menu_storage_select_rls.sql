-- Fix: Allow parents and teachers to view original uploaded menu images
-- Previously the SELECT policy used is_school_menu_manager() which only allowed
-- principals/admins. Changing to is_school_menu_viewer() includes:
--   - super_admins (always)
--   - principals/admins of the school
--   - teachers assigned to the school
--   - parents/guardians with children enrolled at the school

DROP POLICY IF EXISTS school_menu_uploads_select ON storage.objects;

CREATE POLICY school_menu_uploads_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'school-menu-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_school_menu_viewer(((storage.foldername(name))[1])::UUID)
);
