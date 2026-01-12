-- Create lesson_progress table for tracking user progress through lessons
-- This table is essential for the My Lessons and Lesson Detail screens

-- Create the lesson_progress table
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Progress status
    status TEXT NOT NULL DEFAULT 'not_started' 
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused')),
    progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Step tracking
    current_step_id TEXT,
    completed_steps TEXT[] DEFAULT '{}',
    
    -- Time tracking
    started_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    time_spent INTEGER DEFAULT 0, -- in minutes
    
    -- Assessment and notes
    assessment_scores JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Bookmark
    bookmarked_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one progress record per user per lesson
    UNIQUE(lesson_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_status ON public.lesson_progress(status);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_last_accessed ON public.lesson_progress(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON public.lesson_progress(user_id, lesson_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_lesson_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER lesson_progress_updated_at
    BEFORE UPDATE ON public.lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_lesson_progress_updated_at();

-- Enable RLS
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own progress
CREATE POLICY "Users can view own lesson progress"
    ON public.lesson_progress
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own lesson progress"
    ON public.lesson_progress
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own lesson progress"
    ON public.lesson_progress
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete own lesson progress"
    ON public.lesson_progress
    FOR DELETE
    USING (auth.uid() = user_id);

-- Teachers/Principals can view progress of students in their school
CREATE POLICY "Teachers can view student lesson progress"
    ON public.lesson_progress
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('teacher', 'principal', 'principal_admin')
            AND p.preschool_id = (
                SELECT preschool_id FROM public.profiles WHERE id = lesson_progress.user_id
            )
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.lesson_progress IS 'Tracks user progress through lessons including completion status, time spent, and assessment scores';
COMMENT ON COLUMN public.lesson_progress.status IS 'Current progress status: not_started, in_progress, completed, or paused';
COMMENT ON COLUMN public.lesson_progress.progress_percentage IS 'Percentage of lesson completed (0-100)';
COMMENT ON COLUMN public.lesson_progress.completed_steps IS 'Array of step IDs that have been completed';
COMMENT ON COLUMN public.lesson_progress.time_spent IS 'Total time spent on the lesson in minutes';
COMMENT ON COLUMN public.lesson_progress.assessment_scores IS 'JSON object containing assessment ID to score mappings';
