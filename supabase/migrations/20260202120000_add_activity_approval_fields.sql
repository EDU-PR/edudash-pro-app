-- Add approval workflow fields to interactive_activities
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interactive_activities'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'interactive_activities' AND column_name = 'approval_status'
    ) THEN
      ALTER TABLE public.interactive_activities
        ADD COLUMN approval_status TEXT DEFAULT 'approved'
        CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'interactive_activities' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE public.interactive_activities
        ADD COLUMN approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'interactive_activities' AND column_name = 'approved_at'
    ) THEN
      ALTER TABLE public.interactive_activities
        ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;

    UPDATE public.interactive_activities
    SET approval_status = 'approved'
    WHERE approval_status IS NULL;

    CREATE INDEX IF NOT EXISTS idx_interactive_activities_approval_status
      ON public.interactive_activities(approval_status);
  END IF;
END $$;
