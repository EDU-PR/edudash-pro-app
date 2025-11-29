-- Migration: Create video_calls table for group lessons and in_app_notifications
-- Purpose: Support Daily.co group video calls and in-app notification center

-- =============================================================================
-- Table: video_calls (Group Lessons / Class Video Sessions)
-- Purpose: Track video call sessions for live lessons
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.video_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meeting_id TEXT NOT NULL,
    meeting_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
    scheduled_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    max_participants INTEGER DEFAULT 50,
    participant_count INTEGER DEFAULT 0,
    recording_enabled BOOLEAN DEFAULT false,
    recording_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for video_calls
CREATE INDEX IF NOT EXISTS idx_video_calls_preschool ON public.video_calls(preschool_id, status);
CREATE INDEX IF NOT EXISTS idx_video_calls_class ON public.video_calls(class_id, status);
CREATE INDEX IF NOT EXISTS idx_video_calls_teacher ON public.video_calls(teacher_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_meeting ON public.video_calls(meeting_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_scheduled ON public.video_calls(scheduled_start) WHERE status = 'scheduled';

-- Enable RLS
ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own video calls
CREATE POLICY "Teachers can manage their video calls"
    ON public.video_calls FOR ALL
    USING (
        auth.uid() = teacher_id 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('principal', 'superadmin')
        )
    );

-- Parents can view calls for classes their children are in
CREATE POLICY "Parents can view class video calls"
    ON public.video_calls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.class_id = video_calls.class_id
            AND s.parent_id = auth.uid()
        )
    );

-- =============================================================================
-- Table: scheduled_lessons (For future scheduled lessons)
-- Purpose: Store lessons scheduled for later with reminder settings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    room_url TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    send_reminders BOOLEAN DEFAULT true,
    reminder_sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'started', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scheduled_lessons
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_class ON public.scheduled_lessons(class_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_teacher ON public.scheduled_lessons(teacher_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_pending ON public.scheduled_lessons(scheduled_at) 
    WHERE status = 'scheduled' AND send_reminders = true AND reminder_sent_at IS NULL;

-- Enable RLS
ALTER TABLE public.scheduled_lessons ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their scheduled lessons
CREATE POLICY "Teachers can manage their scheduled lessons"
    ON public.scheduled_lessons FOR ALL
    USING (auth.uid() = teacher_id);

-- Parents can view scheduled lessons for their children's classes
CREATE POLICY "Parents can view scheduled lessons"
    ON public.scheduled_lessons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.class_id = scheduled_lessons.class_id
            AND s.parent_id = auth.uid()
        )
    );

-- =============================================================================
-- Table: in_app_notifications (Notification Center)
-- Purpose: Store in-app notifications for the notification center
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for in_app_notifications
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON public.in_app_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_type ON public.in_app_notifications(user_id, type, created_at DESC);

-- Enable RLS
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own notifications
CREATE POLICY "Users can manage their notifications"
    ON public.in_app_notifications FOR ALL
    USING (auth.uid() = user_id);

-- Service role can insert notifications for any user
CREATE POLICY "Service role can manage all notifications"
    ON public.in_app_notifications FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_lessons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.video_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scheduled_lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.video_calls TO service_role;
GRANT ALL ON public.scheduled_lessons TO service_role;
GRANT ALL ON public.in_app_notifications TO service_role;

-- =============================================================================
-- Update trigger for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_video_calls_updated_at ON public.video_calls;
CREATE TRIGGER update_video_calls_updated_at
    BEFORE UPDATE ON public.video_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_lessons_updated_at ON public.scheduled_lessons;
CREATE TRIGGER update_scheduled_lessons_updated_at
    BEFORE UPDATE ON public.scheduled_lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.video_calls IS 'Tracks Daily.co video call sessions for live class lessons';
COMMENT ON TABLE public.scheduled_lessons IS 'Stores lessons scheduled for future dates with reminder settings';
COMMENT ON TABLE public.in_app_notifications IS 'In-app notification center for user notifications';
