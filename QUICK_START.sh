#!/bin/bash

# Quick Start: Young Eagles Registration System Setup
# Run this script to complete the implementation

echo "🦅 Young Eagles Registration System - Quick Start Setup"
echo "=========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}This script will:${NC}"
echo "  1. Verify database schema is deployed"
echo "  2. Insert Young Eagles as a tenant"
echo "  3. Create sample classes"
echo "  4. Test the setup"
echo ""
echo -e "${YELLOW}Prerequisites:${NC}"
echo "  ✓ Supabase database accessible (bppuzibjlxgfwrujzfsz)"
echo "  ✓ psql installed"
echo "  ✓ Database password ready"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Database connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.bppuzibjlxgfwrujzfsz"
DB_NAME="postgres"

echo ""
echo -e "${BLUE}Step 1: Checking if tables exist...${NC}"
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'organizations', 'preschools', 'classes', 'students', 
      'student_guardians', 'registration_requests', 'attendance', 
      'student_fees', 'communication_log'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'organizations', 'preschools', 'classes', 'students',
    'student_guardians', 'registration_requests', 'attendance',
    'student_fees', 'communication_log'
  )
ORDER BY table_name;
EOF

echo ""
echo -e "${BLUE}Step 2: Checking if Young Eagles tenant exists...${NC}"
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
SELECT 
  id,
  name,
  slug,
  school_code,
  academic_year,
  enrollment_open,
  CASE 
    WHEN id IS NOT NULL THEN '✅ Young Eagles EXISTS'
    ELSE '❌ Not found'
  END as status
FROM organizations
WHERE slug = 'young-eagles' OR school_code = 'YE-2026'
LIMIT 1;
EOF

echo ""
read -p "Do you want to insert/update Young Eagles tenant? (y/n): " confirm

if [ "$confirm" = "y" ]; then
  echo ""
  echo -e "${BLUE}Step 3: Inserting Young Eagles tenant...${NC}"
  echo ""
  
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
  
  -- Insert or update Young Eagles
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
    academic_year = EXCLUDED.academic_year,
    enrollment_open = EXCLUDED.enrollment_open,
    updated_at = NOW()
  RETURNING id, name, school_code, slug;
  
  -- Get org ID and create campus/classes
  DO $$
  DECLARE
    org_id UUID;
    campus_id UUID;
  BEGIN
    SELECT id INTO org_id FROM organizations WHERE slug = 'young-eagles';
    
    IF org_id IS NOT NULL THEN
      -- Insert main campus
      INSERT INTO preschools (
        organization_id,
        name,
        campus_code,
        address,
        capacity,
        active
      ) VALUES (
        org_id,
        'Young Eagles Main Campus',
        'YE-MC-01',
        '123 Education Street, Johannesburg, Gauteng, South Africa',
        200,
        TRUE
      ) ON CONFLICT (campus_code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        updated_at = NOW()
      RETURNING id INTO campus_id;
      
      -- Insert classes
      INSERT INTO classes (
        organization_id,
        preschool_id,
        name,
        grade_level,
        academic_year,
        max_students,
        active
      ) VALUES
        (org_id, campus_id, 'Grade R - Morning', 'Grade R', '2026', 25, TRUE),
        (org_id, campus_id, 'Grade R - Afternoon', 'Grade R', '2026', 25, TRUE),
        (org_id, campus_id, 'Reception Class', 'Reception', '2026', 25, TRUE),
        (org_id, campus_id, 'Pre-Primary A', 'Pre-Primary', '2026', 25, TRUE),
        (org_id, campus_id, 'Pre-Primary B', 'Pre-Primary', '2026', 25, TRUE)
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE '✅ Young Eagles setup complete!';
      RAISE NOTICE 'Organization ID: %', org_id;
      RAISE NOTICE 'Campus ID: %', campus_id;
    END IF;
  END $$;
  
EOF

  echo ""
  echo -e "${GREEN}✅ Young Eagles tenant created successfully!${NC}"
fi

echo ""
echo -e "${BLUE}Step 4: Verifying setup...${NC}"
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
SELECT 
  o.name as organization,
  o.school_code,
  COUNT(DISTINCT p.id) as campuses,
  COUNT(DISTINCT c.id) as classes,
  COUNT(DISTINCT s.id) as students,
  COUNT(DISTINCT r.id) as pending_registrations
FROM organizations o
LEFT JOIN preschools p ON p.organization_id = o.id
LEFT JOIN classes c ON c.organization_id = o.id
LEFT JOIN students s ON s.organization_id = o.id
LEFT JOIN registration_requests r ON r.organization_id = o.id AND r.status = 'pending'
WHERE o.slug = 'young-eagles'
GROUP BY o.id, o.name, o.school_code;
EOF

echo ""
echo -e "${GREEN}=========================================================="
echo "🎉 Setup Complete!"
echo "==========================================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Add PublicRegistrationForm to your website:"
echo "   File: src/components/registration/PublicRegistrationForm.tsx"
echo ""
echo "2. Add RegistrationDashboard to principal portal:"
echo "   File: src/components/registration/RegistrationDashboard.tsx"
echo ""
echo "3. Set up email notifications (SendGrid/Resend)"
echo ""
echo "4. Test the registration flow:"
echo "   - Visit registration page"
echo "   - Submit a test application"
echo "   - Log in as principal and approve it"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "  - REGISTRATION_IMPLEMENTATION_SUMMARY.md"
echo "  - WEBSITE_BUILDER_REGISTRATION_INTEGRATION.md"
echo "  - STUDENT_REGISTRATION_2026_PLAN.md"
echo ""
echo -e "${GREEN}🚀 Ready to launch!${NC}"
echo ""
