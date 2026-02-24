-- Allow age groups to be configured per school (preschool_id).
-- Principals/admins can create Curious Cubs, Little Explorers, Panda (and similar) per school.

DO $$
BEGIN
  IF to_regclass('public.age_groups') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'age_groups' AND column_name = 'preschool_id'
    ) THEN
      ALTER TABLE public.age_groups
        ADD COLUMN preschool_id UUID REFERENCES public.preschools(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_age_groups_preschool_id ON public.age_groups(preschool_id);
    END IF;
  END IF;
END $$;
