BEGIN;

CREATE TABLE IF NOT EXISTS public.uniform_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  child_name text NOT NULL,
  age_years integer NOT NULL CHECK (age_years >= 1 AND age_years <= 18),
  tshirt_size text NOT NULL,
  notes text NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniform_requests_student_id_key
  ON public.uniform_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_uniform_requests_preschool_id
  ON public.uniform_requests(preschool_id);

CREATE INDEX IF NOT EXISTS idx_uniform_requests_parent_id
  ON public.uniform_requests(parent_id);

ALTER TABLE public.uniform_requests ENABLE ROW LEVEL SECURITY;

-- Auto-assign parent_id and preschool_id based on the authenticated user + student
CREATE OR REPLACE FUNCTION public.set_uniform_request_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_profile_id uuid;
  v_preschool_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for auth user';
  END IF;

  SELECT COALESCE(s.preschool_id, s.organization_id)
  INTO v_preschool_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF v_preschool_id IS NULL THEN
    RAISE EXCEPTION 'Student has no preschool or organization';
  END IF;

  NEW.parent_id := v_profile_id;
  NEW.preschool_id := v_preschool_id;
  NEW.updated_at := now();
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uniform_requests_set_fields ON public.uniform_requests;
CREATE TRIGGER trg_uniform_requests_set_fields
BEFORE INSERT OR UPDATE ON public.uniform_requests
FOR EACH ROW EXECUTE FUNCTION public.set_uniform_request_fields();

-- Parent access (their own children)
DROP POLICY IF EXISTS uniform_requests_parent_select ON public.uniform_requests;
CREATE POLICY uniform_requests_parent_select ON public.uniform_requests
FOR SELECT TO authenticated
USING (student_id IN (SELECT get_my_children_ids()));

DROP POLICY IF EXISTS uniform_requests_parent_insert ON public.uniform_requests;
CREATE POLICY uniform_requests_parent_insert ON public.uniform_requests
FOR INSERT TO authenticated
WITH CHECK (student_id IN (SELECT get_my_children_ids()));

DROP POLICY IF EXISTS uniform_requests_parent_update ON public.uniform_requests;
CREATE POLICY uniform_requests_parent_update ON public.uniform_requests
FOR UPDATE TO authenticated
USING (student_id IN (SELECT get_my_children_ids()))
WITH CHECK (student_id IN (SELECT get_my_children_ids()));

-- Principal/Admin access for their preschool
DROP POLICY IF EXISTS uniform_requests_staff_select ON public.uniform_requests;
CREATE POLICY uniform_requests_staff_select ON public.uniform_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('principal', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = uniform_requests.preschool_id
  )
);

COMMIT;
