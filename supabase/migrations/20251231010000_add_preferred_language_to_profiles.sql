-- Migration: Add preferred_language to profiles table
-- This centralizes language preference storage for users
-- Sync flow: UI → profiles.preferred_language → Dash AI context

-- Add preferred_language column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN preferred_language TEXT DEFAULT 'en';
    
    COMMENT ON COLUMN public.profiles.preferred_language IS 
      'User preferred language code (en, af, zu). Synced from app settings.';
  END IF;
END $$;

-- Create index for language-based queries (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language 
ON public.profiles (preferred_language);

-- Create function to update user language preference
-- Validates to en/af/zu only (AI/TTS supported languages)
CREATE OR REPLACE FUNCTION public.set_user_language(p_user_id UUID, p_language TEXT)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  -- Validate language is one of the supported AI/TTS languages
  IF p_language NOT IN ('en', 'af', 'zu') THEN
    -- Default to English for unsupported languages
    p_language := 'en';
  END IF;
  
  UPDATE public.profiles
  SET preferred_language = p_language,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_user_language TO authenticated;
