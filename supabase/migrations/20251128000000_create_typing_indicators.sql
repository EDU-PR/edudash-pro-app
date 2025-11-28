-- ============================================================
-- Create typing_indicators table for real-time typing status
-- ============================================================
-- Purpose: Track which users are currently typing in message threads
-- Used by: Real-time messaging UI to show "... is typing" indicators

CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_typing boolean NOT NULL DEFAULT true,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure one record per user per thread
  UNIQUE(thread_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_typing_indicators_thread_id ON public.typing_indicators(thread_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_user_id ON public.typing_indicators(user_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_is_typing ON public.typing_indicators(is_typing) WHERE is_typing = true;
CREATE INDEX IF NOT EXISTS idx_typing_indicators_last_updated ON public.typing_indicators(last_updated_at);

-- Enable RLS
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy 1: Users can insert their own typing status
CREATE POLICY "Users can insert their own typing status"
ON public.typing_indicators
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.message_participants
    WHERE message_participants.thread_id = typing_indicators.thread_id
    AND message_participants.user_id = auth.uid()
  )
);

-- Policy 2: Users can update their own typing status
CREATE POLICY "Users can update their own typing status"
ON public.typing_indicators
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can delete their own typing status
CREATE POLICY "Users can delete their own typing status"
ON public.typing_indicators
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy 4: Thread participants can view typing indicators
CREATE POLICY "Thread participants can view typing indicators"
ON public.typing_indicators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.message_participants
    WHERE message_participants.thread_id = typing_indicators.thread_id
    AND message_participants.user_id = auth.uid()
  )
);

-- Function to automatically clean up stale typing indicators
CREATE OR REPLACE FUNCTION public.cleanup_stale_typing_indicators()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete typing indicators older than 10 seconds
  DELETE FROM public.typing_indicators
  WHERE last_updated_at < now() - interval '10 seconds';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_stale_typing_indicators() TO authenticated;

-- Optional: Create a trigger to auto-update last_updated_at
CREATE OR REPLACE FUNCTION public.update_typing_indicator_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_typing_indicator_timestamp
  BEFORE UPDATE ON public.typing_indicators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_typing_indicator_timestamp();

-- Enable Realtime for typing_indicators table
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.typing_indicators TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE public.typing_indicators IS 'Tracks real-time typing status for message threads';
COMMENT ON COLUMN public.typing_indicators.thread_id IS 'Reference to the message thread';
COMMENT ON COLUMN public.typing_indicators.user_id IS 'User who is typing';
COMMENT ON COLUMN public.typing_indicators.is_typing IS 'Whether user is currently typing';
COMMENT ON COLUMN public.typing_indicators.started_at IS 'When user started typing';
COMMENT ON COLUMN public.typing_indicators.last_updated_at IS 'Last time typing status was updated';
