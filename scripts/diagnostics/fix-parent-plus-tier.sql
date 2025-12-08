-- Fix: Align product tier and capability tier for a single user
-- How to use:
--   1) Replace EMAIL_HERE with the target user's email
--   2) Run in Supabase SQL Editor
-- Safety:
--   - Updates exactly one user (by email match); review with check-tier-status.sql first
--   - No structural changes, only data updates

\set user_email 'EMAIL_HERE'

WITH target AS (
  SELECT id AS user_id
  FROM profiles
  WHERE email = :user_email
  LIMIT 1
)
-- Product/billing tier for display and billing linkage (hyphen style)
UPDATE user_ai_tiers uat
SET tier = 'parent-plus'
FROM target t
WHERE uat.user_id = t.user_id;

-- Capability tier used by the ai-proxy quota checker (underscore style)
-- Note: The proxy normalizes hyphen/underscore; either will work now.
UPDATE user_ai_usage uau
SET current_tier = 'parent_plus',
    updated_at  = now()
FROM target t
WHERE uau.user_id = t.user_id;

-- Optional: clear today's counters if you want an immediate fresh start
-- COMMENT OUT if not desired.
-- UPDATE user_ai_usage uau
-- SET chat_messages_today = 0
-- FROM target t
-- WHERE uau.user_id = t.user_id;
