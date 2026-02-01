-- Backfill marketing_campaigns from promotional_campaigns so existing promo codes remain visible

DO $$
BEGIN
  IF to_regclass('public.promotional_campaigns') IS NULL THEN
    RAISE NOTICE 'Skipping promo backfill: promotional_campaigns not found';
    RETURN;
  END IF;

  INSERT INTO public.marketing_campaigns (
    organization_id,
    name,
    campaign_type,
    description,
    discount_type,
    discount_value,
    promo_code,
    max_redemptions,
    current_redemptions,
    start_date,
    end_date,
    active,
    featured,
    created_at,
    updated_at
  )
  SELECT
    COALESCE(p.organization_id, p.preschool_id) AS organization_id,
    pc.name,
    'seasonal_promo'::campaign_type AS campaign_type,
    pc.description,
    CASE pc.discount_type
      WHEN 'fixed_price' THEN 'fixed_amount'::discount_type
      ELSE pc.discount_type::discount_type
    END AS discount_type,
    pc.discount_value,
    pc.code,
    pc.max_uses,
    pc.current_uses,
    pc.start_date::timestamp without time zone,
    pc.end_date::timestamp without time zone,
    pc.is_active,
    false,
    COALESCE(pc.created_at, now()),
    COALESCE(pc.updated_at, now())
  FROM public.promotional_campaigns pc
  JOIN public.profiles p ON p.id = pc.created_by
  WHERE pc.code IS NOT NULL
    AND COALESCE(p.organization_id, p.preschool_id) IS NOT NULL
  ON CONFLICT (promo_code) DO NOTHING;
END $$;
