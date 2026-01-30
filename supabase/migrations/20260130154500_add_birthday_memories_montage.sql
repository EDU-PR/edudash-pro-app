-- Birthday memories montage pipeline

CREATE TABLE IF NOT EXISTS public.birthday_memory_montage_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.birthday_memory_events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  output_path TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_birthday_memory_montage_event ON public.birthday_memory_montage_jobs(event_id);

ALTER TABLE public.birthday_memory_montage_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS birthday_memory_montage_select ON public.birthday_memory_montage_jobs;
CREATE POLICY birthday_memory_montage_select
ON public.birthday_memory_montage_jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_montage_jobs.organization_id
  )
);

DROP POLICY IF EXISTS birthday_memory_montage_insert ON public.birthday_memory_montage_jobs;
CREATE POLICY birthday_memory_montage_insert
ON public.birthday_memory_montage_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_montage_jobs.organization_id
      AND p.role IN ('teacher', 'principal', 'admin', 'super_admin', 'principal_admin')
  )
);

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
      AND p.role IN ('principal', 'admin', 'super_admin', 'principal_admin')
  )
);
