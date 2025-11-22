-- ================================================================
-- Activate Real-Time Sync Between EduSitePro and EduDashPro
-- ================================================================
-- This script sets up database triggers that immediately sync changes
-- between the two databases instead of waiting for the 5-minute cron job
--
-- Run this in EduSitePro database to activate instant sync
-- ================================================================

-- Enable the http extension for making webhook calls
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Step 1: Create function to sync new registrations to EduDashPro
CREATE OR REPLACE FUNCTION sync_new_registration_to_edudash()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the bulk sync function which handles INSERT/UPDATE/DELETE
  -- This triggers an immediate sync instead of waiting for the 5-minute cron job
  PERFORM
    net.http_post(
      url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc0MjczMywiZXhwIjoyMDQ2MzE4NzMzfQ.7LqcRr0vdm7tB_MrxLOQBLf4F3w7XxFBk5VGDnV4XB8'
      ),
      body := jsonb_build_object('trigger', 'insert')
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger for INSERT (new registrations)
DROP TRIGGER IF EXISTS trigger_sync_new_registration ON registration_requests;
CREATE TRIGGER trigger_sync_new_registration
  AFTER INSERT ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_registration_to_edudash();

-- Step 3: Create function to sync updates (status changes, POP uploads, etc.)
CREATE OR REPLACE FUNCTION sync_registration_updates_to_edudash()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if important fields changed
  IF (NEW.status IS DISTINCT FROM OLD.status) OR
     (NEW.proof_of_payment_url IS DISTINCT FROM OLD.proof_of_payment_url) OR
     (NEW.registration_fee_paid IS DISTINCT FROM OLD.registration_fee_paid) OR
     (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by) OR
     (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) OR
     (NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason) THEN
    
    -- Trigger bulk sync (it handles updates efficiently)
    PERFORM
      net.http_post(
        url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc0MjczMywiZXhwIjoyMDQ2MzE4NzMzfQ.7LqcRr0vdm7tB_MrxLOQBLf4F3w7XxFBk5VGDnV4XB8'
        ),
        body := jsonb_build_object('trigger', 'update')
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger for UPDATE (status changes, POP uploads)
DROP TRIGGER IF EXISTS trigger_sync_registration_updates ON registration_requests;
CREATE TRIGGER trigger_sync_registration_updates
  AFTER UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_registration_updates_to_edudash();

-- Step 5: Create function to sync deletions
CREATE OR REPLACE FUNCTION sync_registration_deletion_to_edudash()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger bulk sync which will detect and handle deletions
  PERFORM
    net.http_post(
      url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc0MjczMywiZXhwIjoyMDQ2MzE4NzMzfQ.7LqcRr0vdm7tB_MrxLOQBLf4F3w7XxFBk5VGDnV4XB8'
      ),
      body := jsonb_build_object('trigger', 'delete')
    );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger for DELETE
DROP TRIGGER IF EXISTS trigger_sync_registration_deletion ON registration_requests;
CREATE TRIGGER trigger_sync_registration_deletion
  AFTER DELETE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_registration_deletion_to_edudash();

-- Verify triggers are active
SELECT 
  trigger_name, 
  event_manipulation as event,
  action_statement as function
FROM information_schema.triggers
WHERE event_object_table = 'registration_requests'
ORDER BY trigger_name;
