-- Migration: Add Region Invite Codes
-- Description: Create table for regional managers to generate join codes for their regions
-- Author: EduDash Pro Team
-- Date: 2024-12-24

-- Create region_invite_codes table
CREATE TABLE IF NOT EXISTS region_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES organization_regions(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Code settings
  max_uses INTEGER DEFAULT NULL, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL, -- NULL = never expires
  is_active BOOLEAN DEFAULT true,
  
  -- Allowed member types for this code
  allowed_member_types TEXT[] DEFAULT ARRAY['learner', 'facilitator', 'mentor'],
  default_tier VARCHAR(20) DEFAULT 'standard',
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_region_invite_codes_org ON region_invite_codes(organization_id);
CREATE INDEX idx_region_invite_codes_region ON region_invite_codes(region_id);
CREATE INDEX idx_region_invite_codes_code ON region_invite_codes(code);
CREATE INDEX idx_region_invite_codes_active ON region_invite_codes(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE region_invite_codes ENABLE ROW LEVEL SECURITY;

-- Regional managers can manage codes for their region
CREATE POLICY "Regional managers can manage their region codes"
  ON region_invite_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = region_invite_codes.organization_id
        AND om.role IN ('national_admin', 'regional_manager')
        AND (om.role = 'national_admin' OR om.region_id = region_invite_codes.region_id)
    )
  );

-- Anyone can read active codes (for validation during join)
CREATE POLICY "Anyone can read active codes"
  ON region_invite_codes
  FOR SELECT
  USING (is_active = true);

-- Create function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_region_invite_code(
  p_org_code VARCHAR,
  p_region_code VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR;
  v_year VARCHAR;
  v_random VARCHAR;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');
  v_random := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
  v_code := p_org_code || '-' || p_region_code || '-' || v_year || v_random;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Create default invite codes for all Soil Of Africa regions
DO $$
DECLARE
  v_region RECORD;
  v_ceo_id UUID;
  v_org_id UUID := '63b6139a-e21f-447c-b322-376fb0828992';
BEGIN
  -- Get CEO user id
  SELECT user_id INTO v_ceo_id
  FROM organization_members
  WHERE organization_id = v_org_id AND role = 'national_admin'
  LIMIT 1;

  -- Skip if no CEO found
  IF v_ceo_id IS NULL THEN
    RAISE NOTICE 'No CEO found for Soil Of Africa, skipping default code creation';
    RETURN;
  END IF;

  -- Create default codes for each region
  FOR v_region IN 
    SELECT id, name, code, province_code 
    FROM organization_regions 
    WHERE organization_id = v_org_id AND is_active = true
  LOOP
    -- Insert default code if not exists
    INSERT INTO region_invite_codes (
      organization_id,
      region_id,
      code,
      created_by,
      description,
      allowed_member_types,
      default_tier
    )
    VALUES (
      v_org_id,
      v_region.id,
      'SOA-' || v_region.province_code || '-2025',
      v_ceo_id,
      'Default invite code for ' || v_region.name || ' region',
      ARRAY['learner', 'facilitator', 'mentor'],
      'standard'
    )
    ON CONFLICT (code) DO NOTHING;
    
    RAISE NOTICE 'Created/verified code for %: SOA-%-2025', v_region.name, v_region.province_code;
  END LOOP;
END $$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_region_invite_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_region_invite_codes_updated_at
  BEFORE UPDATE ON region_invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_region_invite_codes_updated_at();

-- Add comment
COMMENT ON TABLE region_invite_codes IS 'Invite codes for joining organization regions. Regional managers can generate codes for their regions.';
