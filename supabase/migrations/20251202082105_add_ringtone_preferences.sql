-- Add ringtone_preferences column to profiles table
-- This stores user's custom ringtone settings for incoming/outgoing calls

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ringtone_preferences JSONB DEFAULT '{
  "incomingRingtone": "default_old",
  "incomingVolume": 1.0,
  "outgoingRingback": "default",
  "outgoingVolume": 0.8,
  "vibrateOnIncoming": true,
  "vibrateOnOutgoing": false,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.ringtone_preferences IS 'User ringtone preferences for incoming calls (ringtone) and outgoing calls (ringback). Supports custom uploaded sounds.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_ringtone_preferences ON profiles USING gin(ringtone_preferences);
