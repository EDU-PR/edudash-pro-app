-- ============================================================================
-- Migration: Add unique constraints for organization members
-- Purpose: Prevent duplicate registrations (same person in multiple regions)
-- ============================================================================

-- Add unique constraint on email per organization
-- This ensures the same email cannot register multiple times for the same organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique_email 
  ON organization_members(organization_id, LOWER(email)) 
  WHERE email IS NOT NULL;

-- Add unique constraint on id_number per organization
-- This ensures the same ID number cannot register multiple times for the same organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique_id_number 
  ON organization_members(organization_id, id_number) 
  WHERE id_number IS NOT NULL AND id_number != '';

-- Add unique constraint on phone per organization (optional extra protection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique_phone 
  ON organization_members(organization_id, phone) 
  WHERE phone IS NOT NULL AND phone != '';

-- Comment on the constraints
COMMENT ON INDEX idx_org_members_unique_email IS 'Prevents duplicate email registrations within an organization';
COMMENT ON INDEX idx_org_members_unique_id_number IS 'Prevents duplicate ID number registrations within an organization';
COMMENT ON INDEX idx_org_members_unique_phone IS 'Prevents duplicate phone registrations within an organization';
