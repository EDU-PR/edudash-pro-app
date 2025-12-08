-- ============================================================================
-- EduDash Pro: Phase 1 - Calendar, Announcements, Settings
-- Migration: 20251201000001_phase1_calendar_announcements.sql
-- 
-- Purpose: Create tables for school calendar, enhanced announcements, and 
--          school settings configuration
-- 
-- Tables: school_events, school_settings (announcements already exists)
-- Policies: RLS for multi-tenant isolation
-- ============================================================================

-- ============================================================================
-- 1. SCHOOL EVENTS TABLE (Calendar Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS school_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'holiday', 'parent_meeting', 'field_trip', 'assembly', 
    'sports_day', 'graduation', 'fundraiser', 'other'
  )),
  
  -- Date and time
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Recurrence
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule JSONB, -- Stores RRULE format: { freq: 'weekly', interval: 1, byweekday: [1,3,5] }
  recurrence_end_date TIMESTAMPTZ,
  
  -- Location
  location TEXT,
  virtual_link TEXT,
  
  -- Audience and notifications
  target_audience TEXT[] NOT NULL DEFAULT ARRAY['all'], -- ['all', 'parents', 'teachers', 'staff']
  send_notification BOOLEAN NOT NULL DEFAULT TRUE,
  notification_sent_at TIMESTAMPTZ,
  
  -- RSVP tracking
  rsvp_required BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_deadline TIMESTAMPTZ,
  max_attendees INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  cancelled_reason TEXT,
  
  -- Attachments (stored in Supabase Storage)
  attachment_urls TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_rsvp_deadline CHECK (rsvp_deadline IS NULL OR rsvp_deadline <= start_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_events_preschool_id ON school_events(preschool_id);
CREATE INDEX IF NOT EXISTS idx_school_events_start_date ON school_events(start_date);
CREATE INDEX IF NOT EXISTS idx_school_events_status ON school_events(preschool_id, status);
CREATE INDEX IF NOT EXISTS idx_school_events_type ON school_events(preschool_id, event_type);
CREATE INDEX IF NOT EXISTS idx_school_events_created_by ON school_events(created_by);

-- Column comments
COMMENT ON TABLE school_events IS 'School calendar events with recurrence, RSVP, and notifications';
COMMENT ON COLUMN school_events.recurrence_rule IS 'JSON: { freq: "weekly", interval: 1, byweekday: [1,3] }';
COMMENT ON COLUMN school_events.target_audience IS 'Array of audiences: all, parents, teachers, staff';

-- Updated_at trigger
CREATE OR REPLACE TRIGGER update_school_events_updated_at
  BEFORE UPDATE ON school_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. EVENT RSVPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- RSVP details
  response TEXT NOT NULL CHECK (response IN ('attending', 'not_attending', 'maybe')),
  guest_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  
  -- Timestamps
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one RSVP per user per event
  CONSTRAINT unique_event_user_rsvp UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_preschool_id ON event_rsvps(preschool_id);

-- ============================================================================
-- 3. SCHOOL SETTINGS TABLE (Centralized Configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL UNIQUE REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- School profile
  school_name TEXT,
  school_logo_url TEXT,
  school_colors JSONB, -- { primary: '#4F46E5', secondary: '#10B981' }
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- Operating hours
  operating_hours JSONB, -- { monday: { open: '07:00', close: '17:00' }, ... }
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  
  -- Academic calendar
  school_year_start_date DATE,
  school_year_end_date DATE,
  term_dates JSONB, -- [{ term: 1, start: '2025-01-15', end: '2025-04-10' }, ...]
  
  -- Fee structure
  registration_fee DECIMAL(10, 2),
  monthly_tuition DECIMAL(10, 2),
  custom_fees JSONB, -- [{ name: 'Uniform', amount: 500, recurring: false }, ...]
  
  -- Communication preferences
  notification_preferences JSONB, -- { email: true, sms: false, whatsapp: true, push: true }
  announcement_auto_notify BOOLEAN DEFAULT TRUE,
  event_reminder_days INTEGER DEFAULT 3, -- Send reminders 3 days before event
  
  -- Feature toggles
  features_enabled JSONB, -- { whatsapp: true, video_calls: false, ai_assistant: true }
  
  -- Report card branding (moved from preschools.settings)
  report_card_config JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_settings_preschool_id ON school_settings(preschool_id);

COMMENT ON TABLE school_settings IS 'Centralized school configuration and preferences';
COMMENT ON COLUMN school_settings.operating_hours IS 'JSON: { monday: { open: "07:00", close: "17:00" } }';
COMMENT ON COLUMN school_settings.term_dates IS 'JSON array of term dates';

-- Updated_at trigger
CREATE OR REPLACE TRIGGER update_school_settings_updated_at
  BEFORE UPDATE ON school_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ENHANCE EXISTING ANNOUNCEMENTS TABLE
-- ============================================================================

-- Add new columns to existing announcements table
ALTER TABLE announcements 
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[];

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_announcements_scheduled ON announcements(preschool_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(preschool_id, is_pinned, published_at DESC);

COMMENT ON COLUMN announcements.scheduled_for IS 'Future publish date (NULL = publish immediately)';
COMMENT ON COLUMN announcements.is_pinned IS 'Pin to top of announcements list';

-- ============================================================================
-- 5. ANNOUNCEMENT VIEWS TABLE (Track who viewed announcements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint
  CONSTRAINT unique_announcement_user_view UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON announcement_views(user_id);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;

-- SCHOOL EVENTS POLICIES
-- Principals can manage all events for their school
DROP POLICY IF EXISTS school_events_principal_all ON school_events;
CREATE POLICY school_events_principal_all ON school_events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = school_events.preschool_id
      AND profiles.role IN ('principal', 'principal_admin')
  )
);

-- Teachers and parents can view events for their school
DROP POLICY IF EXISTS school_events_view ON school_events;
CREATE POLICY school_events_view ON school_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = school_events.preschool_id
  )
);

-- EVENT RSVPS POLICIES
-- Users can RSVP to events in their school
DROP POLICY IF EXISTS event_rsvps_user ON event_rsvps;
CREATE POLICY event_rsvps_user ON event_rsvps
FOR ALL
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = event_rsvps.preschool_id
  )
);

-- Principals can view all RSVPs
DROP POLICY IF EXISTS event_rsvps_principal_view ON event_rsvps;
CREATE POLICY event_rsvps_principal_view ON event_rsvps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = event_rsvps.preschool_id
      AND profiles.role IN ('principal', 'principal_admin')
  )
);

-- SCHOOL SETTINGS POLICIES
-- Principals can manage settings for their school
DROP POLICY IF EXISTS school_settings_principal ON school_settings;
CREATE POLICY school_settings_principal ON school_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = school_settings.preschool_id
      AND profiles.role IN ('principal', 'principal_admin')
  )
);

-- All staff can view settings
DROP POLICY IF EXISTS school_settings_view ON school_settings;
CREATE POLICY school_settings_view ON school_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = school_settings.preschool_id
  )
);

-- ANNOUNCEMENT VIEWS POLICIES
-- Users can track their own views
DROP POLICY IF EXISTS announcement_views_user ON announcement_views;
CREATE POLICY announcement_views_user ON announcement_views
FOR ALL
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = announcement_views.preschool_id
  )
);

-- Principals can view all announcement analytics
DROP POLICY IF EXISTS announcement_views_principal ON announcement_views;
CREATE POLICY announcement_views_principal ON announcement_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = announcement_views.preschool_id
      AND profiles.role IN ('principal', 'principal_admin')
  )
);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to auto-create school_settings on preschool creation
CREATE OR REPLACE FUNCTION create_default_school_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO school_settings (
    preschool_id,
    school_name,
    notification_preferences,
    features_enabled
  ) VALUES (
    NEW.id,
    NEW.name,
    '{"email": true, "push": true, "whatsapp": false, "sms": false}'::jsonb,
    '{"whatsapp": true, "video_calls": true, "ai_assistant": true}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create settings
DROP TRIGGER IF EXISTS trigger_create_school_settings ON preschools;
CREATE TRIGGER trigger_create_school_settings
  AFTER INSERT ON preschools
  FOR EACH ROW
  EXECUTE FUNCTION create_default_school_settings();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

COMMENT ON SCHEMA public IS 'Phase 1 migration complete: Calendar, Announcements, Settings';
