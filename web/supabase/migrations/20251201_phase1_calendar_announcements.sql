-- ============================================================================
-- PHASE 1: Calendar, Announcements, and School Settings
-- Date: 2024-12-01
-- Description: Core principal management features for autonomous school operations
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
    'sports_day', 'graduation', 'fundraiser', 'workshop', 
    'staff_meeting', 'open_house', 'other'
  )),
  
  -- Date and time
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  
  -- Recurrence (for recurring events)
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule JSONB, -- { frequency: 'daily'|'weekly'|'monthly', interval: 1, until: '2024-12-31' }
  
  -- Location
  location TEXT,
  
  -- Participants
  target_audience TEXT[] DEFAULT ARRAY['all'], -- ['all', 'parents', 'teachers', 'students']
  max_participants INTEGER,
  
  -- RSVP tracking
  rsvp_enabled BOOLEAN DEFAULT FALSE,
  rsvp_deadline TIMESTAMPTZ,
  
  -- Notifications
  send_notifications BOOLEAN DEFAULT TRUE,
  notification_sent BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  
  -- Metadata
  color TEXT DEFAULT '#3b82f6', -- Hex color for calendar display
  attachments JSONB, -- [{url, name, type}]
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_events_preschool_date 
ON school_events(preschool_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_school_events_type 
ON school_events(preschool_id, event_type);

CREATE INDEX IF NOT EXISTS idx_school_events_status 
ON school_events(preschool_id, status);

-- RLS Policies
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

-- Principals and teachers can view events from their school
DROP POLICY IF EXISTS school_events_select_policy ON school_events;
CREATE POLICY school_events_select_policy ON school_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = school_events.preschool_id
  )
);

-- Only principals can create events
DROP POLICY IF EXISTS school_events_insert_policy ON school_events;
CREATE POLICY school_events_insert_policy ON school_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = school_events.preschool_id
    AND profiles.role = 'principal'
  )
  AND created_by = auth.uid()
);

-- Only principals can update events
DROP POLICY IF EXISTS school_events_update_policy ON school_events;
CREATE POLICY school_events_update_policy ON school_events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = school_events.preschool_id
    AND profiles.role = 'principal'
  )
);

-- Only principals can delete events
DROP POLICY IF EXISTS school_events_delete_policy ON school_events;
CREATE POLICY school_events_delete_policy ON school_events
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = school_events.preschool_id
    AND profiles.role = 'principal'
  )
);

-- ============================================================================
-- 2. EVENT RSVPS TABLE (Track attendance/participation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- RSVP details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('attending', 'not_attending', 'maybe', 'pending')),
  number_of_guests INTEGER DEFAULT 0,
  notes TEXT,
  
  -- Timestamps
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(event_id, user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event 
ON event_rsvps(event_id, status);

-- RLS
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_rsvps_select_policy ON event_rsvps;
CREATE POLICY event_rsvps_select_policy ON event_rsvps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = event_rsvps.preschool_id
  )
);

DROP POLICY IF EXISTS event_rsvps_insert_policy ON event_rsvps;
CREATE POLICY event_rsvps_insert_policy ON event_rsvps
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = event_rsvps.preschool_id
  )
);

DROP POLICY IF EXISTS event_rsvps_update_policy ON event_rsvps;
CREATE POLICY event_rsvps_update_policy ON event_rsvps
FOR UPDATE
USING (user_id = auth.uid());

-- ============================================================================
-- 3. ENHANCE ANNOUNCEMENTS TABLE (if exists, otherwise create)
-- ============================================================================

-- Add missing columns if table exists
DO $$ 
BEGIN
  -- Check if announcements table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements') THEN
    -- Add scheduled_for column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'announcements' AND column_name = 'scheduled_for') THEN
      ALTER TABLE announcements ADD COLUMN scheduled_for TIMESTAMPTZ;
    END IF;
    
    -- Add attachments column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'announcements' AND column_name = 'attachments') THEN
      ALTER TABLE announcements ADD COLUMN attachments JSONB;
    END IF;
    
    -- Add view_count column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'announcements' AND column_name = 'view_count') THEN
      ALTER TABLE announcements ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add pinned column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'announcements' AND column_name = 'pinned') THEN
      ALTER TABLE announcements ADD COLUMN pinned BOOLEAN DEFAULT FALSE;
    END IF;
  ELSE
    -- Create announcements table if doesn't exist
    CREATE TABLE announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'teachers', 'parents', 'students', 'staff')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      
      -- Publishing
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      scheduled_for TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      
      -- Engagement
      view_count INTEGER DEFAULT 0,
      pinned BOOLEAN DEFAULT FALSE,
      
      -- Attachments
      attachments JSONB, -- [{url, name, type, size}]
      
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Indexes
    CREATE INDEX idx_announcements_preschool_published 
    ON announcements(preschool_id, is_published, published_at DESC);
    
    CREATE INDEX idx_announcements_scheduled 
    ON announcements(scheduled_for) WHERE scheduled_for IS NOT NULL;
    
    -- RLS
    ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS announcements_select_policy ON announcements;
    CREATE POLICY announcements_select_policy ON announcements
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.preschool_id = announcements.preschool_id
      )
    );
    
    DROP POLICY IF EXISTS announcements_insert_policy ON announcements;
    CREATE POLICY announcements_insert_policy ON announcements
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.preschool_id = announcements.preschool_id
        AND profiles.role IN ('principal', 'teacher')
      )
      AND author_id = auth.uid()
    );
    
    DROP POLICY IF EXISTS announcements_update_policy ON announcements;
    CREATE POLICY announcements_update_policy ON announcements
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.preschool_id = announcements.preschool_id
        AND profiles.role IN ('principal', 'teacher')
      )
    );
    
    DROP POLICY IF EXISTS announcements_delete_policy ON announcements;
    CREATE POLICY announcements_delete_policy ON announcements
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.preschool_id = announcements.preschool_id
        AND profiles.role = 'principal'
      )
    );
  END IF;
END $$;

-- ============================================================================
-- 4. ANNOUNCEMENT VIEWS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(announcement_id, user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement 
ON announcement_views(announcement_id);

-- RLS
ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_views_select_policy ON announcement_views;
CREATE POLICY announcement_views_select_policy ON announcement_views
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS announcement_views_insert_policy ON announcement_views;
CREATE POLICY announcement_views_insert_policy ON announcement_views
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. SCHOOL SETTINGS TABLE (Centralized configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS school_settings (
  preschool_id UUID PRIMARY KEY REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- Operating hours
  operating_hours JSONB DEFAULT '{
    "monday": {"open": "07:00", "close": "17:00"},
    "tuesday": {"open": "07:00", "close": "17:00"},
    "wednesday": {"open": "07:00", "close": "17:00"},
    "thursday": {"open": "07:00", "close": "17:00"},
    "friday": {"open": "07:00", "close": "17:00"}
  }'::jsonb,
  
  -- Academic calendar
  academic_calendar JSONB, -- {term1: {start, end}, term2: {start, end}, holidays: [...]}
  
  -- Fee structure (extends preschools.settings)
  fee_structure JSONB, -- {registration: 500, monthly_tuition: 1500, meals: 200, etc}
  
  -- Communication preferences
  communication_settings JSONB DEFAULT '{
    "email_enabled": true,
    "sms_enabled": false,
    "whatsapp_enabled": false,
    "push_enabled": true
  }'::jsonb,
  
  -- Parent portal settings
  parent_portal_settings JSONB DEFAULT '{
    "allow_homework_submission": true,
    "allow_messaging": true,
    "show_financial_info": true,
    "allow_calendar_view": true
  }'::jsonb,
  
  -- Notification settings
  notification_settings JSONB DEFAULT '{
    "announcements": true,
    "events": true,
    "homework": true,
    "attendance": true,
    "payments": true
  }'::jsonb,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_settings_select_policy ON school_settings;
CREATE POLICY school_settings_select_policy ON school_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = school_settings.preschool_id
  )
);

DROP POLICY IF EXISTS school_settings_update_policy ON school_settings;
CREATE POLICY school_settings_update_policy ON school_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.preschool_id = school_settings.preschool_id
    AND profiles.role = 'principal'
  )
);

-- Insert default settings for existing preschools
INSERT INTO school_settings (preschool_id)
SELECT id FROM preschools
ON CONFLICT (preschool_id) DO NOTHING;

-- ============================================================================
-- 6. FUNCTIONS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update announcement view count
CREATE OR REPLACE FUNCTION increment_announcement_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE announcements 
  SET view_count = view_count + 1 
  WHERE id = NEW.announcement_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_announcement_views ON announcement_views;
CREATE TRIGGER trg_increment_announcement_views
AFTER INSERT ON announcement_views
FOR EACH ROW
EXECUTE FUNCTION increment_announcement_views();

-- Function to auto-publish scheduled announcements
CREATE OR REPLACE FUNCTION auto_publish_announcements()
RETURNS void AS $$
BEGIN
  UPDATE announcements
  SET is_published = TRUE,
      published_at = NOW()
  WHERE is_published = FALSE
    AND scheduled_for IS NOT NULL
    AND scheduled_for <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE school_events IS 'Calendar events for preschool management - holidays, meetings, field trips, etc';
COMMENT ON TABLE event_rsvps IS 'RSVP tracking for events - attendance confirmations';
COMMENT ON TABLE announcement_views IS 'Track which users have viewed announcements';
COMMENT ON TABLE school_settings IS 'Centralized school configuration - operating hours, fees, preferences';

COMMENT ON COLUMN school_events.recurrence_rule IS 'JSONB: {frequency: "daily"|"weekly"|"monthly", interval: 1, until: "2024-12-31"}';
COMMENT ON COLUMN school_events.target_audience IS 'Array: ["all", "parents", "teachers", "students"]';
COMMENT ON COLUMN announcements.scheduled_for IS 'When to auto-publish announcement (NULL = publish immediately)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify tables were created
DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(table_name)
  INTO missing_tables
  FROM (
    VALUES 
      ('school_events'),
      ('event_rsvps'),
      ('announcements'),
      ('announcement_views'),
      ('school_settings')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = expected.table_name
  );
  
  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Migration incomplete. Missing tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE '✅ Phase 1 migration completed successfully';
    RAISE NOTICE '   - school_events: Calendar management';
    RAISE NOTICE '   - event_rsvps: RSVP tracking';
    RAISE NOTICE '   - announcements: Enhanced with scheduling';
    RAISE NOTICE '   - announcement_views: View tracking';
    RAISE NOTICE '   - school_settings: Centralized config';
  END IF;
END $$;
