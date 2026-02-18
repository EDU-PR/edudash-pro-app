BEGIN;

-- Ensure EduDash Pro Community School is classified as non-preschool for K-12/combined routing.
UPDATE public.preschools
SET
  school_type = 'combined',
  subscription_tier = 'school_enterprise',
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001'
   OR LOWER(name) = 'edudash pro community school';

-- Keep organizations table aligned for the same school entity.
UPDATE public.organizations
SET
  organization_type = 'k12',
  type = 'k12_school',
  subscription_tier = 'school_enterprise',
  plan_tier = 'school_enterprise',
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001'
   OR LOWER(name) = 'edudash pro community school';

-- Defensive alignment in case the school exists in the schools table.
UPDATE public.schools
SET
  subscription_tier = 'school_enterprise',
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001'
   OR LOWER(name) = 'edudash pro community school';

COMMIT;
