-- Trigger to automatically process enrollment when aftercare registration status changes
-- This calls the Edge Function to create student and parent accounts

-- Create function to call Edge Function
CREATE OR REPLACE FUNCTION trigger_aftercare_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  payload JSONB;
BEGIN
  -- Only trigger on status change to 'enrolled' or 'paid'
  IF NEW.status IN ('enrolled', 'paid') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    -- Build payload
    payload := jsonb_build_object(
      'registration_id', NEW.id,
      'registration_data', row_to_json(NEW)
    );
    
    -- Call Edge Function via HTTP (using pg_net extension if available)
    -- Note: This requires pg_net extension to be enabled
    -- Alternative: Use database function approach instead
    
    -- For now, we'll use a simpler approach: just log and let the client call the function
    -- The client (aftercare-admin.tsx) will call the Edge Function after status update
    
    RAISE NOTICE 'Aftercare registration % status changed to %. Enrollment processing should be triggered.', NEW.id, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS aftercare_enrollment_trigger ON aftercare_registrations;
CREATE TRIGGER aftercare_enrollment_trigger
  AFTER UPDATE OF status ON aftercare_registrations
  FOR EACH ROW
  WHEN (NEW.status IN ('enrolled', 'paid'))
  EXECUTE FUNCTION trigger_aftercare_enrollment();

-- Add enrolled_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'aftercare_registrations' 
    AND column_name = 'enrolled_at'
  ) THEN
    ALTER TABLE aftercare_registrations ADD COLUMN enrolled_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON FUNCTION trigger_aftercare_enrollment() IS 
'Trigger function that logs when aftercare registration status changes to enrolled or paid. Client should call Edge Function to process enrollment.';
