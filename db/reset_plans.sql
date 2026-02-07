-- Reset plans safely: archive existing and insert new ordered tiers
-- Strategy: mark old plans inactive instead of delete; then insert new set
--
-- Tier names MUST match the canonical TierNameAligned type in lib/tiers/index.ts:
--   free, parent_starter, parent_plus, school_starter, school_premium,
--   school_pro, school_enterprise

-- 1) Deactivate all current plans
UPDATE public.subscription_plans SET is_active = FALSE, updated_at = now();

-- 2) Insert new canonical plan set (id auto-generated)
INSERT INTO public.subscription_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, is_active)
VALUES
('Free',              'free',              0,    0,     2,   50,   TRUE),
('Parent Starter',    'parent_starter',    99,   950,   0,   0,    TRUE),
('Parent Plus',       'parent_plus',       199,  1910,  0,   0,    TRUE),
('School Starter',    'school_starter',    299,  2990,  5,   150,  TRUE),
('School Premium',    'school_premium',    599,  5990,  15,  500,  TRUE),
('School Pro',        'school_pro',        999,  9990,  30,  1000, TRUE),
('School Enterprise', 'school_enterprise', 1999, 19990, 100, 2000, TRUE);

-- 3) Verify visibility via RPC (manual check)
-- select * from public.public_list_plans();
