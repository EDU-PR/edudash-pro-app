-- Add Parent Subscription Plans
-- These plans are for individual parents (user-scoped, not school-scoped)

DO $sql$
DECLARE
  starter_count INTEGER;
  plus_count INTEGER;
BEGIN
  IF to_regclass('public.subscription_plans') IS NULL THEN
    RETURN;
  END IF;

  -- Insert Parent Starter plan
  INSERT INTO public.subscription_plans (
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
    99.00,
    950.00,
    0,
    1,
    0,
    '["Homework Helper (30/month)", "AI-powered explanations", "Child-safe responses", "Progress tracking", "Email support"]'::jsonb,
    TRUE,
    ARRAY['preschool', 'k12_school', 'hybrid'],
    5,
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
  INSERT INTO public.subscription_plans (
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
    199.00,
    1990.00,
    0,
    3,
    0,
    '["Homework Helper (100/month)", "Priority AI processing", "Multi-child support (3 children)", "Learning analytics", "Advanced insights", "Priority support"]'::jsonb,
    TRUE,
    ARRAY['preschool', 'k12_school', 'hybrid'],
    6,
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
  SELECT COUNT(*) INTO starter_count FROM public.subscription_plans WHERE tier = 'parent_starter' AND is_active = TRUE;
  SELECT COUNT(*) INTO plus_count FROM public.subscription_plans WHERE tier = 'parent_plus' AND is_active = TRUE;

  IF starter_count = 0 THEN
    RAISE EXCEPTION 'Parent Starter plan not created properly';
  END IF;

  IF plus_count = 0 THEN
    RAISE EXCEPTION 'Parent Plus plan not created properly';
  END IF;

  RAISE NOTICE 'Parent subscription plans created successfully: Starter (R99/mo base), Plus (R199/mo base)';
END $sql$;
