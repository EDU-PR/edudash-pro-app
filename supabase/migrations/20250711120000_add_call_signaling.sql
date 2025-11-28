-- Migration: Add Call Signaling Tables for WebRTC
-- Purpose: Enable real-time peer-to-peer calls between users

-- =============================================================================
-- Table: call_signals
-- Purpose: Store WebRTC signaling messages (offer, answer, ICE candidates)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.call_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID NOT NULL,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'call-ended', 'call-rejected', 'call-busy')),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by recipient
CREATE INDEX IF NOT EXISTS idx_call_signals_to_user ON public.call_signals(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_signals_call_id ON public.call_signals(call_id);

-- Enable RLS
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- Users can insert signals they send
CREATE POLICY "Users can send signals"
    ON public.call_signals FOR INSERT
    WITH CHECK (auth.uid() = from_user_id);

-- Users can read signals addressed to them
CREATE POLICY "Users can receive signals"
    ON public.call_signals FOR SELECT
    USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- Users can delete their own signals
CREATE POLICY "Users can delete their signals"
    ON public.call_signals FOR DELETE
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- =============================================================================
-- Table: active_calls
-- Purpose: Track active/pending calls for incoming call notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.active_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID UNIQUE NOT NULL,
    caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
    status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'ended', 'rejected', 'missed', 'busy')),
    caller_name TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_active_calls_callee ON public.active_calls(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_active_calls_caller ON public.active_calls(caller_id, status);

-- Enable RLS
ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

-- Users can create calls they initiate
CREATE POLICY "Users can create calls"
    ON public.active_calls FOR INSERT
    WITH CHECK (auth.uid() = caller_id);

-- Users can view calls they're part of
CREATE POLICY "Users can view their calls"
    ON public.active_calls FOR SELECT
    USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Users can update calls they're part of
CREATE POLICY "Users can update their calls"
    ON public.active_calls FOR UPDATE
    USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;

-- =============================================================================
-- Cleanup function: Remove old signals (keep last 24 hours)
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_call_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.call_signals
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    -- Also clean up stale active calls
    UPDATE public.active_calls
    SET status = 'missed', ended_at = NOW()
    WHERE status = 'ringing'
    AND started_at < NOW() - INTERVAL '1 minute';
END;
$$;
