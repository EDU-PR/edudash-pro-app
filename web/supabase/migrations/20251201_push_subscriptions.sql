-- Create push_subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  
  -- Push subscription details
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  
  -- Device info
  user_agent TEXT,
  
  -- Notification preferences
  topics TEXT[] DEFAULT ARRAY['general', 'announcements']::TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
ON push_subscriptions(user_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_preschool 
ON push_subscriptions(preschool_id) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_select_policy ON push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_insert_policy ON push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_update_policy ON push_subscriptions
FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_delete_policy ON push_subscriptions
FOR DELETE
USING (user_id = auth.uid());

COMMENT ON TABLE push_subscriptions IS 'Web push notification subscriptions for PWA';
