-- Create EduDash Pro Community School (simple version)
-- This serves as a catch-all for children whose schools aren't registered

DO $$
DECLARE
  school_exists BOOLEAN;
  community_id UUID;
BEGIN
  -- Check if community school already exists
  SELECT EXISTS (
    SELECT 1 FROM preschools 
    WHERE name ILIKE '%EduDash Pro Community%' OR name ILIKE '%Community School%'
  ) INTO school_exists;

  IF NOT school_exists THEN
    -- Insert the default community school
    INSERT INTO preschools (
      name,
      slug,
      address,
      phone,
      email,
      is_active
    ) VALUES (
      'EduDash Pro Community School',
      'edudash-community',
      'Virtual Campus - Serving students across South Africa',
      '+27 00 000 0000',
      'community@edudashpro.org.za',
      true
    ) RETURNING id INTO community_id;
    
    RAISE NOTICE 'Created EduDash Pro Community School with ID: %', community_id;
  ELSE
    RAISE NOTICE 'EduDash Pro Community School already exists';
  END IF;
END $$;

-- Verify creation
SELECT 
  id,
  name,
  slug,
  is_active
FROM preschools 
WHERE name ILIKE '%community%'
ORDER BY name;
