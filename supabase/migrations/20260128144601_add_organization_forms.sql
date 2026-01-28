BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  audience text[] NOT NULL DEFAULT '{}'::text[],
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

ALTER TABLE public.organization_forms
  ADD CONSTRAINT organization_forms_audience_check
  CHECK (audience <@ ARRAY['parents', 'teachers', 'staff']::text[]);

CREATE INDEX IF NOT EXISTS idx_organization_forms_org_id
  ON public.organization_forms(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_forms_status
  ON public.organization_forms(status);

CREATE OR REPLACE FUNCTION public.set_organization_form_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_forms_meta ON public.organization_forms;
CREATE TRIGGER trg_organization_forms_meta
BEFORE INSERT OR UPDATE ON public.organization_forms
FOR EACH ROW EXECUTE FUNCTION public.set_organization_form_meta();

ALTER TABLE public.organization_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_forms_select ON public.organization_forms;
CREATE POLICY organization_forms_select ON public.organization_forms
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = organization_forms.organization_id
      AND (
        p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
        OR (
          organization_forms.status = 'published'
          AND (
            (p.role = 'parent' AND 'parents' = ANY(organization_forms.audience))
            OR (p.role = 'teacher' AND 'teachers' = ANY(organization_forms.audience))
            OR (p.role = 'staff' AND 'staff' = ANY(organization_forms.audience))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS organization_forms_insert ON public.organization_forms;
CREATE POLICY organization_forms_insert ON public.organization_forms
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = organization_forms.organization_id
  )
);

DROP POLICY IF EXISTS organization_forms_update ON public.organization_forms;
CREATE POLICY organization_forms_update ON public.organization_forms
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = organization_forms.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = organization_forms.organization_id
  )
);

DROP POLICY IF EXISTS organization_forms_delete ON public.organization_forms;
CREATE POLICY organization_forms_delete ON public.organization_forms
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = organization_forms.organization_id
  )
);

COMMIT;
