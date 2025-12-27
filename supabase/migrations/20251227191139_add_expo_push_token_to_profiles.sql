-- Add Expo Push Token to Profiles for Incoming Call Notifications
-- Migration: 20251227191139_add_expo_push_token_to_profiles

-- Add expo_push_token column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Create index for faster lookups when sending push notifications
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token 
ON profiles(expo_push_token) 
WHERE expo_push_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.expo_push_token IS 'Expo Push Token for receiving incoming call notifications';
COMMENT ON COLUMN profiles.push_token_updated_at IS 'Last time the push token was updated';
