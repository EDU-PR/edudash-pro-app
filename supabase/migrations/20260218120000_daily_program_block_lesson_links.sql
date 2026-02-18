-- Manual routine block -> lesson override links for Room Display.
-- Precedence order at runtime: manual link first, then auto-match.

CREATE TABLE IF NOT EXISTS public.daily_program_block_lesson_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL,
  class_id uuid,
  weekly_program_id uuid NOT NULL REFERENCES public.weekly_programs(id) ON DELETE CASCADE,
  daily_program_block_id uuid NOT NULL REFERENCES public.daily_program_blocks(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  linked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (preschool_id, daily_program_block_id)
);

COMMENT ON TABLE public.daily_program_block_lesson_links IS 'Manual per-block lesson links used by Room Display with override precedence.';
COMMENT ON COLUMN public.daily_program_block_lesson_links.preschool_id IS 'Organization/preschool owner for tenancy checks.';
COMMENT ON COLUMN public.daily_program_block_lesson_links.class_id IS 'Optional class context for the linked routine block.';

CREATE INDEX IF NOT EXISTS daily_program_block_lesson_links_preschool_idx
  ON public.daily_program_block_lesson_links (preschool_id);

CREATE INDEX IF NOT EXISTS daily_program_block_lesson_links_class_idx
  ON public.daily_program_block_lesson_links (class_id);

CREATE INDEX IF NOT EXISTS daily_program_block_lesson_links_weekly_program_idx
  ON public.daily_program_block_lesson_links (weekly_program_id);

CREATE INDEX IF NOT EXISTS daily_program_block_lesson_links_lesson_idx
  ON public.daily_program_block_lesson_links (lesson_id);

CREATE OR REPLACE FUNCTION public.update_daily_program_block_lesson_links_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_program_block_lesson_links_updated_at
  ON public.daily_program_block_lesson_links;

CREATE TRIGGER daily_program_block_lesson_links_updated_at
  BEFORE UPDATE ON public.daily_program_block_lesson_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_program_block_lesson_links_updated_at();

ALTER TABLE public.daily_program_block_lesson_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_program_block_lesson_links_read_own_org"
  ON public.daily_program_block_lesson_links;
CREATE POLICY "daily_program_block_lesson_links_read_own_org"
  ON public.daily_program_block_lesson_links
  FOR SELECT
  TO authenticated
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "daily_program_block_lesson_links_insert_own_org"
  ON public.daily_program_block_lesson_links;
CREATE POLICY "daily_program_block_lesson_links_insert_own_org"
  ON public.daily_program_block_lesson_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "daily_program_block_lesson_links_update_own_org"
  ON public.daily_program_block_lesson_links;
CREATE POLICY "daily_program_block_lesson_links_update_own_org"
  ON public.daily_program_block_lesson_links
  FOR UPDATE
  TO authenticated
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "daily_program_block_lesson_links_delete_own_org"
  ON public.daily_program_block_lesson_links;
CREATE POLICY "daily_program_block_lesson_links_delete_own_org"
  ON public.daily_program_block_lesson_links
  FOR DELETE
  TO authenticated
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_program_block_lesson_links TO authenticated;
