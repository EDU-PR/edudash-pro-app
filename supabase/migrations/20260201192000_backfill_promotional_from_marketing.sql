-- Backfill promotional_campaigns from marketing_campaigns so existing promo codes work in registration flows

INSERT INTO public.promotional_campaigns (
  code,
  name,
  description,
  user_type,
  tier_filter,
  discount_type,
  discount_value,
  promo_duration_months,
  start_date,
  end_date,
  max_uses,
  current_uses,
  is_active,
  created_by,
  applies_to_registration,
  product_type,
  created_at,
  updated_at
)
SELECT
  UPPER(mc.promo_code) AS code,
  mc.name,
  mc.description,
  'parent' AS user_type,
  NULL::text[] AS tier_filter,
  CASE mc.discount_type::text
    WHEN 'percentage' THEN 'percentage'
    WHEN 'fixed_amount' THEN 'fixed_amount'
    WHEN 'waive_registration' THEN 'fixed_price'
    WHEN 'first_month_free' THEN 'fixed_price'
    ELSE 'fixed_amount'
  END AS discount_type,
  CASE mc.discount_type::text
    WHEN 'waive_registration' THEN 0
    WHEN 'first_month_free' THEN 0
    ELSE COALESCE(mc.discount_value, 0)
  END AS discount_value,
  1 AS promo_duration_months,
  mc.start_date::timestamptz AS start_date,
  mc.end_date::timestamptz AS end_date,
  mc.max_redemptions AS max_uses,
  COALESCE(mc.current_redemptions, 0) AS current_uses,
  COALESCE(mc.active, true) AS is_active,
  NULL::uuid AS created_by,
  true AS applies_to_registration,
  'registration' AS product_type,
  now() AS created_at,
  now() AS updated_at
FROM public.marketing_campaigns mc
WHERE mc.promo_code IS NOT NULL
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  max_uses = EXCLUDED.max_uses,
  current_uses = EXCLUDED.current_uses,
  is_active = EXCLUDED.is_active,
  applies_to_registration = true,
  product_type = 'registration',
  updated_at = now();
