-- Fix push_devices unique constraint to prevent 409 conflicts
-- Ensures only the (user_id, device_installation_id) constraint exists

DO $$
BEGIN
  IF to_regclass('public.push_devices') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP INDEX IF EXISTS public.push_devices_user_token_idx';

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS push_devices_user_device_idx
           ON public.push_devices (user_id, device_installation_id)';

  EXECUTE 'UPDATE public.push_devices
           SET device_installation_id = COALESCE(device_id, ''device_'' || id::text)
           WHERE device_installation_id IS NULL';

  IF EXISTS (SELECT 1 FROM public.push_devices WHERE device_installation_id IS NULL) THEN
    RAISE NOTICE 'Warning: Some push_devices records still have NULL device_installation_id';
  ELSE
    BEGIN
      EXECUTE 'ALTER TABLE public.push_devices ALTER COLUMN device_installation_id SET NOT NULL';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'device_installation_id NOT NULL constraint already exists or cannot be added';
    END;
  END IF;

  EXECUTE 'DELETE FROM public.push_devices a
           USING public.push_devices b
           WHERE a.id < b.id
             AND a.user_id = b.user_id
             AND a.device_installation_id = b.device_installation_id';
END $$;
