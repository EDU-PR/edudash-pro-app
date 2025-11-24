-- =====================================================
-- MARKETING CAMPAIGNS FOR EDUDASHPRO
-- Multi-tenant promotional campaigns for preschools
-- =====================================================

-- 1. ENUM TYPES
-- =====================================================

CREATE TYPE campaign_type AS ENUM (
  'early_bird',
  'sibling_discount',
  'referral_bonus',
  'seasonal_promo',
  'bundle_offer',
  'scholarship'
);

CREATE TYPE discount_type AS ENUM (
  'percentage',
  'fixed_amount',
  'waive_registration',
  'first_month_free'
);

-- 2. MARKETING CAMPAIGNS TABLE
-- =====================================================

CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- Campaign Details
  name VARCHAR(200) NOT NULL,
  campaign_type campaign_type NOT NULL,
  description TEXT,
  terms_conditions TEXT,
  
  -- Targeting
  target_audience TEXT[], -- e.g., ['new_students', 'returning_students', 'siblings']
  target_classes TEXT[], -- Specific grade levels
  
  -- Discount Configuration
  discount_type discount_type NOT NULL,
  discount_value DECIMAL(10,2), -- percentage (e.g., 20 for 20%) or fixed amount
  max_discount_amount DECIMAL(10,2), -- Cap for percentage discounts
  
  -- Redemption Rules
  promo_code VARCHAR(50) UNIQUE,
  max_redemptions INTEGER, -- NULL = unlimited
  current_redemptions INTEGER DEFAULT 0,
  min_purchase_amount DECIMAL(10,2),
  
  -- Validity Period
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  
  -- Auto-apply rules
  auto_apply BOOLEAN DEFAULT false, -- Apply automatically if conditions met
  auto_apply_conditions JSONB, -- e.g., {"registered_before": "2026-01-31"}
  
  -- Status
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false, -- Show on marketing landing page
  
  -- Analytics
  views_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. INDEXES
-- =====================================================

CREATE INDEX idx_campaigns_org ON marketing_campaigns(organization_id) WHERE active = true;
CREATE INDEX idx_campaigns_promo_code ON marketing_campaigns(promo_code) WHERE promo_code IS NOT NULL;
CREATE INDEX idx_campaigns_dates ON marketing_campaigns(start_date, end_date) WHERE active = true;

-- 4. CAMPAIGN REDEMPTIONS TRACKING
-- =====================================================

CREATE TABLE campaign_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  registration_request_id UUID REFERENCES registration_requests(id) ON DELETE CASCADE,
  
  -- Redemption Details
  redeemed_by_email VARCHAR(255) NOT NULL,
  discount_applied DECIMAL(10,2) NOT NULL,
  original_amount DECIMAL(10,2) NOT NULL,
  final_amount DECIMAL(10,2) NOT NULL,
  
  -- Verification
  promo_code_used VARCHAR(50),
  auto_applied BOOLEAN DEFAULT false,
  
  redeemed_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(campaign_id, registration_request_id)
);

-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_redemptions ENABLE ROW LEVEL SECURITY;

-- Public can view active campaigns
CREATE POLICY "Anyone can view active campaigns"
ON marketing_campaigns FOR SELECT
USING (active = true AND start_date <= NOW() AND end_date >= NOW());

-- Principals manage campaigns for their preschool
CREATE POLICY "Principals manage own campaigns"
ON marketing_campaigns FOR ALL
USING (
  organization_id IN (
    SELECT preschool_id FROM profiles WHERE user_id = auth.uid() AND role = 'principal'
  )
);

-- Teachers can view campaigns for their preschool
CREATE POLICY "Teachers view preschool campaigns"
ON marketing_campaigns FOR SELECT
USING (
  organization_id IN (
    SELECT preschool_id FROM profiles WHERE user_id = auth.uid() AND role IN ('teacher', 'principal')
  )
);

-- Track campaign redemptions
CREATE POLICY "Users view own redemptions"
ON campaign_redemptions FOR SELECT
USING (
  redeemed_by_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Principals manage redemptions"
ON campaign_redemptions FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM marketing_campaigns WHERE organization_id IN (
      SELECT preschool_id FROM profiles WHERE user_id = auth.uid() AND role = 'principal'
    )
  )
);

-- 6. SAMPLE CAMPAIGN FOR YOUNG EAGLES
-- =====================================================

INSERT INTO marketing_campaigns (
  organization_id,
  name,
  campaign_type,
  description,
  terms_conditions,
  discount_type,
  discount_value,
  promo_code,
  max_redemptions,
  start_date,
  end_date,
  auto_apply,
  active,
  featured
)
SELECT 
  id,
  'Early Bird Registration 2026',
  'early_bird',
  'Register before January 31st, 2026 and save 20% on your registration fee!',
  'Offer valid for new students only. Registration must be completed by January 31, 2026. Cannot be combined with other offers.',
  'percentage',
  20.00,
  'EARLYBIRD2026',
  100, -- First 100 registrations
  '2025-11-16 00:00:00',
  '2026-01-31 23:59:59',
  true,
  true,
  true
FROM preschools WHERE name = 'Young Eagles'
ON CONFLICT DO NOTHING;

-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE marketing_campaigns IS 'Promotional campaigns and discount offers for preschools';
COMMENT ON TABLE campaign_redemptions IS 'Tracking campaign usage and redemptions';
