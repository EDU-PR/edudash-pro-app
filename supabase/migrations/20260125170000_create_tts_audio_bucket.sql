-- Create public storage bucket for Azure TTS audio
-- This bucket stores synthesized speech audio files for Dash AI

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tts-audio',
  'tts-audio',
  TRUE,
  52428800, -- 50 MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;
