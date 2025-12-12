-- Fix Parent Plan Pricing
-- Promotional pricing: 50% off for 6 months (MONTHLY ONLY)
-- Annual subscriptions use full price with standard 20% annual discount (no promo)

-- Parent Plus: Monthly promo = R99.50, Annual = full price R1910.40/year
UPDATE subscription_plans
SET 
  price_monthly = 9950,  -- R99.50 in cents (50% off R199.00 - promo for 6 months only)
  price_annual = 191040, -- R1910.40 in cents (R199 * 12 * 0.8 = full price with 20% annual discount)
  updated_at = NOW()
WHERE tier IN ('parent_plus', 'parent-plus');

-- Parent Starter: Monthly promo = R49.50, Annual = full price R950.40/year
UPDATE subscription_plans
SET 
  price_monthly = 4950,  -- R49.50 in cents (50% off R99.00 - promo for 6 months only)
  price_annual = 95040,  -- R950.40 in cents (R99 * 12 * 0.8 = full price with 20% annual discount)
  updated_at = NOW()
WHERE tier IN ('parent_starter', 'parent-starter');

-- Verify the update
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
  
  IF v_count = 0 THEN
    RAISE NOTICE 'WARNING: No parent_plus plans found to update';
  ELSE
    RAISE NOTICE 'Updated % parent_plus plan(s)', v_count;
    RAISE NOTICE 'Monthly (promo): % cents (R%.2f)', v_monthly, v_monthly / 100.0;
    RAISE NOTICE 'Annual (full price): % cents (R%.2f)', v_annual, v_annual / 100.0;
    
    IF v_monthly != 9950 OR v_annual != 191040 THEN
      RAISE WARNING 'Parent Plus prices may not have updated correctly. Expected: 9950/191040, Got: %/%', v_monthly, v_annual;
    ELSE
      RAISE NOTICE '✅ Parent Plus prices updated successfully (monthly promo, annual full price)';
    END IF;
  END IF;
  
  -- Check Parent Starter
  SELECT COUNT(*), MAX(price_monthly), MAX(price_annual)
  INTO v_count, v_monthly, v_annual
  FROM subscription_plans
  WHERE tier IN ('parent_starter', 'parent-starter');
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Updated % parent_starter plan(s)', v_count;
    RAISE NOTICE 'Monthly (promo): % cents (R%.2f)', v_monthly, v_monthly / 100.0;
    RAISE NOTICE 'Annual (full price): % cents (R%.2f)', v_annual, v_annual / 100.0;
    
    IF v_monthly != 4950 OR v_annual != 95040 THEN
      RAISE WARNING 'Parent Starter prices may not have updated correctly. Expected: 4950/95040, Got: %/%', v_monthly, v_annual;
    ELSE
      RAISE NOTICE '✅ Parent Starter prices updated successfully (monthly promo, annual full price)';
    END IF;
  END IF;
END $$;

