-- Fix push_devices unique constraint to prevent 409 conflicts
-- Ensures only the (user_id, device_installation_id) constraint exists

-- Drop old unique index if it still exists
DROP INDEX IF EXISTS public.push_devices_user_token_idx;

-- Ensure the correct unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_user_device_idx
ON public.push_devices (user_id, device_installation_id);

-- Ensure device_installation_id has a default for old records
-- Update any NULL device_installation_id values using device_id or a generated value
UPDATE public.push_devices 
SET device_installation_id = COALESCE(device_id, 'device_' || id::text)
WHERE device_installation_id IS NULL;

-- Make device_installation_id NOT NULL if not already (to prevent future issues)
-- First check if there are any NULL values left
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.push_devices WHERE device_installation_id IS NULL) THEN
        RAISE NOTICE 'Warning: Some push_devices records still have NULL device_installation_id';
    ELSE
        -- Try to add NOT NULL constraint if column doesn't already have it
        BEGIN
            ALTER TABLE public.push_devices 
            ALTER COLUMN device_installation_id SET NOT NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Constraint might already exist
            RAISE NOTICE 'device_installation_id NOT NULL constraint already exists or cannot be added';
        END;
    END IF;
END $$;

-- Clean up duplicate records for same user + device_installation_id (keep most recent)
-- This handles edge cases where duplicates might have been created
DELETE FROM public.push_devices a
USING public.push_devices b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.device_installation_id = b.device_installation_id;
