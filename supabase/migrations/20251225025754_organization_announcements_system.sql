-- Migration: Organization Announcements System
-- Purpose: Create announcements table for organization-wide broadcasts (President to members)
-- Supports: skills, membership, and similar organization types (not preschools)

-- ============================================================================
-- 1. CREATE ORGANIZATION ANNOUNCEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  -- Target audience: all members, regional managers only, or specific region
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'regional_managers', 'branch_managers', 'members')),
  target_region_id UUID REFERENCES organization_regions(id) ON DELETE SET NULL,
  -- Priority levels
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  -- Announcement type
  announcement_type TEXT NOT NULL DEFAULT 'general' CHECK (announcement_type IN ('general', 'policy', 'event', 'financial', 'strategic', 'emergency')),
  -- Attachments (array of URLs)
  attachments JSONB DEFAULT '[]'::jsonb,
  -- Publishing
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  -- Read tracking
  read_by UUID[] DEFAULT '{}',
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_announcements_org_id ON organization_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_author ON organization_announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_org_announcements_published ON organization_announcements(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_announcements_target ON organization_announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_org_announcements_region ON organization_announcements(target_region_id) WHERE target_region_id IS NOT NULL;

-- ============================================================================
-- 2. CREATE ANNOUNCEMENT RECIPIENTS TABLE (for targeted delivery tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_announcement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES organization_announcements(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  notification_method TEXT CHECK (notification_method IN ('push', 'email', 'sms', 'in_app')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_ann_recipients_announcement ON organization_announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_ann_recipients_recipient ON organization_announcement_recipients(recipient_id);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE organization_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_announcement_recipients ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES FOR organization_announcements
-- ============================================================================

-- Policy: Organization admins (President/CEO) can create announcements
DROP POLICY IF EXISTS "org_admins_create_announcements" ON organization_announcements;
CREATE POLICY "org_admins_create_announcements" ON organization_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_announcements.organization_id
      AND om.role IN ('admin', 'national_admin', 'president', 'ceo')
      AND om.membership_status = 'active'
    )
  );

-- Policy: Organization admins can update their org's announcements
DROP POLICY IF EXISTS "org_admins_update_announcements" ON organization_announcements;
CREATE POLICY "org_admins_update_announcements" ON organization_announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_announcements.organization_id
      AND om.role IN ('admin', 'national_admin', 'president', 'ceo')
      AND om.membership_status = 'active'
    )
  );

-- Policy: Organization admins can delete their org's announcements
DROP POLICY IF EXISTS "org_admins_delete_announcements" ON organization_announcements;
CREATE POLICY "org_admins_delete_announcements" ON organization_announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_announcements.organization_id
      AND om.role IN ('admin', 'national_admin', 'president', 'ceo')
      AND om.membership_status = 'active'
    )
  );

-- Policy: Members can view published announcements for their organization
DROP POLICY IF EXISTS "members_view_announcements" ON organization_announcements;
CREATE POLICY "members_view_announcements" ON organization_announcements
  FOR SELECT
  TO authenticated
  USING (
    is_published = TRUE
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_announcements.organization_id
      AND om.membership_status = 'active'
      AND (
        -- All members can see 'all' announcements
        organization_announcements.target_audience = 'all'
        -- Regional managers can see their targeted announcements
        OR (organization_announcements.target_audience = 'regional_managers' AND om.role IN ('admin', 'national_admin', 'regional_manager'))
        -- Branch managers can see their targeted announcements
        OR (organization_announcements.target_audience = 'branch_managers' AND om.role IN ('admin', 'national_admin', 'regional_manager', 'branch_manager'))
        -- Specific region targeting
        OR (organization_announcements.target_region_id IS NOT NULL AND om.region_id = organization_announcements.target_region_id)
      )
    )
  );

-- ============================================================================
-- 5. RLS POLICIES FOR organization_announcement_recipients
-- ============================================================================

-- Policy: Recipients can view their own records
DROP POLICY IF EXISTS "recipients_view_own" ON organization_announcement_recipients;
CREATE POLICY "recipients_view_own" ON organization_announcement_recipients
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- Policy: Admins can view all recipients for their org's announcements
DROP POLICY IF EXISTS "admins_view_recipients" ON organization_announcement_recipients;
CREATE POLICY "admins_view_recipients" ON organization_announcement_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_announcements oa
      JOIN organization_members om ON om.organization_id = oa.organization_id
      WHERE oa.id = organization_announcement_recipients.announcement_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'national_admin', 'president', 'ceo')
      AND om.membership_status = 'active'
    )
  );

-- Policy: Recipients can update their own read status
DROP POLICY IF EXISTS "recipients_update_own" ON organization_announcement_recipients;
CREATE POLICY "recipients_update_own" ON organization_announcement_recipients
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Policy: System can insert recipients (via service role or trigger)
DROP POLICY IF EXISTS "system_insert_recipients" ON organization_announcement_recipients;
CREATE POLICY "system_insert_recipients" ON organization_announcement_recipients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_announcements oa
      JOIN organization_members om ON om.organization_id = oa.organization_id
      WHERE oa.id = organization_announcement_recipients.announcement_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'national_admin', 'president', 'ceo')
      AND om.membership_status = 'active'
    )
  );

-- ============================================================================
-- 6. TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_org_announcement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_org_announcement_updated_at ON organization_announcements;
CREATE TRIGGER trigger_org_announcement_updated_at
  BEFORE UPDATE ON organization_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_org_announcement_updated_at();

-- ============================================================================
-- 7. FUNCTION TO GET UNREAD ANNOUNCEMENT COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_org_announcements_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM organization_announcements oa
  WHERE oa.is_published = TRUE
    AND (oa.expires_at IS NULL OR oa.expires_at > now())
    AND NOT (p_user_id = ANY(oa.read_by))
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = p_user_id
      AND om.organization_id = oa.organization_id
      AND om.membership_status = 'active'
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. FUNCTION TO MARK ANNOUNCEMENT AS READ
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_org_announcement_read(p_announcement_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the read_by array
  UPDATE organization_announcements
  SET read_by = array_append(read_by, p_user_id)
  WHERE id = p_announcement_id
    AND NOT (p_user_id = ANY(read_by));
  
  -- Update or insert recipient record
  INSERT INTO organization_announcement_recipients (announcement_id, recipient_id, read_at)
  VALUES (p_announcement_id, p_user_id, now())
  ON CONFLICT (announcement_id, recipient_id)
  DO UPDATE SET read_at = now();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. ENABLE REALTIME FOR ANNOUNCEMENTS
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE organization_announcements;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE organization_announcements IS 'Announcements/broadcasts from organization leadership to members';
COMMENT ON TABLE organization_announcement_recipients IS 'Tracks delivery and read status for announcement recipients';
COMMENT ON FUNCTION get_unread_org_announcements_count IS 'Returns count of unread announcements for a user';
COMMENT ON FUNCTION mark_org_announcement_read IS 'Marks an announcement as read by a user';
