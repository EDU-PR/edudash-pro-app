-- Lesson templates: atomic default switching + unique DB guard
--
-- Ensures exactly one default template per preschool.
-- Replaces chatty client-side loops with a single SECURITY DEFINER RPC.

BEGIN;

-- If multiple defaults exist, keep the most recently updated one and clear the rest.
WITH ranked AS (
  SELECT
    id,
    preschool_id,
    row_number() OVER (
      PARTITION BY preschool_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM public.lesson_templates
  WHERE is_default = true
)
UPDATE public.lesson_templates lt
SET is_default = false
FROM ranked r
WHERE lt.id = r.id
  AND r.rn > 1;

-- One default per preschool.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lesson_templates_default_per_preschool
  ON public.lesson_templates (preschool_id)
  WHERE is_default = true;

CREATE OR REPLACE FUNCTION public.set_default_lesson_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_caller uuid;
  v_preschool_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT lt.preschool_id
    INTO v_preschool_id
  FROM public.lesson_templates lt
  WHERE lt.id = p_template_id
    AND lt.is_active = true;

  IF v_preschool_id IS NULL THEN
    RAISE EXCEPTION 'Lesson template not found' USING ERRCODE = '22023';
  END IF;

  -- Only principals/admins within the preschool can set the default template.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_caller
      AND p.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND COALESCE(p.organization_id, p.preschool_id) = v_preschool_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to set default template' USING ERRCODE = '42501';
  END IF;

  -- Clear existing default(s) for this preschool.
  UPDATE public.lesson_templates
  SET is_default = false
  WHERE preschool_id = v_preschool_id
    AND is_default = true;

  -- Set the chosen template as default.
  UPDATE public.lesson_templates
  SET is_default = true
  WHERE id = p_template_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_lesson_template(uuid) TO authenticated;

COMMIT;

