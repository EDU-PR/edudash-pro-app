-- Backfill attendance organization_id using the linked student record.
-- This keeps attendance analytics scoped to the correct organization.
UPDATE public.attendance AS a
SET organization_id = COALESCE(s.organization_id, s.preschool_id)
FROM public.students AS s
WHERE a.student_id = s.id
  AND a.organization_id IS NULL
  AND COALESCE(s.organization_id, s.preschool_id) IS NOT NULL;
