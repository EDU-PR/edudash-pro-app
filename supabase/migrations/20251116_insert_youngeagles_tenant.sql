-- =====================================================
-- INSERT YOUNG EAGLES AS FIRST TENANT
-- =====================================================

-- Insert Young Eagles organization with all required fields
INSERT INTO organizations (
  name,
  slug,
  type,
  tier,
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
  'solo',
  1,
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
  max_students = EXCLUDED.max_students,
  school_type = EXCLUDED.school_type,
  address = EXCLUDED.address,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone
RETURNING id, name, school_code, slug;

-- Get the organization ID for further setup
DO $$
DECLARE
  org_id UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE slug = 'young-eagles';
  
  -- Insert main campus/preschool
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
  ) ON CONFLICT (campus_code) DO NOTHING;
  
  -- Create sample classes for 2026
  INSERT INTO classes (
    organization_id,
    preschool_id,
    name,
    grade_level,
    academic_year,
    max_students,
    active
  ) 
  SELECT 
    org_id,
    p.id,
    unnest(ARRAY['Grade R - Morning', 'Grade R - Afternoon', 'Reception Class', 'Pre-Primary A', 'Pre-Primary B']),
    unnest(ARRAY['Grade R', 'Grade R', 'Reception', 'Pre-Primary', 'Pre-Primary']),
    '2026',
    25,
    TRUE
  FROM preschools p
  WHERE p.organization_id = org_id AND p.campus_code = 'YE-MC-01'
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Young Eagles organization setup complete!';
  RAISE NOTICE 'Organization ID: %', org_id;
END $$;

-- Verify the setup
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.school_code,
  o.slug,
  COUNT(DISTINCT p.id) as campuses,
  COUNT(DISTINCT c.id) as classes
FROM organizations o
LEFT JOIN preschools p ON p.organization_id = o.id
LEFT JOIN classes c ON c.organization_id = o.id
WHERE o.slug = 'young-eagles'
GROUP BY o.id, o.name, o.school_code, o.slug;
