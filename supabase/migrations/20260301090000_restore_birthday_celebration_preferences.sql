BEGIN;

-- Recreate birthday preferences table dropped in prior schema revisions.
CREATE TABLE IF NOT EXISTS public.birthday_celebration_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  wants_school_celebration boolean NOT NULL DEFAULT true,
  preferred_theme text,
  allergies text[] NOT NULL DEFAULT '{}'::text[],
  dietary_restrictions text[] NOT NULL DEFAULT '{}'::text[],
  parent_bringing_treats boolean NOT NULL DEFAULT false,
  treats_description text,
  guest_count integer,
  notify_classmates boolean NOT NULL DEFAULT true,
  special_requests text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birthday_celebration_preferences_student_id_key UNIQUE (student_id),
  CONSTRAINT birthday_celebration_preferences_guest_count_check CHECK (
    guest_count IS NULL OR guest_count >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_birthday_prefs_student_id
  ON public.birthday_celebration_preferences(student_id);

DO $$
BEGIN
  IF to_regprocedure('public.trg_set_updated_at()') IS NULL THEN
    CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_birthday_prefs_updated_at ON public.birthday_celebration_preferences;
CREATE TRIGGER trg_birthday_prefs_updated_at
BEFORE UPDATE ON public.birthday_celebration_preferences
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

CREATE OR REPLACE FUNCTION public.birthday_is_school_member(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND COALESCE(p.organization_id, p.preschool_id) = p_school_id
      AND lower(COALESCE(p.role, '')) IN (
        'principal',
        'principal_admin',
        'admin',
        'owner',
        'superadmin',
        'super_admin',
        'teacher'
      )
  );
$$;

ALTER TABLE public.birthday_celebration_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS birthday_prefs_parent_select ON public.birthday_celebration_preferences;
CREATE POLICY birthday_prefs_parent_select
ON public.birthday_celebration_preferences
FOR SELECT TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS birthday_prefs_parent_insert ON public.birthday_celebration_preferences;
CREATE POLICY birthday_prefs_parent_insert
ON public.birthday_celebration_preferences
FOR INSERT TO authenticated
WITH CHECK (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS birthday_prefs_parent_update ON public.birthday_celebration_preferences;
CREATE POLICY birthday_prefs_parent_update
ON public.birthday_celebration_preferences
FOR UPDATE TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()))
WITH CHECK (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS birthday_prefs_parent_delete ON public.birthday_celebration_preferences;
CREATE POLICY birthday_prefs_parent_delete
ON public.birthday_celebration_preferences
FOR DELETE TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS birthday_prefs_staff_select ON public.birthday_celebration_preferences;
CREATE POLICY birthday_prefs_staff_select
ON public.birthday_celebration_preferences
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = birthday_celebration_preferences.student_id
      AND public.birthday_is_school_member(COALESCE(s.organization_id, s.preschool_id))
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.birthday_celebration_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.birthday_celebration_preferences TO service_role;

COMMENT ON TABLE public.birthday_celebration_preferences IS 'Parent-configurable birthday celebration preferences per student.';

COMMIT;
