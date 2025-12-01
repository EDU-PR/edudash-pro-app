-- Allow NULL user_id for system subscriptions (e.g., deployment notifications)
-- This enables subscriptions without requiring authentication (useful for updates topic)

-- Drop the NOT NULL constraint on user_id
ALTER TABLE push_subscriptions 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add a check constraint to ensure either user_id is set OR topics contains 'updates'
ALTER TABLE push_subscriptions
  ADD CONSTRAINT user_or_system_subscription 
  CHECK (
    user_id IS NOT NULL 
    OR 
    (user_id IS NULL AND 'updates' = ANY(topics))
  );

-- Add service role policy for inserting system subscriptions
DROP POLICY IF EXISTS push_subscriptions_service_role_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_service_role_policy ON push_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update index to include NULL user_id
DROP INDEX IF EXISTS idx_push_subscriptions_user;
CREATE INDEX idx_push_subscriptions_user 
ON push_subscriptions(user_id) 
WHERE is_active = TRUE AND user_id IS NOT NULL;

-- Add index for system subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_system 
ON push_subscriptions(topics) 
WHERE is_active = TRUE AND user_id IS NULL;

COMMENT ON CONSTRAINT user_or_system_subscription ON push_subscriptions IS 
  'Ensures subscriptions have either a user_id or are system subscriptions with updates topic';
