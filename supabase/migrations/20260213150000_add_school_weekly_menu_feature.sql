-- ============================================================================
-- School Weekly Menu Feature (Hybrid bridge + dedicated module)
-- Date: 2026-02-13
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Core table: school_daily_menus
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.school_daily_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  menu_date DATE NOT NULL,
  week_start_date DATE NOT NULL,
  breakfast_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  lunch_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  snack_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  source_upload_path TEXT,
  source_announcement_id UUID REFERENCES public.announcements(id) ON DELETE SET NULL,
  published_by UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (preschool_id, menu_date)
);

CREATE INDEX IF NOT EXISTS idx_school_daily_menus_school_week
  ON public.school_daily_menus (preschool_id, week_start_date, menu_date);

CREATE INDEX IF NOT EXISTS idx_school_daily_menus_school_date
  ON public.school_daily_menus (preschool_id, menu_date);

CREATE INDEX IF NOT EXISTS idx_school_daily_menus_announcement
  ON public.school_daily_menus (source_announcement_id)
  WHERE source_announcement_id IS NOT NULL;

-- updated_at trigger helper (if missing)
DO $$
BEGIN
  IF to_regprocedure('public.trg_set_updated_at()') IS NULL THEN
    CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_school_daily_menus_updated_at ON public.school_daily_menus;
CREATE TRIGGER trg_school_daily_menus_updated_at
BEFORE UPDATE ON public.school_daily_menus
FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Access helpers + RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_school_menu_manager(p_preschool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND (
        lower(COALESCE(p.role, '')) IN ('super_admin', 'superadmin')
        OR (
          COALESCE(p.organization_id, p.preschool_id) = p_preschool_id
          AND lower(COALESCE(p.role, '')) IN ('principal', 'principal_admin', 'admin', 'super_admin', 'superadmin')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_menu_viewer(p_preschool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Managers always view
    public.is_school_menu_manager(p_preschool_id)
    OR
    -- Staff in school
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
        AND COALESCE(p.organization_id, p.preschool_id) = p_preschool_id
        AND lower(COALESCE(p.role, '')) IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin')
    )
    OR
    -- Parents/guardians with children in school
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.preschool_id = p_preschool_id
        AND (
          s.parent_id = auth.uid()
          OR s.guardian_id = auth.uid()
          OR s.parent_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
          OR s.guardian_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
        )
    );
$$;

ALTER TABLE public.school_daily_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_daily_menus_select ON public.school_daily_menus;
CREATE POLICY school_daily_menus_select
ON public.school_daily_menus
FOR SELECT
TO authenticated
USING (public.is_school_menu_viewer(preschool_id));

DROP POLICY IF EXISTS school_daily_menus_insert ON public.school_daily_menus;
CREATE POLICY school_daily_menus_insert
ON public.school_daily_menus
FOR INSERT
TO authenticated
WITH CHECK (public.is_school_menu_manager(preschool_id));

DROP POLICY IF EXISTS school_daily_menus_update ON public.school_daily_menus;
CREATE POLICY school_daily_menus_update
ON public.school_daily_menus
FOR UPDATE
TO authenticated
USING (public.is_school_menu_manager(preschool_id))
WITH CHECK (public.is_school_menu_manager(preschool_id));

DROP POLICY IF EXISTS school_daily_menus_delete ON public.school_daily_menus;
CREATE POLICY school_daily_menus_delete
ON public.school_daily_menus
FOR DELETE
TO authenticated
USING (public.is_school_menu_manager(preschool_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_daily_menus TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPCs: upsert/get week menu
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jsonb_text_array(p_value JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result TEXT[];
BEGIN
  IF jsonb_typeof(COALESCE(p_value, '[]'::jsonb)) <> 'array' THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  SELECT COALESCE(array_agg(trim(v_item) ORDER BY ord), ARRAY[]::TEXT[])
  INTO v_result
  FROM (
    SELECT value AS v_item, ordinality AS ord
    FROM jsonb_array_elements_text(COALESCE(p_value, '[]'::jsonb)) WITH ORDINALITY
  ) items
  WHERE trim(v_item) <> '';

  RETURN COALESCE(v_result, ARRAY[]::TEXT[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_school_week_menu(
  p_preschool_id UUID,
  p_week_start_date DATE,
  p_days JSONB,
  p_source_upload_path TEXT DEFAULT NULL,
  p_source_announcement_id UUID DEFAULT NULL
)
RETURNS SETOF public.school_daily_menus
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day JSONB;
  v_menu_date DATE;
  v_breakfast TEXT[];
  v_lunch TEXT[];
  v_snack TEXT[];
  v_notes TEXT;
BEGIN
  IF p_preschool_id IS NULL THEN
    RAISE EXCEPTION 'p_preschool_id is required';
  END IF;

  IF p_week_start_date IS NULL THEN
    RAISE EXCEPTION 'p_week_start_date is required';
  END IF;

  IF jsonb_typeof(COALESCE(p_days, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_days must be a JSON array';
  END IF;

  IF NOT public.is_school_menu_manager(p_preschool_id) THEN
    RAISE EXCEPTION 'Not authorized to manage school menu';
  END IF;

  FOR v_day IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_days, '[]'::jsonb))
  LOOP
    v_menu_date := NULL;
    v_breakfast := ARRAY[]::TEXT[];
    v_lunch := ARRAY[]::TEXT[];
    v_snack := ARRAY[]::TEXT[];
    v_notes := NULL;

    BEGIN
      v_menu_date := (v_day->>'date')::DATE;
    EXCEPTION WHEN others THEN
      v_menu_date := NULL;
    END;

    -- Ignore malformed day rows
    IF v_menu_date IS NULL THEN
      CONTINUE;
    END IF;

    -- Keep week-scope strict (Mon-Sun range from start date)
    IF v_menu_date < p_week_start_date OR v_menu_date > (p_week_start_date + 6) THEN
      CONTINUE;
    END IF;

    v_breakfast := public.jsonb_text_array(COALESCE(v_day->'breakfast', v_day->'breakfast_items', '[]'::jsonb));
    v_lunch := public.jsonb_text_array(COALESCE(v_day->'lunch', v_day->'lunch_items', '[]'::jsonb));
    v_snack := public.jsonb_text_array(COALESCE(v_day->'snack', v_day->'snack_items', '[]'::jsonb));
    v_notes := NULLIF(trim(COALESCE(v_day->>'notes', '')), '');

    INSERT INTO public.school_daily_menus (
      preschool_id,
      menu_date,
      week_start_date,
      breakfast_items,
      lunch_items,
      snack_items,
      notes,
      source_upload_path,
      source_announcement_id,
      published_by,
      published_at
    )
    VALUES (
      p_preschool_id,
      v_menu_date,
      p_week_start_date,
      v_breakfast,
      v_lunch,
      v_snack,
      v_notes,
      p_source_upload_path,
      p_source_announcement_id,
      auth.uid(),
      now()
    )
    ON CONFLICT (preschool_id, menu_date)
    DO UPDATE
      SET week_start_date = EXCLUDED.week_start_date,
          breakfast_items = EXCLUDED.breakfast_items,
          lunch_items = EXCLUDED.lunch_items,
          snack_items = EXCLUDED.snack_items,
          notes = EXCLUDED.notes,
          source_upload_path = COALESCE(EXCLUDED.source_upload_path, public.school_daily_menus.source_upload_path),
          source_announcement_id = COALESCE(EXCLUDED.source_announcement_id, public.school_daily_menus.source_announcement_id),
          published_by = EXCLUDED.published_by,
          published_at = now(),
          updated_at = now();
  END LOOP;

  RETURN QUERY
  SELECT *
  FROM public.school_daily_menus m
  WHERE m.preschool_id = p_preschool_id
    AND m.week_start_date = p_week_start_date
  ORDER BY m.menu_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_school_week_menu(UUID, DATE, JSONB, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_school_week_menu(
  p_preschool_id UUID,
  p_week_start_date DATE
)
RETURNS SETOF public.school_daily_menus
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.school_daily_menus m
  WHERE m.preschool_id = p_preschool_id
    AND m.week_start_date = p_week_start_date
    AND public.is_school_menu_viewer(p_preschool_id)
  ORDER BY m.menu_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_week_menu(UUID, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Backfill helper from announcements attachments (bridge -> dedicated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.backfill_school_daily_menus_from_announcements(
  p_preschool_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_structured JSONB;
  v_source JSONB;
  v_day JSONB;
  v_days JSONB;
  v_week_start DATE;
  v_menu_date DATE;
  v_notes TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT a.id, a.preschool_id, a.author_id, a.published_at, a.created_at, a.attachments
    FROM public.announcements a
    WHERE a.attachments IS NOT NULL
      AND jsonb_typeof(a.attachments) = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(a.attachments) AS att
        WHERE att->>'kind' = 'menu_week_structured'
      )
      AND (p_preschool_id IS NULL OR a.preschool_id = p_preschool_id)
    ORDER BY COALESCE(a.published_at, a.created_at) DESC
    LIMIT GREATEST(COALESCE(p_limit, 500), 1)
  LOOP
    v_structured := NULL;
    v_source := NULL;

    SELECT att INTO v_structured
    FROM jsonb_array_elements(v_rec.attachments) AS att
    WHERE att->>'kind' = 'menu_week_structured'
    LIMIT 1;

    SELECT att INTO v_source
    FROM jsonb_array_elements(v_rec.attachments) AS att
    WHERE att->>'kind' = 'menu_source'
    LIMIT 1;

    IF v_structured IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      v_week_start := (v_structured->>'week_start_date')::DATE;
    EXCEPTION WHEN others THEN
      v_week_start := NULL;
    END;

    IF v_week_start IS NULL THEN
      v_week_start := date_trunc('week', COALESCE(v_rec.published_at, v_rec.created_at, now()))::DATE;
    END IF;

    v_days := COALESCE(v_structured->'days', '[]'::jsonb);
    IF jsonb_typeof(v_days) <> 'array' THEN
      CONTINUE;
    END IF;

    FOR v_day IN
      SELECT value
      FROM jsonb_array_elements(v_days)
    LOOP
      BEGIN
        v_menu_date := (v_day->>'date')::DATE;
      EXCEPTION WHEN others THEN
        v_menu_date := NULL;
      END;

      IF v_menu_date IS NULL THEN
        CONTINUE;
      END IF;

      v_notes := NULLIF(trim(COALESCE(v_day->>'notes', '')), '');

      INSERT INTO public.school_daily_menus (
        preschool_id,
        menu_date,
        week_start_date,
        breakfast_items,
        lunch_items,
        snack_items,
        notes,
        source_upload_path,
        source_announcement_id,
        published_by,
        published_at
      )
      VALUES (
        v_rec.preschool_id,
        v_menu_date,
        v_week_start,
        public.jsonb_text_array(COALESCE(v_day->'breakfast', v_day->'breakfast_items', '[]'::jsonb)),
        public.jsonb_text_array(COALESCE(v_day->'lunch', v_day->'lunch_items', '[]'::jsonb)),
        public.jsonb_text_array(COALESCE(v_day->'snack', v_day->'snack_items', '[]'::jsonb)),
        v_notes,
        NULLIF(trim(COALESCE(v_source->>'path', '')), ''),
        v_rec.id,
        v_rec.author_id,
        COALESCE(v_rec.published_at, now())
      )
      ON CONFLICT (preschool_id, menu_date)
      DO UPDATE
        SET week_start_date = EXCLUDED.week_start_date,
            breakfast_items = EXCLUDED.breakfast_items,
            lunch_items = EXCLUDED.lunch_items,
            snack_items = EXCLUDED.snack_items,
            notes = EXCLUDED.notes,
            source_upload_path = COALESCE(EXCLUDED.source_upload_path, public.school_daily_menus.source_upload_path),
            source_announcement_id = COALESCE(EXCLUDED.source_announcement_id, public.school_daily_menus.source_announcement_id),
            published_by = COALESCE(EXCLUDED.published_by, public.school_daily_menus.published_by),
            published_at = COALESCE(EXCLUDED.published_at, public.school_daily_menus.published_at),
            updated_at = now();
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Storage bucket for original uploaded menu files
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-menu-uploads',
  'school-menu-uploads',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

-- RLS is already enabled on storage.objects by Supabase — do NOT alter it here.

DROP POLICY IF EXISTS school_menu_uploads_insert ON storage.objects;
CREATE POLICY school_menu_uploads_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'school-menu-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_school_menu_manager(((storage.foldername(name))[1])::UUID)
);

DROP POLICY IF EXISTS school_menu_uploads_select ON storage.objects;
CREATE POLICY school_menu_uploads_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'school-menu-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_school_menu_manager(((storage.foldername(name))[1])::UUID)
);

DROP POLICY IF EXISTS school_menu_uploads_update ON storage.objects;
CREATE POLICY school_menu_uploads_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'school-menu-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_school_menu_manager(((storage.foldername(name))[1])::UUID)
)
WITH CHECK (
  bucket_id = 'school-menu-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_school_menu_manager(((storage.foldername(name))[1])::UUID)
);

DROP POLICY IF EXISTS school_menu_uploads_delete ON storage.objects;
CREATE POLICY school_menu_uploads_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'school-menu-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_school_menu_manager(((storage.foldername(name))[1])::UUID)
);

-- Initial backfill (non-fatal, idempotent)
SELECT public.backfill_school_daily_menus_from_announcements(NULL, 500);
