-- Restore Base Prices and Use Promotional Function
-- 
-- Problem: Previous migration stored promo prices directly in subscription_plans.
-- When promo ends (Dec 31, 2025), prices would stay discounted.
--
-- Solution: Store BASE prices in subscription_plans, use get_promotional_price()
-- function at checkout time to apply time-limited discounts dynamically.
--
-- Base Prices (in cents):
-- - Parent Starter: R99.00/month (9900 cents), R950.40/year (95040 cents)
-- - Parent Plus: R199.00/month (19900 cents), R1910.40/year (191040 cents)

-- =====================================================
-- 1. Restore Base Prices in subscription_plans
-- =====================================================

-- Parent Plus: Base monthly = R199.00, Annual = R1910.40 (20% annual discount)
UPDATE subscription_plans
SET 
  price_monthly = 19900,  -- R199.00 in cents (BASE price)
  price_annual = 191040,  -- R1910.40 in cents (R199 * 12 * 0.8 = base with 20% annual discount)
  updated_at = NOW()
WHERE tier IN ('parent_plus', 'parent-plus');

-- Parent Starter: Base monthly = R99.00, Annual = R950.40 (20% annual discount)
UPDATE subscription_plans
SET 
  price_monthly = 9900,   -- R99.00 in cents (BASE price)
  price_annual = 95040,   -- R950.40 in cents (R99 * 12 * 0.8 = base with 20% annual discount)
  updated_at = NOW()
WHERE tier IN ('parent_starter', 'parent-starter');

-- =====================================================
-- 2. Ensure Launch Promo Campaign Exists
-- =====================================================

-- Insert/update the launch promo campaign (50% off for first 6 months)
INSERT INTO promotional_campaigns (
  id,
  name,
  description,
  discount_type,
  discount_value,
  start_date,
  end_date,
  user_type,
  tier_filter,
  promo_duration_months,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'launch-promo-2025'::UUID,
  'Launch Special - 50% Off',
  '50% off monthly subscription for the first 6 months. Sign up before Dec 31, 2025.',
  'percentage',
  50,
  '2025-01-01 00:00:00+00',
  '2025-12-31 23:59:59+00',
  'parent',
  ARRAY['parent_starter', 'parent_plus'],
  6,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  discount_value = 50,
  end_date = '2025-12-31 23:59:59+00',
  promo_duration_months = 6,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- 3. Update get_promotional_price to handle billing frequency
-- =====================================================

CREATE OR REPLACE FUNCTION get_promotional_price(
  p_user_id UUID,
  p_tier TEXT,
  p_user_type TEXT,
  p_original_price DECIMAL,
  p_billing_frequency TEXT DEFAULT 'monthly'
) RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign RECORD;
  v_promo_price DECIMAL;
  v_existing_promo RECORD;
BEGIN
  -- Annual billing does NOT get promotional discount (already has 20% annual discount)
  IF p_billing_frequency = 'annual' THEN
    RETURN p_original_price;
  END IF;

  -- Check if user already has an active promo for this tier
  SELECT * INTO v_existing_promo
  FROM user_promotional_subscriptions
  WHERE user_id = p_user_id
    AND tier = p_tier
    AND is_active = true
    AND promo_end_date > NOW();
  
  IF FOUND THEN
    RETURN v_existing_promo.promo_price;
  END IF;
  
  -- Find active campaign
  SELECT * INTO v_campaign
  FROM promotional_campaigns
  WHERE is_active = true
    AND NOW() BETWEEN start_date AND end_date
    AND user_type IN (p_user_type, 'all')
    AND (tier_filter IS NULL OR p_tier = ANY(tier_filter))
    AND (max_uses IS NULL OR current_uses < max_uses)
  ORDER BY discount_value DESC -- Best discount first
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN p_original_price;
  END IF;
  
  -- Calculate promo price
  CASE v_campaign.discount_type
    WHEN 'percentage' THEN
      v_promo_price := p_original_price * (1 - v_campaign.discount_value / 100);
    WHEN 'fixed_amount' THEN
      v_promo_price := p_original_price - v_campaign.discount_value;
    WHEN 'fixed_price' THEN
      v_promo_price := v_campaign.discount_value;
  END CASE;
  
  -- Ensure price doesn't go below 0
  v_promo_price := GREATEST(v_promo_price, 0);
  
  -- Round to 2 decimal places
  v_promo_price := ROUND(v_promo_price, 2);
  
  RETURN v_promo_price;
END;
$$;

COMMENT ON FUNCTION get_promotional_price(UUID, TEXT, TEXT, DECIMAL, TEXT) IS 
  'Get promotional price for a subscription tier. Applies active campaign discounts for monthly billing only. Annual billing returns original price (already has 20% annual discount).';

-- =====================================================
-- 4. Create helper function to get display price for UI
-- =====================================================

CREATE OR REPLACE FUNCTION get_plan_display_price(
  p_tier TEXT,
  p_billing_frequency TEXT DEFAULT 'monthly',
  p_user_id UUID DEFAULT NULL,
  p_user_type TEXT DEFAULT 'parent'
) RETURNS TABLE (
  base_price DECIMAL,
  promo_price DECIMAL,
  has_promo BOOLEAN,
  promo_end_date TIMESTAMPTZ,
  discount_percent INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_price DECIMAL;
  v_promo_price DECIMAL;
  v_campaign RECORD;
BEGIN
  -- Get base price from subscription_plans
  SELECT 
    CASE WHEN p_billing_frequency = 'annual' 
      THEN sp.price_annual / 100.0 
      ELSE sp.price_monthly / 100.0 
    END
  INTO v_base_price
  FROM subscription_plans sp
  WHERE sp.tier = p_tier
    AND sp.is_active = true
  LIMIT 1;
  
  IF v_base_price IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, false, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;
  
  -- Get promo price (only for monthly)
  IF p_billing_frequency = 'monthly' AND p_user_id IS NOT NULL THEN
    v_promo_price := get_promotional_price(p_user_id, p_tier, p_user_type, v_base_price, p_billing_frequency);
  ELSE
    v_promo_price := v_base_price;
  END IF;
  
  -- Get campaign end date
  SELECT pc.end_date INTO v_campaign
  FROM promotional_campaigns pc
  WHERE pc.is_active = true
    AND NOW() BETWEEN pc.start_date AND pc.end_date
    AND pc.user_type IN (p_user_type, 'all')
    AND (pc.tier_filter IS NULL OR p_tier = ANY(pc.tier_filter))
  LIMIT 1;
  
  RETURN QUERY SELECT 
    v_base_price,
    v_promo_price,
    v_promo_price < v_base_price,
    v_campaign.end_date,
    CASE WHEN v_promo_price < v_base_price 
      THEN ROUND(((v_base_price - v_promo_price) / v_base_price) * 100)::INTEGER
      ELSE 0 
    END;
END;
$$;

COMMENT ON FUNCTION get_plan_display_price(TEXT, TEXT, UUID, TEXT) IS 
  'Get display prices for subscription plans. Returns base price, promotional price (if applicable), and discount info.';

-- =====================================================
-- 5. Verify the update
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
  v_monthly INTEGER;
  v_annual INTEGER;
BEGIN
  -- Check Parent Plus
  SELECT COUNT(*), MAX(price_monthly), MAX(price_annual)
  INTO v_count, v_monthly, v_annual
  FROM subscription_plans
  WHERE tier IN ('parent_plus', 'parent-plus');
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Parent Plus: Base monthly = R%.2f, Annual = R%.2f', v_monthly / 100.0, v_annual / 100.0;
    IF v_monthly = 19900 AND v_annual = 191040 THEN
      RAISE NOTICE '   ✓ Prices correctly restored to BASE values';
    END IF;
  END IF;
  
  -- Check Parent Starter
  SELECT COUNT(*), MAX(price_monthly), MAX(price_annual)
  INTO v_count, v_monthly, v_annual
  FROM subscription_plans
  WHERE tier IN ('parent_starter', 'parent-starter');
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Parent Starter: Base monthly = R%.2f, Annual = R%.2f', v_monthly / 100.0, v_annual / 100.0;
    IF v_monthly = 9900 AND v_annual = 95040 THEN
      RAISE NOTICE '   ✓ Prices correctly restored to BASE values';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  Promotional discounts (50%% off) are now applied dynamically via get_promotional_price()';
  RAISE NOTICE 'ℹ️  When promo ends (Dec 31, 2025), new subscribers will pay BASE prices automatically';
END $$;
