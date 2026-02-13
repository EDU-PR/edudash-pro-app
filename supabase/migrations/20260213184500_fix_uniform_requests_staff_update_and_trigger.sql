BEGIN;

CREATE OR REPLACE FUNCTION public.set_uniform_request_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_profile_id uuid;
  v_preschool_id uuid;
  v_student_parent_id uuid;
BEGIN
  SELECT
    COALESCE(s.preschool_id, s.organization_id),
    COALESCE(s.parent_id, s.guardian_id)
  INTO v_preschool_id, v_student_parent_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF v_preschool_id IS NULL THEN
    RAISE EXCEPTION 'Student has no preschool or organization';
  END IF;

  -- Keep parent link stable on updates and prefer student-linked parent.
  IF TG_OP = 'UPDATE' THEN
    NEW.parent_id := COALESCE(NEW.parent_id, OLD.parent_id, v_student_parent_id);
  ELSE
    NEW.parent_id := COALESCE(NEW.parent_id, v_student_parent_id);
  END IF;

  IF NEW.parent_id IS NULL THEN
    SELECT id INTO v_profile_id
    FROM public.profiles
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;

    IF v_profile_id IS NULL THEN
      RAISE EXCEPTION 'No profile found for auth user';
    END IF;

    NEW.parent_id := v_profile_id;
  END IF;

  NEW.preschool_id := v_preschool_id;
  NEW.updated_at := now();
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS uniform_requests_staff_update ON public.uniform_requests;
CREATE POLICY uniform_requests_staff_update
ON public.uniform_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND lower(COALESCE(p.role, '')) IN (
        'principal',
        'principal_admin',
        'admin',
        'super_admin',
        'superadmin'
      )
      AND COALESCE(p.organization_id, p.preschool_id) = uniform_requests.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND lower(COALESCE(p.role, '')) IN (
        'principal',
        'principal_admin',
        'admin',
        'super_admin',
        'superadmin'
      )
      AND COALESCE(p.organization_id, p.preschool_id) = uniform_requests.preschool_id
  )
);

COMMIT;
