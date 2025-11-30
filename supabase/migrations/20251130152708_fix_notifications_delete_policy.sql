-- Fix notifications table RLS policies to allow users to delete their own notifications
-- This ensures that when a user clicks the delete button, the notification is actually removed

-- Drop existing policies
DROP POLICY IF EXISTS "notifications_user_access" ON notifications;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;

-- Enable RLS if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- Policy: Users can SELECT their own notifications
CREATE POLICY "notifications_select" ON notifications
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Service role can INSERT notifications for any user (used by triggers)
CREATE POLICY "notifications_insert" ON notifications
FOR INSERT
WITH CHECK (
    user_id = auth.uid() OR 
    current_setting('role', true) = 'service_role' OR
    auth.jwt() ->> 'role' = 'service_role'
);

-- Policy: Users can UPDATE their own notifications (e.g., mark as read)
CREATE POLICY "notifications_update" ON notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Users can DELETE their own notifications
CREATE POLICY "notifications_delete" ON notifications
FOR DELETE
USING (user_id = auth.uid());

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications with full CRUD access for notification owners';
