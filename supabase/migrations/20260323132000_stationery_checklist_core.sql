BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stationery_current_academic_year()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT EXTRACT(YEAR FROM timezone('Africa/Johannesburg', now()))::integer;
$$;

CREATE OR REPLACE FUNCTION public.stationery_is_school_staff(p_school_id uuid)
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
        'super_admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.stationery_is_school_member(p_school_id uuid)
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

CREATE OR REPLACE FUNCTION public.stationery_parent_has_school_access(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id IN (SELECT public.get_my_children_ids())
      AND COALESCE(s.preschool_id, s.organization_id) = p_school_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stationery_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  academic_year integer NOT NULL DEFAULT public.stationery_current_academic_year(),
  age_group_label text NOT NULL,
  age_min integer,
  age_max integer,
  is_visible boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stationery_lists_age_bounds_check CHECK (
    (age_min IS NULL OR age_min >= 0)
    AND (age_max IS NULL OR age_max >= 0)
    AND (
      age_min IS NULL
      OR age_max IS NULL
      OR age_max >= age_min
    )
  ),
  CONSTRAINT stationery_lists_year_check CHECK (academic_year BETWEEN 2000 AND 2200)
);

CREATE UNIQUE INDEX IF NOT EXISTS stationery_lists_school_year_label_key
  ON public.stationery_lists(school_id, academic_year, age_group_label);

CREATE INDEX IF NOT EXISTS idx_stationery_lists_school_year
  ON public.stationery_lists(school_id, academic_year, sort_order);

CREATE TABLE IF NOT EXISTS public.stationery_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.stationery_lists(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  required_quantity integer NOT NULL DEFAULT 1,
  unit_label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stationery_list_items_required_quantity_check CHECK (required_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stationery_list_items_list
  ON public.stationery_list_items(list_id, sort_order);

CREATE TABLE IF NOT EXISTS public.stationery_student_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT public.stationery_current_academic_year(),
  list_id uuid NOT NULL REFERENCES public.stationery_lists(id) ON DELETE CASCADE,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stationery_student_overrides_year_check CHECK (academic_year BETWEEN 2000 AND 2200)
);

CREATE UNIQUE INDEX IF NOT EXISTS stationery_student_overrides_student_year_key
  ON public.stationery_student_overrides(student_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_stationery_student_overrides_school
  ON public.stationery_student_overrides(school_id, academic_year);

CREATE TABLE IF NOT EXISTS public.stationery_parent_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stationery_list_items(id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT public.stationery_current_academic_year(),
  is_bought boolean NOT NULL DEFAULT false,
  quantity_bought integer NOT NULL DEFAULT 0,
  evidence_url text,
  checked_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stationery_parent_checks_year_check CHECK (academic_year BETWEEN 2000 AND 2200),
  CONSTRAINT stationery_parent_checks_quantity_check CHECK (quantity_bought >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS stationery_parent_checks_student_item_year_key
  ON public.stationery_parent_checks(student_id, item_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_stationery_parent_checks_school
  ON public.stationery_parent_checks(school_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_stationery_parent_checks_student
  ON public.stationery_parent_checks(student_id, academic_year);

CREATE TABLE IF NOT EXISTS public.stationery_parent_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT public.stationery_current_academic_year(),
  note_text text,
  expected_completion_date date,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stationery_parent_notes_year_check CHECK (academic_year BETWEEN 2000 AND 2200)
);

CREATE UNIQUE INDEX IF NOT EXISTS stationery_parent_notes_student_year_key
  ON public.stationery_parent_notes(student_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_stationery_parent_notes_school
  ON public.stationery_parent_notes(school_id, academic_year);

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.stationery_set_override_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_school_id uuid;
  v_list_school_id uuid;
BEGIN
  SELECT COALESCE(s.preschool_id, s.organization_id)
  INTO v_student_school_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF v_student_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve school for student %', NEW.student_id;
  END IF;

  SELECT l.school_id
  INTO v_list_school_id
  FROM public.stationery_lists l
  WHERE l.id = NEW.list_id;

  IF v_list_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve school for list %', NEW.list_id;
  END IF;

  IF v_student_school_id <> v_list_school_id THEN
    RAISE EXCEPTION 'Student/list school mismatch';
  END IF;

  NEW.school_id := v_student_school_id;
  IF NEW.academic_year IS NULL THEN
    NEW.academic_year := public.stationery_current_academic_year();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stationery_set_parent_check_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_school_id uuid;
  v_item_school_id uuid;
BEGIN
  SELECT COALESCE(s.preschool_id, s.organization_id)
  INTO v_student_school_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF v_student_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve school for student %', NEW.student_id;
  END IF;

  SELECT l.school_id
  INTO v_item_school_id
  FROM public.stationery_list_items i
  JOIN public.stationery_lists l ON l.id = i.list_id
  WHERE i.id = NEW.item_id;

  IF v_item_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve school for item %', NEW.item_id;
  END IF;

  IF v_student_school_id <> v_item_school_id THEN
    RAISE EXCEPTION 'Student/item school mismatch';
  END IF;

  NEW.school_id := v_student_school_id;
  IF NEW.academic_year IS NULL THEN
    NEW.academic_year := public.stationery_current_academic_year();
  END IF;
  NEW.quantity_bought := GREATEST(COALESCE(NEW.quantity_bought, 0), 0);
  NEW.checked_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stationery_set_parent_note_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_school_id uuid;
BEGIN
  SELECT COALESCE(s.preschool_id, s.organization_id)
  INTO v_student_school_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF v_student_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve school for student %', NEW.student_id;
  END IF;

  NEW.school_id := v_student_school_id;
  IF NEW.academic_year IS NULL THEN
    NEW.academic_year := public.stationery_current_academic_year();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stationery_lists_updated_at ON public.stationery_lists;
CREATE TRIGGER trg_stationery_lists_updated_at
BEFORE UPDATE ON public.stationery_lists
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_stationery_list_items_updated_at ON public.stationery_list_items;
CREATE TRIGGER trg_stationery_list_items_updated_at
BEFORE UPDATE ON public.stationery_list_items
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_stationery_student_overrides_updated_at ON public.stationery_student_overrides;
CREATE TRIGGER trg_stationery_student_overrides_updated_at
BEFORE UPDATE ON public.stationery_student_overrides
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_stationery_student_overrides_context ON public.stationery_student_overrides;
CREATE TRIGGER trg_stationery_student_overrides_context
BEFORE INSERT OR UPDATE ON public.stationery_student_overrides
FOR EACH ROW EXECUTE FUNCTION public.stationery_set_override_context();

DROP TRIGGER IF EXISTS trg_stationery_parent_checks_updated_at ON public.stationery_parent_checks;
CREATE TRIGGER trg_stationery_parent_checks_updated_at
BEFORE UPDATE ON public.stationery_parent_checks
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_stationery_parent_checks_context ON public.stationery_parent_checks;
CREATE TRIGGER trg_stationery_parent_checks_context
BEFORE INSERT OR UPDATE ON public.stationery_parent_checks
FOR EACH ROW EXECUTE FUNCTION public.stationery_set_parent_check_context();

DROP TRIGGER IF EXISTS trg_stationery_parent_notes_updated_at ON public.stationery_parent_notes;
CREATE TRIGGER trg_stationery_parent_notes_updated_at
BEFORE UPDATE ON public.stationery_parent_notes
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_stationery_parent_notes_context ON public.stationery_parent_notes;
CREATE TRIGGER trg_stationery_parent_notes_context
BEFORE INSERT OR UPDATE ON public.stationery_parent_notes
FOR EACH ROW EXECUTE FUNCTION public.stationery_set_parent_note_context();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.stationery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationery_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationery_student_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationery_parent_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationery_parent_notes ENABLE ROW LEVEL SECURITY;

-- stationery_lists
DROP POLICY IF EXISTS stationery_lists_parent_select ON public.stationery_lists;
CREATE POLICY stationery_lists_parent_select
ON public.stationery_lists
FOR SELECT TO authenticated
USING (
  is_visible = true
  AND is_published = true
  AND public.stationery_parent_has_school_access(school_id)
);

DROP POLICY IF EXISTS stationery_lists_staff_select ON public.stationery_lists;
CREATE POLICY stationery_lists_staff_select
ON public.stationery_lists
FOR SELECT TO authenticated
USING (public.stationery_is_school_member(school_id));

DROP POLICY IF EXISTS stationery_lists_staff_insert ON public.stationery_lists;
CREATE POLICY stationery_lists_staff_insert
ON public.stationery_lists
FOR INSERT TO authenticated
WITH CHECK (public.stationery_is_school_staff(school_id));

DROP POLICY IF EXISTS stationery_lists_staff_update ON public.stationery_lists;
CREATE POLICY stationery_lists_staff_update
ON public.stationery_lists
FOR UPDATE TO authenticated
USING (public.stationery_is_school_staff(school_id))
WITH CHECK (public.stationery_is_school_staff(school_id));

DROP POLICY IF EXISTS stationery_lists_staff_delete ON public.stationery_lists;
CREATE POLICY stationery_lists_staff_delete
ON public.stationery_lists
FOR DELETE TO authenticated
USING (public.stationery_is_school_staff(school_id));

-- stationery_list_items
DROP POLICY IF EXISTS stationery_list_items_parent_select ON public.stationery_list_items;
CREATE POLICY stationery_list_items_parent_select
ON public.stationery_list_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.id = stationery_list_items.list_id
      AND l.is_visible = true
      AND l.is_published = true
      AND stationery_list_items.is_visible = true
      AND public.stationery_parent_has_school_access(l.school_id)
  )
);

DROP POLICY IF EXISTS stationery_list_items_staff_select ON public.stationery_list_items;
CREATE POLICY stationery_list_items_staff_select
ON public.stationery_list_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.id = stationery_list_items.list_id
      AND public.stationery_is_school_member(l.school_id)
  )
);

DROP POLICY IF EXISTS stationery_list_items_staff_insert ON public.stationery_list_items;
CREATE POLICY stationery_list_items_staff_insert
ON public.stationery_list_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.id = stationery_list_items.list_id
      AND public.stationery_is_school_staff(l.school_id)
  )
);

DROP POLICY IF EXISTS stationery_list_items_staff_update ON public.stationery_list_items;
CREATE POLICY stationery_list_items_staff_update
ON public.stationery_list_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.id = stationery_list_items.list_id
      AND public.stationery_is_school_staff(l.school_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.id = stationery_list_items.list_id
      AND public.stationery_is_school_staff(l.school_id)
  )
);

DROP POLICY IF EXISTS stationery_list_items_staff_delete ON public.stationery_list_items;
CREATE POLICY stationery_list_items_staff_delete
ON public.stationery_list_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.stationery_lists l
    WHERE l.id = stationery_list_items.list_id
      AND public.stationery_is_school_staff(l.school_id)
  )
);

-- stationery_student_overrides
DROP POLICY IF EXISTS stationery_overrides_staff_select ON public.stationery_student_overrides;
CREATE POLICY stationery_overrides_staff_select
ON public.stationery_student_overrides
FOR SELECT TO authenticated
USING (public.stationery_is_school_member(school_id));

DROP POLICY IF EXISTS stationery_overrides_staff_insert ON public.stationery_student_overrides;
CREATE POLICY stationery_overrides_staff_insert
ON public.stationery_student_overrides
FOR INSERT TO authenticated
WITH CHECK (public.stationery_is_school_staff(school_id));

DROP POLICY IF EXISTS stationery_overrides_staff_update ON public.stationery_student_overrides;
CREATE POLICY stationery_overrides_staff_update
ON public.stationery_student_overrides
FOR UPDATE TO authenticated
USING (public.stationery_is_school_staff(school_id))
WITH CHECK (public.stationery_is_school_staff(school_id));

DROP POLICY IF EXISTS stationery_overrides_staff_delete ON public.stationery_student_overrides;
CREATE POLICY stationery_overrides_staff_delete
ON public.stationery_student_overrides
FOR DELETE TO authenticated
USING (public.stationery_is_school_staff(school_id));

-- stationery_parent_checks
DROP POLICY IF EXISTS stationery_checks_parent_select ON public.stationery_parent_checks;
CREATE POLICY stationery_checks_parent_select
ON public.stationery_parent_checks
FOR SELECT TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS stationery_checks_parent_insert ON public.stationery_parent_checks;
CREATE POLICY stationery_checks_parent_insert
ON public.stationery_parent_checks
FOR INSERT TO authenticated
WITH CHECK (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS stationery_checks_parent_update ON public.stationery_parent_checks;
CREATE POLICY stationery_checks_parent_update
ON public.stationery_parent_checks
FOR UPDATE TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()))
WITH CHECK (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS stationery_checks_staff_select ON public.stationery_parent_checks;
CREATE POLICY stationery_checks_staff_select
ON public.stationery_parent_checks
FOR SELECT TO authenticated
USING (public.stationery_is_school_member(school_id));

DROP POLICY IF EXISTS stationery_checks_staff_update ON public.stationery_parent_checks;
CREATE POLICY stationery_checks_staff_update
ON public.stationery_parent_checks
FOR UPDATE TO authenticated
USING (public.stationery_is_school_staff(school_id))
WITH CHECK (public.stationery_is_school_staff(school_id));

-- stationery_parent_notes
DROP POLICY IF EXISTS stationery_notes_parent_select ON public.stationery_parent_notes;
CREATE POLICY stationery_notes_parent_select
ON public.stationery_parent_notes
FOR SELECT TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS stationery_notes_parent_insert ON public.stationery_parent_notes;
CREATE POLICY stationery_notes_parent_insert
ON public.stationery_parent_notes
FOR INSERT TO authenticated
WITH CHECK (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS stationery_notes_parent_update ON public.stationery_parent_notes;
CREATE POLICY stationery_notes_parent_update
ON public.stationery_parent_notes
FOR UPDATE TO authenticated
USING (student_id IN (SELECT public.get_my_children_ids()))
WITH CHECK (student_id IN (SELECT public.get_my_children_ids()));

DROP POLICY IF EXISTS stationery_notes_staff_select ON public.stationery_parent_notes;
CREATE POLICY stationery_notes_staff_select
ON public.stationery_parent_notes
FOR SELECT TO authenticated
USING (public.stationery_is_school_member(school_id));

DROP POLICY IF EXISTS stationery_notes_staff_update ON public.stationery_parent_notes;
CREATE POLICY stationery_notes_staff_update
ON public.stationery_parent_notes
FOR UPDATE TO authenticated
USING (public.stationery_is_school_staff(school_id))
WITH CHECK (public.stationery_is_school_staff(school_id));

COMMIT;
