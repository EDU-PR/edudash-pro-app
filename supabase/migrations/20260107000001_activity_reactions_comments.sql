-- ============================================================================
-- Activity Reactions and Comments Migration
-- ============================================================================
-- Created: 2026-01-07
-- Purpose: Add tables for parent reactions and comments on student activities
-- ============================================================================

-- Create activity_reactions table
CREATE TABLE IF NOT EXISTS public.activity_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.student_activity_feed(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('❤️', '👍', '😊', '🎉', '👏', '🌟', '💯', '😍')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(activity_id, parent_id)
);

-- Create activity_comments table
CREATE TABLE IF NOT EXISTS public.activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.student_activity_feed(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL CHECK (char_length(comment_text) > 0 AND char_length(comment_text) <= 500),
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_reactions_activity ON public.activity_reactions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_activity ON public.activity_comments(activity_id);

-- Comments
COMMENT ON TABLE public.activity_reactions IS 'Parent emoji reactions to student activities';
COMMENT ON TABLE public.activity_comments IS 'Parent comments on student activities';

-- Enable RLS
ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_reactions
DROP POLICY IF EXISTS "activity_reactions_parent_select" ON public.activity_reactions;
CREATE POLICY "activity_reactions_parent_select" ON public.activity_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.student_activity_feed saf
      JOIN public.students s ON s.id = saf.student_id
      WHERE saf.id = activity_reactions.activity_id
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "activity_reactions_parent_insert" ON public.activity_reactions;
CREATE POLICY "activity_reactions_parent_insert" ON public.activity_reactions
  FOR INSERT WITH CHECK (parent_id = auth.uid());

-- RLS Policies for activity_comments
DROP POLICY IF EXISTS "activity_comments_parent_select" ON public.activity_comments;
CREATE POLICY "activity_comments_parent_select" ON public.activity_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.student_activity_feed saf
      JOIN public.students s ON s.id = saf.student_id
      WHERE saf.id = activity_comments.activity_id
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "activity_comments_parent_insert" ON public.activity_comments;
CREATE POLICY "activity_comments_parent_insert" ON public.activity_comments
  FOR INSERT WITH CHECK (parent_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_comments TO authenticated;
