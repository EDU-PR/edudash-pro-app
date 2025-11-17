-- Add parent_plus tier to ai_usage_tiers table
-- This is the tier used by paid parent subscriptions

INSERT INTO ai_usage_tiers (
  tier_name,
  chat_messages_per_day,
  exams_per_month,
  explanations_per_month,
  monthly_price_zar,
  priority_queue,
  advanced_features,
  is_active
) VALUES (
  'parent_plus',
  1000,  -- 1000 chat messages per day (very generous)
  100,   -- 100 exams per month
  100,   -- 100 explanations per month
  99.50, -- R99.50 per month
  true,  -- Priority queue access
  true,  -- Advanced features enabled
  true
)
ON CONFLICT (tier_name) DO UPDATE
SET
  chat_messages_per_day = EXCLUDED.chat_messages_per_day,
  exams_per_month = EXCLUDED.exams_per_month,
  explanations_per_month = EXCLUDED.explanations_per_month,
  monthly_price_zar = EXCLUDED.monthly_price_zar,
  priority_queue = EXCLUDED.priority_queue,
  advanced_features = EXCLUDED.advanced_features,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify the tier was added
SELECT tier_name, chat_messages_per_day, exams_per_month, explanations_per_month, is_active
FROM ai_usage_tiers
WHERE tier_name = 'parent_plus';
