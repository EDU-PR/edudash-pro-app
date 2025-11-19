#!/bin/bash

# Young Eagles Integration Script
# ARCHITECTURE: EduSitePro = Master DB, EduDash Pro = Links to it
# 
# EduSitePro: Website builder + preschool/organization master data
# EduDash Pro: Admin app that queries EduSitePro's organizations
# Young Eagles: Tenant in EduSitePro, accessible via EduDash Pro

set -e

echo "🦅 Young Eagles Integration - Proper Architecture"
echo "=================================================="
echo ""
echo "ARCHITECTURE:"
echo "  EduSitePro    = Master preschool database"
echo "  EduDash Pro   = Links to EduSitePro organizations"
echo "  Young Eagles  = Tenant in EduSitePro"
echo ""

# You need to set these environment variables
EDUSITEPRO_DB_URL="${EDUSITEPRO_DB_URL:-}"
EDUDASHPRO_DB_URL="postgresql://postgres.bppuzibjlxgfwrujzfsz:hHFgMNhsfdUKUEkA@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

if [ -z "$EDUSITEPRO_DB_URL" ]; then
  echo "❌ ERROR: EDUSITEPRO_DB_URL not set"
  echo ""
  echo "Please set your EduSitePro database URL:"
  echo "  export EDUSITEPRO_DB_URL='postgresql://postgres.xxx:password@xxx.supabase.co:5432/postgres'"
  echo ""
  exit 1
fi

echo "Step 1: Creating Young Eagles in EduSitePro (Master DB)..."
echo "-----------------------------------------------------------"

psql "$EDUSITEPRO_DB_URL" <<'SQL'
-- Create Young Eagles organization in EduSitePro (Master DB)
INSERT INTO organizations (
  id,
  name,
  slug,
  organization_type,
  country,
  city,
  province,
  logo_url,
  primary_color,
  tagline,
  established_year,
  total_students,
  total_teachers,
  is_public,
  directory_listing,
  featured,
  website,
  email,
  phone
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Young Eagles Preschool',
  'young-eagles',
  'preschool',
  'ZA',
  'City',
  'Province',
  'https://youngeagles.org.za/logo.png',
  '#0066CC',
  'Empowering young minds to soar',
  2010,
  120,
  12,
  true,
  true,
  true,
  'https://youngeagles.org.za',
  'info@youngeagles.org.za',
  '+27 XX XXX XXXX'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  email = EXCLUDED.email;

-- Create centre entry for Young Eagles
INSERT INTO centres (
  id,
  organization_id,
  slug,
  name,
  primary_domain,
  contact_email,
  contact_phone,
  status,
  plan_tier,
  default_subdomain,
  onboarding_status
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'young-eagles',
  'Young Eagles Preschool',
  'youngeagles.org.za',
  'info@youngeagles.org.za',
  '+27 XX XXX XXXX',
  'active',
  'enterprise',
  'youngeagles',
  'completed'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  primary_domain = EXCLUDED.primary_domain;

SQL

echo "✅ Young Eagles created in EduSitePro (Master DB)"

echo "✅ Young Eagles created in EduSitePro (Master DB)"

echo ""
echo "Step 2: Configure EduDash Pro to link to EduSitePro database..."
echo "----------------------------------------------------------------"

psql "$EDUDASHPRO_DB_URL" <<'SQL'
-- Create foreign data wrapper to link to EduSitePro database
-- This allows EduDash Pro to query organizations from EduSitePro

-- Note: You need superuser privileges for this
-- If you can't create FDW, use API approach instead (see YOUNGEAGLES_INTEGRATION_PLAN.md)

-- Example FDW setup (requires superuser):
-- CREATE EXTENSION IF NOT EXISTS postgres_fdw;
-- 
-- CREATE SERVER edusitepro_server
--   FOREIGN DATA WRAPPER postgres_fdw
--   OPTIONS (host 'your-edusitepro.supabase.co', port '5432', dbname 'postgres');
-- 
-- CREATE USER MAPPING FOR postgres
--   SERVER edusitepro_server
--   OPTIONS (user 'postgres', password 'your-password');
-- 
-- CREATE FOREIGN TABLE organizations_fdw (
--   id UUID,
--   name TEXT,
--   slug TEXT,
--   email TEXT,
--   phone TEXT,
--   ...
-- ) SERVER edusitepro_server OPTIONS (schema_name 'public', table_name 'organizations');

-- For now, create a view that EduDash Pro can use
-- We'll populate this via API or scheduled sync
CREATE TABLE IF NOT EXISTS linked_organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  organization_type TEXT,
  logo_url TEXT,
  primary_color TEXT,
  total_students INTEGER,
  total_teachers INTEGER,
  edusitepro_sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Young Eagles as linked organization
INSERT INTO linked_organizations (
  id,
  name,
  slug,
  email,
  phone,
  city,
  province,
  country,
  organization_type,
  logo_url,
  primary_color,
  total_students,
  total_teachers
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Young Eagles Preschool',
  'young-eagles',
  'info@youngeagles.org.za',
  '+27 XX XXX XXXX',
  'City',
  'Province',
  'South Africa',
  'preschool',
  'https://youngeagles.org.za/logo.png',
  '#0066CC',
  120,
  12
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  updated_at = NOW();

-- Create child_registration_requests table if not exists
CREATE TABLE IF NOT EXISTS child_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES linked_organizations(id),
  child_first_name TEXT NOT NULL,
  child_last_name TEXT NOT NULL,
  child_dob DATE NOT NULL,
  parent_first_name TEXT NOT NULL,
  parent_last_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_id_number TEXT,
  parent_address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  medical_info TEXT,
  enrollment_year TEXT DEFAULT '2026',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);

-- Create index on organization_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_registrations_org 
  ON child_registration_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status 
  ON child_registration_requests(status);

SQL

echo "✅ EduDash Pro configured to link to EduSitePro organizations"

echo ""
echo "Step 3: Summary & Next Steps..."
echo "--------------------------------"

cat <<'SUMMARY'

✅ Setup Complete!

ARCHITECTURE:
  ┌─────────────────────────────────────────────┐
  │         EduSitePro (Master DB)              │
  │  - organizations table                      │
  │  - centres table                            │
  │  - pages, page_blocks                       │
  │  - Website builder for Young Eagles         │
  └─────────────────────────────────────────────┘
                      ▲
                      │ (linked via API/FDW)
                      ▼
  ┌─────────────────────────────────────────────┐
  │         EduDash Pro (Admin App)             │
  │  - linked_organizations (synced)            │
  │  - child_registration_requests              │
  │  - Admin dashboards                         │
  │  - Student management                       │
  └─────────────────────────────────────────────┘

NEXT STEPS:

1. Switch to EduSitePro workspace:
   cd /home/king/Desktop/edusitepro
   code .

2. Build Young Eagles website pages in EduSitePro

3. Create registration form that submits to EduDash Pro:
   POST https://edudashpro.org.za/api/register
   → Saves to child_registration_requests table

4. Configure domain routing:
   youngeagles.org.za → EduSitePro
   Registration data → EduDash Pro API

5. Admins access at:
   https://edudashpro.org.za/dashboard/principal
   (Login with Young Eagles admin credentials)

DATA FLOW:
  youngeagles.org.za/register (EduSitePro)
          ↓
  Submit form
          ↓
  POST /api/register (EduDash Pro API)
          ↓
  child_registration_requests table
          ↓
  Admin dashboard shows new registration

SUMMARY
