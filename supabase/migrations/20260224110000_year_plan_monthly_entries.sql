-- Year Planner V2 monthly matrix storage

CREATE TABLE IF NOT EXISTS public.year_plan_monthly_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academic_year INTEGER NOT NULL,
  month_index INTEGER NOT NULL CHECK (month_index BETWEEN 1 AND 12),
  bucket TEXT NOT NULL CHECK (
    bucket IN (
      'holidays_closures',
      'meetings_admin',
      'excursions_extras',
      'donations_fundraisers'
    )
  ),
  subtype TEXT,
  title TEXT NOT NULL,
  details TEXT,
  start_date DATE,
  end_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual', 'synced')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_to_calendar BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_year_plan_monthly_entries_scope
  ON public.year_plan_monthly_entries (preschool_id, academic_year, month_index);

CREATE INDEX IF NOT EXISTS idx_year_plan_monthly_entries_bucket
  ON public.year_plan_monthly_entries (preschool_id, academic_year, bucket);

CREATE INDEX IF NOT EXISTS idx_year_plan_monthly_entries_published
  ON public.year_plan_monthly_entries (preschool_id, academic_year, is_published, published_to_calendar);

ALTER TABLE public.year_plan_monthly_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS year_plan_monthly_entries_staff_view ON public.year_plan_monthly_entries;
CREATE POLICY year_plan_monthly_entries_staff_view
  ON public.year_plan_monthly_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = year_plan_monthly_entries.preschool_id
    )
  );

DROP POLICY IF EXISTS year_plan_monthly_entries_principal_manage ON public.year_plan_monthly_entries;
CREATE POLICY year_plan_monthly_entries_principal_manage
  ON public.year_plan_monthly_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = year_plan_monthly_entries.preschool_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = year_plan_monthly_entries.preschool_id
    )
  );

DROP TRIGGER IF EXISTS update_year_plan_monthly_entries_updated_at ON public.year_plan_monthly_entries;
CREATE TRIGGER update_year_plan_monthly_entries_updated_at
  BEFORE UPDATE ON public.year_plan_monthly_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.year_plan_monthly_entries TO authenticated;
