-- Add foreign key relationship between registration_requests and preschools
-- This enables proper joins and data integrity for registration queries

-- First, ensure preschool_id column exists (it should already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'registration_requests' 
    AND column_name = 'preschool_id'
  ) THEN
    ALTER TABLE public.registration_requests 
    ADD COLUMN preschool_id UUID;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND table_name = 'registration_requests'
    AND constraint_name = 'registration_requests_preschool_id_fkey'
  ) THEN
    ALTER TABLE public.registration_requests
    ADD CONSTRAINT registration_requests_preschool_id_fkey
    FOREIGN KEY (preschool_id)
    REFERENCES public.preschools(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_preschool_id 
ON public.registration_requests(preschool_id);

-- Comment for documentation
COMMENT ON CONSTRAINT registration_requests_preschool_id_fkey 
ON public.registration_requests 
IS 'Links registration requests to their target preschool. CASCADE delete ensures cleanup when school is removed.';
