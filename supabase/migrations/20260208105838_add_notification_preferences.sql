-- ============================================================================
-- Notification Preferences
-- ============================================================================
-- Stores per-user notification preferences by category.
-- Parents can toggle homework reminders, attendance alerts, messages, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Per-category toggles (default all on)
    homework_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    attendance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    messages BOOLEAN NOT NULL DEFAULT TRUE,
    announcements BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_reports BOOLEAN NOT NULL DEFAULT TRUE,
    payment_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    live_class_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    milestone_celebrations BOOLEAN NOT NULL DEFAULT TRUE,

    -- Delivery channel preferences
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Quiet hours (stored as HH:MM in user's timezone)
    quiet_hours_start TIME DEFAULT NULL,
    quiet_hours_end TIME DEFAULT NULL,
    quiet_hours_timezone TEXT DEFAULT 'Africa/Johannesburg',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One row per user
    CONSTRAINT notification_preferences_user_unique UNIQUE (user_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
    ON notification_preferences(user_id);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own preferences
CREATE POLICY notification_preferences_select
    ON notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY notification_preferences_insert
    ON notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY notification_preferences_update
    ON notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY notification_preferences_delete
    ON notification_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Grant super-admin bypass (for platform monitoring)
CREATE POLICY notification_preferences_superadmin_all
    ON notification_preferences
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );
