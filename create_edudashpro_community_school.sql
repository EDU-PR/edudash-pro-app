-- Create EduDash Pro Community as default school for K-12 students
-- This serves as a catch-all for children whose schools aren't registered on the platform

-- First, we need to ensure there's a default organization for community schools
DO $$
DECLARE
  default_org_id UUID;
  school_exists BOOLEAN;
BEGIN
  -- Check if default organization exists
  SELECT id INTO default_org_id
  FROM organizations
  WHERE name = 'EduDash Pro Community'
  LIMIT 1;
  
  -- Create default organization if it doesn't exist
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (
      name,
      type,
      plan_tier,
      is_active
    ) VALUES (
      'EduDash Pro Community',
      'independent',
      'free',
      true
    ) RETURNING id INTO default_org_id;
    
    RAISE NOTICE 'Created EduDash Pro Community organization: %', default_org_id;
  END IF;
  
  -- Check if community school exists
  SELECT EXISTS (
    SELECT 1 FROM preschools 
    WHERE name = 'EduDash Pro Community'
  ) INTO school_exists;

  IF NOT school_exists THEN
    -- Insert the default community school
    INSERT INTO preschools (
      organization_id,
      name,
      campus_code,
      address,
      capacity,
      active
    ) VALUES (
      default_org_id,
      'EduDash Pro Community',
      'EDUDASH-COMMUNITY',
      'Virtual Campus - Serving K-12 students across South Africa',
      999999,
      true
    );
    
    RAISE NOTICE 'Created EduDash Pro Community school';
  ELSE
    RAISE NOTICE 'EduDash Pro Community school already exists';
  END IF;
END $$;

-- Verify creation
SELECT 
  p.id,
  p.name,
  p.campus_code,
  p.active,
  o.name as organization_name,
  o.plan_tier
FROM preschools p
JOIN organizations o ON p.organization_id = o.id
WHERE p.name = 'EduDash Pro Community';
