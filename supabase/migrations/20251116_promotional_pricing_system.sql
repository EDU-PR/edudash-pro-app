-- =====================================================
-- PROMOTIONAL PRICING SYSTEM
-- Date: 2025-11-16
-- Purpose: Track promotional campaigns and apply discounts
-- =====================================================

-- =====================================================
-- 1. Promotional Campaigns Table
-- =====================================================

CREATE TABLE IF NOT EXISTS promotional_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Campaign details
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'LAUNCH2025', 'TEACHER50'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Target audience
  user_type TEXT NOT NULL CHECK (user_type IN ('parent', 'teacher', 'principal', 'all')),
  tier_filter TEXT[], -- NULL = all tiers, or specific tiers ['basic', 'premium']
  
  -- Discount details
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed_price')),
  discount_value DECIMAL(10, 2) NOT NULL, -- 50 for 50%, or 50.00 for R50 off
  
  -- Duration
  promo_duration_months INTEGER NOT NULL DEFAULT 6, -- How long user keeps promo price
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL, -- Last day to JOIN promo
  
  -- Limits
  max_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- 2. User Promotional Subscriptions Tracker
-- =====================================================

CREATE TABLE IF NOT EXISTS user_promotional_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES promotional_campaigns(id) ON DELETE RESTRICT,
  tier TEXT NOT NULL, -- 'basic', 'premium', etc.
  
  -- Pricing
  original_price DECIMAL(10, 2) NOT NULL,
  promo_price DECIMAL(10, 2) NOT NULL,
  
  -- Duration tracking
  promo_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promo_end_date TIMESTAMPTZ NOT NULL, -- When promo pricing expires
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  reverted_to_full_price BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, tier) -- One promo per user per tier
);

-- =====================================================
-- 3. Insert Launch Promotional Campaigns
-- =====================================================

-- PARENT LAUNCH PROMO: 50% OFF FOR 6 MONTHS
-- Users who join before Dec 31, 2025 get 50% off for 6 months
INSERT INTO promotional_campaigns (
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
  is_active
) VALUES (
  'LAUNCH2025_PARENT',
  'Parent Launch Special',
  '50% off for 6 months - Join before December 31, 2025',
  'parent',
  ARRAY['parent_starter', 'parent_plus'],
  'percentage',
  50.00,
  6,
  '2025-11-16 00:00:00+00',
  '2025-12-31 23:59:59+00',
  true
) ON CONFLICT (code) DO UPDATE SET
  updated_at = NOW(),
  is_active = EXCLUDED.is_active,
  tier_filter = EXCLUDED.tier_filter;

-- TEACHER STANDALONE PROMO: 40% OFF FOR 6 MONTHS
-- Standalone teachers (not in organizations) get 40% off
-- Original: R149/month → Promo: R89.40/month
INSERT INTO promotional_campaigns (
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
  is_active
) VALUES (
  'LAUNCH2025_TEACHER',
  'Teacher Launch Special',
  '40% off for 6 months - Individual teacher accounts',
  'teacher',
  ARRAY['teacher_starter', 'teacher_pro'],
  'percentage',
  40.00,
  6,
  '2025-11-16 00:00:00+00',
  '2025-12-31 23:59:59+00',
  true
) ON CONFLICT (code) DO UPDATE SET
  updated_at = NOW(),
  is_active = EXCLUDED.is_active,
  tier_filter = EXCLUDED.tier_filter;

-- PRINCIPAL/SCHOOL PROMO: 3 MONTHS FREE + 25% OFF FOR 9 MONTHS
-- Schools get 3 months free trial, then 25% off for 9 months
-- Total: First year at 75% off average
INSERT INTO promotional_campaigns (
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
  is_active
) VALUES (
  'LAUNCH2025_SCHOOL',
  'School Launch Special',
  '3 months FREE trial + 25% off for 9 months',
  'principal',
  ARRAY['school_starter', 'school_premium', 'school_pro', 'school_enterprise'],
  'percentage',
  25.00,
  12, -- 3 free + 9 discounted = 12 months total
  '2025-11-16 00:00:00+00',
  '2025-12-31 23:59:59+00',
  true
) ON CONFLICT (code) DO UPDATE SET
  updated_at = NOW(),
  is_active = EXCLUDED.is_active,
  tier_filter = EXCLUDED.tier_filter;

-- =====================================================
-- 4. Function: Get Active Promotional Price
-- =====================================================

CREATE OR REPLACE FUNCTION get_promotional_price(
  p_user_id UUID,
  p_tier TEXT,
  p_user_type TEXT,
  p_original_price DECIMAL
) RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign RECORD;
  v_promo_price DECIMAL;
  v_existing_promo RECORD;
BEGIN
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

-- =====================================================
-- 5. Function: Record Promotional Subscription
-- =====================================================

CREATE OR REPLACE FUNCTION record_promotional_subscription(
  p_user_id UUID,
  p_tier TEXT,
  p_user_type TEXT,
  p_original_price DECIMAL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign RECORD;
  v_promo_price DECIMAL;
  v_promo_end_date TIMESTAMPTZ;
  v_record_id UUID;
BEGIN
  -- Find active campaign
  SELECT * INTO v_campaign
  FROM promotional_campaigns
  WHERE is_active = true
    AND NOW() BETWEEN start_date AND end_date
    AND user_type IN (p_user_type, 'all')
    AND (tier_filter IS NULL OR p_tier = ANY(tier_filter))
    AND (max_uses IS NULL OR current_uses < max_uses)
  ORDER BY discount_value DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active promotional campaign found';
  END IF;
  
  -- Calculate promo price
  v_promo_price := get_promotional_price(p_user_id, p_tier, p_user_type, p_original_price);
  
  -- Calculate promo end date
  v_promo_end_date := NOW() + (v_campaign.promo_duration_months || ' months')::INTERVAL;
  
  -- Record the promotional subscription
  INSERT INTO user_promotional_subscriptions (
    user_id,
    campaign_id,
    tier,
    original_price,
    promo_price,
    promo_start_date,
    promo_end_date
  ) VALUES (
    p_user_id,
    v_campaign.id,
    p_tier,
    p_original_price,
    v_promo_price,
    NOW(),
    v_promo_end_date
  )
  ON CONFLICT (user_id, tier) DO UPDATE SET
    campaign_id = EXCLUDED.campaign_id,
    original_price = EXCLUDED.original_price,
    promo_price = EXCLUDED.promo_price,
    promo_start_date = EXCLUDED.promo_start_date,
    promo_end_date = EXCLUDED.promo_end_date,
    is_active = true,
    updated_at = NOW()
  RETURNING id INTO v_record_id;
  
  -- Increment campaign usage counter
  UPDATE promotional_campaigns
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = v_campaign.id;
  
  RETURN v_record_id;
END;
$$;

-- =====================================================
-- 6. Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_promotional_campaigns_active 
  ON promotional_campaigns(is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_promotional_campaigns_user_type 
  ON promotional_campaigns(user_type);

CREATE INDEX IF NOT EXISTS idx_user_promo_subs_user_tier 
  ON user_promotional_subscriptions(user_id, tier);

CREATE INDEX IF NOT EXISTS idx_user_promo_subs_active 
  ON user_promotional_subscriptions(is_active, promo_end_date);

-- =====================================================
-- 7. RLS Policies
-- =====================================================

ALTER TABLE promotional_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_promotional_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can view active campaigns (for pricing display)
CREATE POLICY "Anyone can view active campaigns"
  ON promotional_campaigns FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND NOW() BETWEEN start_date AND end_date);

-- Users can view their own promotional subscriptions
CREATE POLICY "Users can view own promotional subscriptions"
  ON user_promotional_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage campaigns
CREATE POLICY "Admins can manage campaigns"
  ON promotional_campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'superadmin')
    )
  );

-- =====================================================
-- 8. Updated Pricing Information
-- =====================================================

COMMENT ON TABLE promotional_campaigns IS 'Tracks promotional pricing campaigns with start/end dates and discount rules';
COMMENT ON TABLE user_promotional_subscriptions IS 'Records which users have promotional pricing and when it expires';

COMMENT ON COLUMN promotional_campaigns.promo_duration_months IS 'How many months the user keeps the promotional price after signup';
COMMENT ON COLUMN promotional_campaigns.end_date IS 'Last date users can JOIN the promotion (not when promo ends for existing users)';

-- =====================================================
-- 9. Pricing Summary (for reference)
-- =====================================================

-- PARENTS:
-- Parent Starter: R99/month → R49.50/month for 6 months (50% off)
-- Parent Plus: R199/month → R99.50/month for 6 months (50% off)
-- Enrollment deadline: December 31, 2025
-- Promo expires per user: 6 months after signup (May 16, 2026 for signups on Nov 16)

-- TEACHERS (Standalone):
-- Teacher Starter: R149/month → R89.40/month for 6 months (40% off)
-- Teacher Pro: R299/month → R179.40/month for 6 months (40% off)
-- Enrollment deadline: December 31, 2025

-- SCHOOLS/PRINCIPALS:
-- All tiers: 3 months FREE + 25% off for 9 months
-- E.g., School Starter (R299/month): 3 months free, then R224.25/month for 9 months
-- Enrollment deadline: December 31, 2025

