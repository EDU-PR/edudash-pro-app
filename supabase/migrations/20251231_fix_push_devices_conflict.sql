-- Fix push_devices upsert conflict (409 errors)
-- Problem: Unique INDEX exists but upsert requires a CONSTRAINT for on_conflict
-- Solution: Add explicit unique constraint for (user_id, device_installation_id)

-- Drop existing index if it exists (we'll replace with constraint)
DROP INDEX IF EXISTS public.push_devices_user_device_idx;

-- Add unique constraint that matches the onConflict clause in the app
-- This enables: .upsert(..., { onConflict: 'user_id,device_installation_id' })
ALTER TABLE public.push_devices
ADD CONSTRAINT push_devices_user_device_unique 
UNIQUE (user_id, device_installation_id);

-- Also ensure device_installation_id is NOT NULL for existing rows
-- and set a default for any NULL values
UPDATE public.push_devices
SET device_installation_id = COALESCE(device_id, gen_random_uuid()::text)
WHERE device_installation_id IS NULL;

-- Make device_installation_id NOT NULL going forward
ALTER TABLE public.push_devices
ALTER COLUMN device_installation_id SET NOT NULL;

-- Create index for device_id lookups (used by setupPushNotifications.ts)
CREATE INDEX IF NOT EXISTS push_devices_device_id_idx 
ON public.push_devices (device_id) WHERE device_id IS NOT NULL;

-- Add comment
COMMENT ON CONSTRAINT push_devices_user_device_unique ON public.push_devices IS
'Ensures one registration per device per user. Used by upsert in lib/notifications.ts';
