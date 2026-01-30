-- Birthday Memories: events + media storage
-- Allows staff to upload memories; everyone in the school can view; only parents can download originals via Edge Function.

CREATE TABLE IF NOT EXISTS public.birthday_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  preschool_id UUID,
  birthday_student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, birthday_student_id, event_date)
);

CREATE TABLE IF NOT EXISTS public.birthday_memory_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.birthday_memory_events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  preschool_id UUID,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  storage_path TEXT NOT NULL,
  preview_path TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_birthday_memory_events_org_date
  ON public.birthday_memory_events(organization_id, event_date);

CREATE INDEX IF NOT EXISTS idx_birthday_memory_events_student
  ON public.birthday_memory_events(birthday_student_id);

CREATE INDEX IF NOT EXISTS idx_birthday_memory_media_event
  ON public.birthday_memory_media(event_id);

ALTER TABLE public.birthday_memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_memory_media ENABLE ROW LEVEL SECURITY;

-- View: anyone in org can view
DROP POLICY IF EXISTS birthday_memory_events_select ON public.birthday_memory_events;
CREATE POLICY birthday_memory_events_select
ON public.birthday_memory_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_events.organization_id
  )
);

DROP POLICY IF EXISTS birthday_memory_media_select ON public.birthday_memory_media;
CREATE POLICY birthday_memory_media_select
ON public.birthday_memory_media
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_media.organization_id
  )
);

-- Insert: staff only
DROP POLICY IF EXISTS birthday_memory_events_insert ON public.birthday_memory_events;
CREATE POLICY birthday_memory_events_insert
ON public.birthday_memory_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_events.organization_id
      AND p.role IN ('teacher', 'principal', 'admin', 'super_admin', 'principal_admin')
  )
);

DROP POLICY IF EXISTS birthday_memory_media_insert ON public.birthday_memory_media;
CREATE POLICY birthday_memory_media_insert
ON public.birthday_memory_media
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_media.organization_id
      AND p.role IN ('teacher', 'principal', 'admin', 'super_admin', 'principal_admin')
  )
);

-- Update/Delete: staff who created or admins
DROP POLICY IF EXISTS birthday_memory_media_update ON public.birthday_memory_media;
CREATE POLICY birthday_memory_media_update
ON public.birthday_memory_media
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_media.organization_id
      AND (p.id = birthday_memory_media.created_by OR p.role IN ('principal', 'admin', 'super_admin', 'principal_admin'))
  )
);

DROP POLICY IF EXISTS birthday_memory_media_delete ON public.birthday_memory_media;
CREATE POLICY birthday_memory_media_delete
ON public.birthday_memory_media
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = birthday_memory_media.organization_id
      AND (p.id = birthday_memory_media.created_by OR p.role IN ('principal', 'admin', 'super_admin', 'principal_admin'))
  )
);

-- Storage bucket for birthday memories (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('birthday-memories', 'birthday-memories', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for staff uploads
DROP POLICY IF EXISTS birthday_memories_upload ON storage.objects;
CREATE POLICY birthday_memories_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'birthday-memories'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'admin', 'super_admin', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id)::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS birthday_memories_delete ON storage.objects;
CREATE POLICY birthday_memories_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'birthday-memories'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('teacher', 'principal', 'admin', 'super_admin', 'principal_admin')
      AND COALESCE(p.organization_id, p.preschool_id)::text = (storage.foldername(name))[1]
  )
);
