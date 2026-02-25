-- Migration: Add school_type to organizations & K-12 timetable columns
-- Enables school type differentiation so timetable and daily planner
-- can show different UIs for preschools vs K-12 schools.

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 1. Add school_type to organizations (if not already present)
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'school_type'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN school_type text DEFAULT 'preschool'
        CHECK (school_type IN ('preschool', 'primary', 'secondary', 'combined'));
  END IF;
END $$;

-- Backfill organizations.school_type from preschools where possible
UPDATE public.organizations o
SET school_type = CASE
    WHEN p.school_type IN ('primary', 'secondary', 'combined') THEN p.school_type
    WHEN p.school_type IN ('k12', 'community_school') THEN 'combined'
    ELSE 'preschool'
  END
FROM public.preschools p
WHERE o.id = p.id
  AND o.school_type IS NULL;

-- ════════════════════════════════════════════════════════════
-- 2. Add K-12 specific columns to timetable_slots
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timetable_slots'
      AND column_name = 'period_number'
  ) THEN
    ALTER TABLE public.timetable_slots
      ADD COLUMN period_number smallint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timetable_slots'
      AND column_name = 'is_break'
  ) THEN
    ALTER TABLE public.timetable_slots
      ADD COLUMN is_break boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timetable_slots'
      AND column_name = 'teacher_name'
  ) THEN
    ALTER TABLE public.timetable_slots
      ADD COLUMN teacher_name text;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 3. Indexes for K-12 timetable queries
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_timetable_slots_period
  ON timetable_slots(school_id, day_of_week, period_number)
  WHERE period_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_slots_break
  ON timetable_slots(school_id, is_break)
  WHERE is_break = true;

CREATE INDEX IF NOT EXISTS idx_organizations_school_type
  ON organizations(school_type);

COMMIT;
