-- Check current pricing in database
SELECT tier, monthly_price_zar FROM ai_usage_tiers WHERE is_active = true ORDER BY monthly_price_zar;

-- Check parent subscription plans if they exist
SELECT name, tier, price_monthly, price_annual FROM subscription_plans WHERE is_active = true ORDER BY price_monthly;
