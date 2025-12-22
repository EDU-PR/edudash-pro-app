-- =====================================================
-- AFTERCARE REGISTRATION 50% DISCOUNT CAMPAIGN
-- Date: 2025-12-20
-- Purpose: 50% off on 2026 aftercare registration if paid before end of 2025
-- Original: R400.00 → Promo: R200.00
-- =====================================================

-- =====================================================
-- 1. Extend Promotional Campaigns for Registration Fees
-- =====================================================

-- Add a column to track if campaign applies to registration fees (one-time) vs subscriptions
-- Use DO block to safely add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'promotional_campaigns' 
    AND column_name = 'applies_to_registration'
  ) THEN
    ALTER TABLE promotional_campaigns
    ADD COLUMN applies_to_registration BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add a column to specify the product/service type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'promotional_campaigns' 
    AND column_name = 'product_type'
  ) THEN
    ALTER TABLE promotional_campaigns
    ADD COLUMN product_type TEXT DEFAULT 'subscription';
  END IF;
  
  -- Add check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
    AND table_name = 'promotional_campaigns'
    AND constraint_name = 'chk_product_type'
  ) THEN
    ALTER TABLE promotional_campaigns
    ADD CONSTRAINT chk_product_type 
    CHECK (product_type IN ('subscription', 'registration', 'fee', 'all'));
  END IF;
END $$;

COMMENT ON COLUMN promotional_campaigns.applies_to_registration IS 
  'If true, this campaign applies to one-time registration fees, not subscriptions';
COMMENT ON COLUMN promotional_campaigns.product_type IS 
  'Type of product this campaign applies to: subscription, registration, fee, or all';

-- =====================================================
-- 2. Create Aftercare Registration Campaign
-- =====================================================

INSERT INTO promotional_campaigns (
  code, 
  name, 
  description, 
  user_type, 
  tier_filter,
  discount_type, 
  discount_value,
  promo_duration_months, -- Not applicable for one-time fees, but required by schema
  start_date, 
  end_date,
  applies_to_registration,
  product_type,
  is_active
) VALUES (
  'AFTERCARE2026_50OFF',
  'Aftercare 2026 Early Registration',
  '50% off 2026 aftercare registration - Pay before December 31, 2025 and save R200!',
  'all', -- Applies to all user types (parents registering children for aftercare)
  NULL, -- No tier filter for registration fees
  'percentage',
  50.00,
  0, -- Not applicable for one-time registration
  '2025-12-20 00:00:00+00', -- Start immediately
  '2025-12-31 23:59:59+00', -- End of year deadline
  true, -- Applies to registration fees
  'registration', -- Product type: registration fee
  true
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  end_date = EXCLUDED.end_date,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- =====================================================
-- 3. Function: Get Promotional Registration Fee Price
-- =====================================================

CREATE OR REPLACE FUNCTION get_promotional_registration_fee(
  p_user_id UUID,
  p_original_fee DECIMAL,
  p_user_type TEXT DEFAULT 'parent'
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign RECORD;
  v_promo_price DECIMAL;
BEGIN
  -- Find active registration fee campaign
  SELECT * INTO v_campaign
  FROM promotional_campaigns
  WHERE is_active = true
    AND NOW() BETWEEN start_date AND end_date
    AND applies_to_registration = true
    AND product_type IN ('registration', 'all')
    AND user_type IN (p_user_type, 'all')
    AND (max_uses IS NULL OR current_uses < max_uses)
  ORDER BY discount_value DESC -- Best discount first
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN p_original_fee;
  END IF;
  
  -- Calculate promo price
  CASE v_campaign.discount_type
    WHEN 'percentage' THEN
      v_promo_price := p_original_fee * (1 - v_campaign.discount_value / 100);
    WHEN 'fixed_amount' THEN
      v_promo_price := p_original_fee - v_campaign.discount_value;
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

COMMENT ON FUNCTION get_promotional_registration_fee IS 
  'Get promotional price for registration fees. Returns original fee if no active campaign found.';

-- =====================================================
-- 4. Function: Record Promotional Registration Payment
-- =====================================================

CREATE OR REPLACE FUNCTION record_promotional_registration_payment(
  p_user_id UUID,
  p_registration_id UUID,
  p_original_fee DECIMAL,
  p_user_type TEXT DEFAULT 'parent'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign RECORD;
  v_promo_price DECIMAL;
  v_campaign_id UUID;
BEGIN
  -- Find active registration fee campaign
  SELECT * INTO v_campaign
  FROM promotional_campaigns
  WHERE is_active = true
    AND NOW() BETWEEN start_date AND end_date
    AND applies_to_registration = true
    AND product_type IN ('registration', 'all')
    AND user_type IN (p_user_type, 'all')
    AND (max_uses IS NULL OR current_uses < max_uses)
  ORDER BY discount_value DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active promotional campaign found for registration fees';
  END IF;
  
  v_campaign_id := v_campaign.id;
  
  -- Calculate promo price
  v_promo_price := get_promotional_registration_fee(p_user_id, p_original_fee, p_user_type);
  
  -- Update registration_requests with promo details
  UPDATE registration_requests
  SET 
    registration_fee_amount = v_promo_price,
    discount_amount = p_original_fee - v_promo_price,
    campaign_applied = v_campaign.code,
    updated_at = NOW()
  WHERE id = p_registration_id;
  
  -- Increment campaign usage counter
  UPDATE promotional_campaigns
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = v_campaign_id;
  
  RETURN v_campaign_id;
END;
$$;

COMMENT ON FUNCTION record_promotional_registration_payment IS 
  'Apply promotional discount to registration fee and record the campaign usage.';

-- =====================================================
-- 5. Index for Registration Campaign Queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_promotional_campaigns_registration 
  ON promotional_campaigns(applies_to_registration, product_type, is_active, start_date, end_date)
  WHERE applies_to_registration = true;

-- =====================================================
-- 6. Update Registration Fee Default
-- =====================================================

-- Note: The actual registration_fee_amount should be set in the application
-- when creating registration_requests. This migration just enables the promo system.
-- Default aftercare registration fee for 2026: R400.00

COMMENT ON COLUMN registration_requests.registration_fee_amount IS 
  'Registration fee amount. Default for 2026 aftercare: R400.00. Promotional price (R200.00) applied if paid before Dec 31, 2025.';
COMMENT ON COLUMN registration_requests.campaign_applied IS 
  'Promotional campaign code applied to this registration (e.g., AFTERCARE2026_50OFF)';
COMMENT ON COLUMN registration_requests.discount_amount IS 
  'Discount amount applied (original_fee - promo_fee). For AFTERCARE2026_50OFF: R200.00.';

