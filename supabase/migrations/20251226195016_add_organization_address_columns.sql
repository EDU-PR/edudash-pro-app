-- Add missing address and contact columns to organization-related tables
-- These columns are needed for proper organization management in super-admin dashboard

-- ============================================================================
-- PRESCHOOLS TABLE - Add location columns
-- ============================================================================

ALTER TABLE preschools
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS province VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'South Africa',
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS principal_id UUID REFERENCES auth.users(id);

-- Add comments
COMMENT ON COLUMN preschools.city IS 'City where the preschool is located';
COMMENT ON COLUMN preschools.province IS 'Province/state where the preschool is located';
COMMENT ON COLUMN preschools.country IS 'Country where the preschool is located';
COMMENT ON COLUMN preschools.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN preschools.is_verified IS 'Whether the preschool has been verified by admin';
COMMENT ON COLUMN preschools.metadata IS 'Additional metadata as JSON';
COMMENT ON COLUMN preschools.principal_id IS 'Reference to the principal user';

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_preschools_city ON preschools(city);
CREATE INDEX IF NOT EXISTS idx_preschools_province ON preschools(province);
CREATE INDEX IF NOT EXISTS idx_preschools_is_verified ON preschools(is_verified);

-- ============================================================================
-- SCHOOLS TABLE - Add missing columns
-- ============================================================================

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS province VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'South Africa',
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS principal_id UUID REFERENCES auth.users(id);

-- Add comments
COMMENT ON COLUMN schools.city IS 'City where the school is located';
COMMENT ON COLUMN schools.province IS 'Province/state where the school is located';
COMMENT ON COLUMN schools.country IS 'Country where the school is located';
COMMENT ON COLUMN schools.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN schools.is_active IS 'Whether the school is currently active';
COMMENT ON COLUMN schools.metadata IS 'Additional metadata as JSON';
COMMENT ON COLUMN schools.logo_url IS 'URL to the school logo image';
COMMENT ON COLUMN schools.principal_id IS 'Reference to the principal user';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_schools_city ON schools(city);
CREATE INDEX IF NOT EXISTS idx_schools_province ON schools(province);
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);

-- ============================================================================
-- ORGANIZATIONS TABLE - Add missing columns
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS province VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS organization_type VARCHAR(50) DEFAULT 'org',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS principal_id UUID REFERENCES auth.users(id);

-- Add comments
COMMENT ON COLUMN organizations.city IS 'City where the organization is located';
COMMENT ON COLUMN organizations.province IS 'Province/state where the organization is located';
COMMENT ON COLUMN organizations.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN organizations.contact_email IS 'Primary contact email for the organization';
COMMENT ON COLUMN organizations.contact_phone IS 'Primary contact phone number';
COMMENT ON COLUMN organizations.organization_type IS 'Type of organization (preschool, k12, skills, org, etc.)';
COMMENT ON COLUMN organizations.metadata IS 'Additional metadata as JSON';
COMMENT ON COLUMN organizations.logo_url IS 'URL to the organization logo image';
COMMENT ON COLUMN organizations.is_verified IS 'Whether the organization has been verified by admin';
COMMENT ON COLUMN organizations.principal_id IS 'Reference to the principal/admin user';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_city ON organizations(city);
CREATE INDEX IF NOT EXISTS idx_organizations_province ON organizations(province);
CREATE INDEX IF NOT EXISTS idx_organizations_organization_type ON organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_organizations_is_verified ON organizations(is_verified);

-- ============================================================================
-- Backfill contact_email from email column where applicable
-- ============================================================================

UPDATE organizations
SET contact_email = email
WHERE contact_email IS NULL AND email IS NOT NULL;

UPDATE organizations
SET contact_phone = phone
WHERE contact_phone IS NULL AND phone IS NOT NULL;

-- ============================================================================
-- Add constraint for valid organization types
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_type_check'
  ) THEN
    ALTER TABLE organizations
    ADD CONSTRAINT organizations_type_check
    CHECK (organization_type IN ('preschool', 'daycare', 'primary_school', 'k12', 'skills', 'tertiary', 'org', 'other'));
  END IF;
END $$;

COMMENT ON CONSTRAINT organizations_type_check ON organizations IS 'Valid organization types';
