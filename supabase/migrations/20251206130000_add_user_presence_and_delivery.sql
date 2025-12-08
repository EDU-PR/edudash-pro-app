-- Migration: Add user presence and delivery tracking
-- Implements online/offline status and message delivery confirmation

-- =============================================================================
-- 1. User Presence Table
-- =============================================================================
-- Tracks user online/offline status and last seen time

CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    device_type TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence(last_seen_at DESC);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Users can view presence of anyone (for showing online status in chats)
CREATE POLICY "Anyone can view presence"
    ON public.user_presence FOR SELECT
    USING (true);

-- Users can only update their own presence
CREATE POLICY "Users can update own presence"
    ON public.user_presence FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence"
    ON public.user_presence FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON public.user_presence TO authenticated;
GRANT INSERT, UPDATE ON public.user_presence TO authenticated;

-- =============================================================================
-- 2. Function to upsert presence (update or insert)
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_user_presence(
    p_user_id UUID,
    p_status TEXT DEFAULT 'online',
    p_device_type TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, status, last_seen_at, device_type, updated_at)
    VALUES (p_user_id, p_status, NOW(), p_device_type, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        last_seen_at = NOW(),
        device_type = COALESCE(EXCLUDED.device_type, user_presence.device_type),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_user_presence(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 3. Add delivered_at to messages table
-- =============================================================================
-- Tracks when message was delivered to recipient's device

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Index for delivery status queries
CREATE INDEX IF NOT EXISTS idx_messages_delivered_at ON public.messages(delivered_at) 
WHERE delivered_at IS NOT NULL;

-- =============================================================================
-- 4. Function to mark messages as delivered
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_messages_delivered(
    p_thread_id UUID,
    p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Mark all undelivered messages in thread as delivered
    -- Only messages NOT sent by this user
    UPDATE public.messages
    SET delivered_at = NOW()
    WHERE thread_id = p_thread_id
      AND sender_id != p_user_id
      AND delivered_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_messages_delivered(UUID, UUID) TO authenticated;

-- =============================================================================
-- 5. Enable realtime for presence table
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- =============================================================================
-- 6. Comments
-- =============================================================================

COMMENT ON TABLE public.user_presence IS 'Tracks user online/offline status for presence indicators';
COMMENT ON COLUMN public.user_presence.status IS 'Current status: online, offline, or away';
COMMENT ON COLUMN public.user_presence.last_seen_at IS 'Timestamp of last activity';
COMMENT ON COLUMN public.messages.delivered_at IS 'When message was delivered to recipient device';
