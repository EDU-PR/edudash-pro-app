-- Rename reviewed_at to reviewed_date to match EduSitePro schema
-- This fixes the sync errors when uploading proof of payment

ALTER TABLE public.registration_requests 
RENAME COLUMN reviewed_at TO reviewed_date;

-- Add comment explaining the field
COMMENT ON COLUMN public.registration_requests.reviewed_date IS 'Date when the registration was reviewed by an admin';
