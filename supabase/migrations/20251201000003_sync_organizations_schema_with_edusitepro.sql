-- ============================================
-- SYNC ORGANIZATIONS SCHEMA WITH EDUSITEPRO
-- ============================================
-- Add missing columns to match EduSitePro schema
-- This ensures data consistency across both databases

-- Add slug column (unique identifier for URL routing)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug VARCHAR(100);

-- Add max_centres column (subscription tier limit)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS max_centres INTEGER DEFAULT 1;

-- Add primary contact columns
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS primary_contact_name VARCHAR(255);

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS primary_contact_email VARCHAR(255);

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS primary_contact_phone VARCHAR(50);

-- Add billing_email column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Add province column (rename state later if needed, or keep both)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS province VARCHAR(100);

-- Add stripe_customer_id for payment integration
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add subscription dates to match EduSitePro
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ;

-- Add branding and settings JSON columns
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add school_code for principal access
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS school_code VARCHAR(20);

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS principal_id UUID REFERENCES auth.users(id);

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique_idx 
ON organizations(slug) 
WHERE slug IS NOT NULL;

-- Create index on school_code
CREATE INDEX IF NOT EXISTS organizations_school_code_idx 
ON organizations(school_code) 
WHERE school_code IS NOT NULL;

-- Add check constraint for slug format (lowercase, alphanumeric, hyphens)
ALTER TABLE organizations 
ADD CONSTRAINT organizations_slug_format_check 
CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]+$');

-- Update existing records to populate new fields from old ones
UPDATE organizations
SET 
  primary_contact_email = email,
  primary_contact_phone = phone,
  province = state
WHERE primary_contact_email IS NULL;

-- Add comment
COMMENT ON TABLE organizations IS 'Organizations table synced with EduSitePro schema for cross-database consistency';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier (synced from EduSitePro)';
COMMENT ON COLUMN organizations.max_centres IS 'Maximum number of centres allowed by subscription tier';
COMMENT ON COLUMN organizations.billing_email IS 'Email address for billing and invoices';
COMMENT ON COLUMN organizations.school_code IS 'Unique code for school access and principal login';
