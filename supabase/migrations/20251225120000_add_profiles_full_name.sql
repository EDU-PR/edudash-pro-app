-- ================================================
-- Add full_name column to profiles table
-- This column provides a convenient single-field name display
-- ================================================

-- Add full_name column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Create a function to automatically compute full_name from first_name and last_name
CREATE OR REPLACE FUNCTION public.compute_profile_full_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute full_name from first_name and last_name
  NEW.full_name := TRIM(BOTH FROM COALESCE(
    NULLIF(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')), ' '),
    NEW.email
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-compute full_name on insert/update
DROP TRIGGER IF EXISTS trigger_compute_profile_full_name ON public.profiles;
CREATE TRIGGER trigger_compute_profile_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_profile_full_name();

-- Backfill existing profiles with full_name
UPDATE public.profiles
SET full_name = TRIM(BOTH FROM COALESCE(
  NULLIF(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')), ' '),
  email
))
WHERE full_name IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.full_name IS 'Auto-computed from first_name and last_name for display purposes';
