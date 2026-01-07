-- ============================================================================
-- Weekly Learning Reports Migration
-- ============================================================================
-- Created: 2026-01-07
-- Purpose: Store AI-generated weekly learning reports for parents
-- ============================================================================

-- Create weekly_learning_reports table
CREATE TABLE IF NOT EXISTS public.weekly_learning_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  
  -- Week range
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- AI-generated content
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- AI metadata
  ai_model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
  generation_duration_ms INTEGER,
  ai_prompt_version TEXT DEFAULT 'v1',
  
  -- Delivery tracking
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  sent_via JSONB DEFAULT '[]'::jsonb,
  parent_feedback TEXT,
  parent_rating INTEGER CHECK (parent_rating >= 1 AND parent_rating <= 5),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one report per student per week
  UNIQUE(student_id, week_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_weekly_reports_parent ON public.weekly_learning_reports(parent_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_student_week ON public.weekly_learning_reports(student_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_preschool ON public.weekly_learning_reports(preschool_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_generated ON public.weekly_learning_reports(generated_at DESC);

-- Add comments
COMMENT ON TABLE public.weekly_learning_reports IS 'AI-generated weekly progress reports for parents';

-- Enable Row Level Security
ALTER TABLE public.weekly_learning_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "weekly_reports_parent_select" ON public.weekly_learning_reports;
CREATE POLICY "weekly_reports_parent_select" ON public.weekly_learning_reports
  FOR SELECT USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "weekly_reports_school_select" ON public.weekly_learning_reports;
CREATE POLICY "weekly_reports_school_select" ON public.weekly_learning_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.preschool_id = weekly_learning_reports.preschool_id
      AND p.role IN ('teacher', 'principal', 'principal_admin')
    )
  );

DROP POLICY IF EXISTS "weekly_reports_system_insert" ON public.weekly_learning_reports;
CREATE POLICY "weekly_reports_system_insert" ON public.weekly_learning_reports
  FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_learning_reports TO authenticated;
