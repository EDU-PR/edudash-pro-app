-- Add approval/sent tracking for birthday montage delivery

ALTER TABLE public.birthday_memory_montage_jobs
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Allow teachers to approve/send (update) montage jobs
DROP POLICY IF EXISTS birthday_memory_montage_update ON public.birthday_memory_montage_jobs;
CREATE POLICY birthday_memory_montage_update
ON public.birthday_memory_montage_jobs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_montage_jobs.organization_id
      AND p.role IN ('teacher', 'principal', 'admin', 'super_admin', 'principal_admin')
  )
);
