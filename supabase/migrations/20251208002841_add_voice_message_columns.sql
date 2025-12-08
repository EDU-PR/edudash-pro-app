-- Migration: Add voice message support columns to messages table
-- Description: Adds voice_url and voice_duration columns to support voice message playback

-- Add voice_url column for storing the storage path to the audio file
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS voice_url TEXT;

-- Add voice_duration column for storing the duration in seconds
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS voice_duration INTEGER;

-- Update content_type check constraint to include 'voice' type
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_content_type_check 
CHECK (content_type = ANY (ARRAY['text'::text, 'system'::text, 'voice'::text, 'image'::text]));

-- Add index for voice messages to optimize queries
CREATE INDEX IF NOT EXISTS idx_messages_voice 
ON public.messages (thread_id, created_at DESC) 
WHERE voice_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.voice_url IS 'Storage path to voice recording file in voice_recordings bucket';
COMMENT ON COLUMN public.messages.voice_duration IS 'Duration of voice recording in seconds';
