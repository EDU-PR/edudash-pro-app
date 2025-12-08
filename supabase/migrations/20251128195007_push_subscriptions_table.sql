-- Create push_subscriptions table for Web Push notifications
-- This table stores user push notification subscriptions

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Service role full access on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users manage own subscriptions" ON push_subscriptions;

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access on push_subscriptions" 
ON push_subscriptions 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users can manage their own subscriptions
CREATE POLICY "Users manage own subscriptions" 
ON push_subscriptions 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  target_type text, -- 'user', 'users', 'preschool', 'topic'
  target_value text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access notification logs
CREATE POLICY "Service role access notification_logs"
ON notification_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index on notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
