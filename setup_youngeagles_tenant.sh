#!/bin/bash

# Interactive script to set up Young Eagles tenant
# Run with: bash setup_youngeagles_tenant.sh

echo "🦅 Young Eagles Tenant Setup for EduSitePro"
echo "=============================================="
echo ""
echo "This script will:"
echo "1. Check existing organizations table structure"
echo "2. Insert Young Eagles as a new tenant"
echo "3. Create initial campus and classes"
echo ""
echo "Press Enter to continue..."
read

# Database connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.bppuzibjlxgfwrujzfsz"
DB_NAME="postgres"

echo ""
echo "📊 Step 1: Checking organizations table structure..."
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
\d organizations
EOF

echo ""
echo "📝 Step 2: Checking current organizations..."
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
SELECT id, name, slug, school_code FROM organizations;
EOF

echo ""
echo "✨ Step 3: Inserting Young Eagles tenant..."
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Insert Young Eagles (adjust columns based on actual schema)
INSERT INTO organizations (
  name,
  slug,
  school_code,
  academic_year,
  enrollment_open,
  max_students,
  school_type,
  address,
  contact_email,
  contact_phone,
  country,
  status
) VALUES (
  'Young Eagles Education',
  'young-eagles',
  'YE-2026',
  '2026',
  TRUE,
  500,
  'Preschool & Early Learning',
  '123 Education Street, Johannesburg, Gauteng, South Africa',
  'admin@youngeagles.org.za',
  '+27 11 123 4567',
  'ZA',
  'active'
) ON CONFLICT (slug) DO UPDATE SET
  school_code = EXCLUDED.school_code,
  updated_at = NOW()
RETURNING id, name, school_code, slug;
EOF

echo ""
echo "✅ Setup complete! Young Eagles is now a tenant in EduSitePro."
echo ""
