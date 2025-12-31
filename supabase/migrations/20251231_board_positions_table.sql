-- Migration: Board Positions Table
-- Purpose: Track main board leadership positions for organizations
-- Created: 2025-12-31
-- 
-- This table stores the main board positions (President, Vice Chair, Secretary, Treasurer, Board Members)
-- separate from wing leadership (Youth, Women, Veterans) which is in organization_wings table.

-- ============================================================================
-- SECTION 1: Create Board Positions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_board_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Position Details
  position_code TEXT NOT NULL CHECK (position_code IN (
    'president', 'vice_president', 'vice_chairperson',
    'secretary', 'treasurer', 'board_member'
  )),
  position_title TEXT NOT NULL, -- Display name, e.g., "President & Chairperson"
  position_order INTEGER DEFAULT 0, -- For display ordering
  
  -- Occupant (nullable = vacant)
  member_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  appointed_at TIMESTAMPTZ,
  appointed_by UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  term_start DATE,
  term_end DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Partial unique index: one position per org (except board_member which can have multiple)
CREATE UNIQUE INDEX IF NOT EXISTS unique_executive_position_idx 
ON organization_board_positions (organization_id, position_code)
WHERE position_code != 'board_member';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_positions_org ON organization_board_positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_board_positions_member ON organization_board_positions(member_id);
CREATE INDEX IF NOT EXISTS idx_board_positions_code ON organization_board_positions(position_code);

-- Comments
COMMENT ON TABLE organization_board_positions IS 'Main board leadership positions for organizations (President, VP, Secretary, Treasurer, Board Members)';
COMMENT ON COLUMN organization_board_positions.position_code IS 'Position type: president, vice_president, secretary, treasurer, board_member';
COMMENT ON COLUMN organization_board_positions.member_id IS 'Current occupant of position (NULL = vacant)';

-- ============================================================================
-- SECTION 2: RLS Policies
-- ============================================================================

ALTER TABLE organization_board_positions ENABLE ROW LEVEL SECURITY;

-- Members of the organization can view board positions
CREATE POLICY "organization_board_positions_select_policy"
ON organization_board_positions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_board_positions.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Only president/CEO/national_admin can manage board positions
CREATE POLICY "organization_board_positions_insert_policy"
ON organization_board_positions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_board_positions.organization_id
    AND om.user_id = auth.uid()
    AND (om.member_type IN ('national_admin') OR om.role IN ('admin', 'national_admin', 'president', 'ceo'))
  )
);

CREATE POLICY "organization_board_positions_update_policy"
ON organization_board_positions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_board_positions.organization_id
    AND om.user_id = auth.uid()
    AND (om.member_type IN ('national_admin') OR om.role IN ('admin', 'national_admin', 'president', 'ceo'))
  )
);

CREATE POLICY "organization_board_positions_delete_policy"
ON organization_board_positions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_board_positions.organization_id
    AND om.user_id = auth.uid()
    AND (om.member_type IN ('national_admin') OR om.role IN ('admin', 'national_admin', 'president', 'ceo'))
  )
);

-- ============================================================================
-- SECTION 3: Function to Initialize Default Board Positions
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_organization_board_positions(p_organization_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default positions if they don't exist
  INSERT INTO organization_board_positions (organization_id, position_code, position_title, position_order)
  VALUES
    (p_organization_id, 'president', 'President & Chairperson', 1),
    (p_organization_id, 'vice_chairperson', 'Vice Chairperson', 2),
    (p_organization_id, 'secretary', 'Secretary', 3),
    (p_organization_id, 'treasurer', 'Treasurer', 4),
    (p_organization_id, 'board_member', 'Board Member', 5)
  ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION initialize_organization_board_positions IS 'Initialize default board positions for a new organization';

-- ============================================================================
-- SECTION 4: Function to Appoint Board Member
-- ============================================================================

CREATE OR REPLACE FUNCTION appoint_board_member(
  p_position_id UUID,
  p_member_id UUID,
  p_appointed_by UUID DEFAULT NULL
)
RETURNS organization_board_positions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result organization_board_positions;
  v_appointer_role TEXT;
BEGIN
  -- Get appointer's role if provided
  IF p_appointed_by IS NOT NULL THEN
    SELECT member_type INTO v_appointer_role
    FROM organization_members
    WHERE id = p_appointed_by;
    
    -- Only president/national_admin can appoint
    IF v_appointer_role NOT IN ('national_admin') THEN
      -- Also check role column
      SELECT role INTO v_appointer_role
      FROM organization_members
      WHERE id = p_appointed_by;
      
      IF v_appointer_role NOT IN ('admin', 'national_admin', 'president', 'ceo') THEN
        RAISE EXCEPTION 'Insufficient permissions to appoint board members';
      END IF;
    END IF;
  END IF;

  UPDATE organization_board_positions
  SET 
    member_id = p_member_id,
    appointed_at = now(),
    appointed_by = p_appointed_by,
    term_start = CURRENT_DATE,
    updated_at = now()
  WHERE id = p_position_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION appoint_board_member IS 'Appoint a member to a board position';

-- ============================================================================
-- SECTION 5: Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_board_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_board_positions_updated_at ON organization_board_positions;
CREATE TRIGGER trigger_board_positions_updated_at
  BEFORE UPDATE ON organization_board_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_board_positions_updated_at();
