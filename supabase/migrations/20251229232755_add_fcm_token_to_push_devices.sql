-- Add FCM token column to push_devices for Firebase Cloud Messaging
-- This enables wake-on-call functionality when the app is killed
-- The FCM token is used to send high-priority data messages that wake Android devices

-- Add fcm_token column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'push_devices' 
        AND column_name = 'fcm_token'
    ) THEN
        ALTER TABLE public.push_devices ADD COLUMN fcm_token text;
        COMMENT ON COLUMN public.push_devices.fcm_token IS 'Firebase Cloud Messaging token for wake-on-call functionality (Android only)';
    END IF;
END $$;

-- Add index for efficient FCM token lookups
CREATE INDEX IF NOT EXISTS idx_push_devices_fcm_token 
ON public.push_devices (fcm_token) 
WHERE fcm_token IS NOT NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Added fcm_token column to push_devices table for wake-on-call support';
END $$;
