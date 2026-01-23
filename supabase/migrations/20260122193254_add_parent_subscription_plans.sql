-- Add Parent Subscription Plans
-- These plans are for individual parents (user-scoped, not school-scoped)
-- 
-- PRICING STRUCTURE (with 50% launch promo until Dec 31, 2025):
-- - Parent Starter: R99/month → R49.50 (promo) | R950/year → R475 (promo)
-- - Parent Plus: R199/month → R99.50 (promo) | R1990/year → R995 (promo)
--
-- NOTE: The promo is applied in the payments-create-checkout Edge Function,
-- NOT stored in the database. Database stores BASE prices.

-- Insert Parent Starter plan
INSERT INTO subscription_plans (
  id,
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  max_schools,
  features,
  is_active,
  school_types,
  sort_order,
  description,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Parent Starter',
  'parent_starter',
  99.00,       -- Base price R99/month (50% promo applied at checkout = R49.50)
  950.00,      -- Base annual price R950 (50% promo = R475)
  0,           -- No teachers (individual plan)
  1,           -- 1 child
  0,           -- No schools
  '["Homework Helper (30/month)", "AI-powered explanations", "Child-safe responses", "Progress tracking", "Email support"]'::jsonb,
  TRUE,
  ARRAY['preschool', 'k12_school', 'hybrid'],
  5,           -- After free (1), starter (2), premium (3), enterprise (4)
  'AI-powered homework help for parents',
  now(),
  now()
)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_teachers = EXCLUDED.max_teachers,
  max_students = EXCLUDED.max_students,
  max_schools = EXCLUDED.max_schools,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  school_types = EXCLUDED.school_types,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  updated_at = now();

-- Insert Parent Plus plan
INSERT INTO subscription_plans (
  id,
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  max_schools,
  features,
  is_active,
  school_types,
  sort_order,
  description,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Parent Plus',
  'parent_plus',
  199.00,      -- Base price R199/month (50% promo applied at checkout = R99.50)
  1990.00,     -- Base annual price R1990 (50% promo = R995)
  0,           -- No teachers (individual plan)
  3,           -- Up to 3 children
  0,           -- No schools
  '["Homework Helper (100/month)", "Priority AI processing", "Multi-child support (3 children)", "Learning analytics", "Advanced insights", "Priority support"]'::jsonb,
  TRUE,
  ARRAY['preschool', 'k12_school', 'hybrid'],
  6,           -- After parent_starter
  'Premium AI homework help for larger families',
  now(),
  now()
)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_teachers = EXCLUDED.max_teachers,
  max_students = EXCLUDED.max_students,
  max_schools = EXCLUDED.max_schools,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  school_types = EXCLUDED.school_types,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  updated_at = now();

-- Verify the plans
DO $$
DECLARE
  starter_count INTEGER;
  plus_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO starter_count FROM subscription_plans WHERE tier = 'parent_starter' AND is_active = TRUE;
  SELECT COUNT(*) INTO plus_count FROM subscription_plans WHERE tier = 'parent_plus' AND is_active = TRUE;
  
  IF starter_count = 0 THEN
    RAISE EXCEPTION 'Parent Starter plan not created properly';
  END IF;
  
  IF plus_count = 0 THEN
    RAISE EXCEPTION 'Parent Plus plan not created properly';
  END IF;
  
  RAISE NOTICE 'Parent subscription plans created successfully: Starter (R99/mo base), Plus (R199/mo base)';
END $$;
