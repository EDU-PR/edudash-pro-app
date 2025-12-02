-- Update davecon12martin organization to SOA
-- Date: 2024-12-02

-- First, create SOA organization if it doesn't exist
INSERT INTO public.organizations (name, slug)
SELECT 'SOA', 'soa'
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations WHERE slug = 'soa'
);

-- Get the SOA organization_id
DO $$
DECLARE
  soa_org_id UUID;
BEGIN
  SELECT id INTO soa_org_id
  FROM public.organizations
  WHERE slug = 'soa';

  -- Update davecon12martin profile with SOA organization
  UPDATE public.profiles
  SET 
    organization_id = soa_org_id,
    updated_at = NOW()
  WHERE email = 'davecon12martin@outlook.com';

  RAISE NOTICE 'Updated davecon12martin@outlook.com organization to SOA (ID: %)', soa_org_id;
END $$;
