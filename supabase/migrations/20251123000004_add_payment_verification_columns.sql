-- Add payment verification columns to registration_requests
-- Date: 2025-11-23
-- Purpose: Sync payment verification status between EduSitePro and EduDashPro

BEGIN;

-- Add payment_verified column
ALTER TABLE public.registration_requests 
ADD COLUMN IF NOT EXISTS payment_verified boolean DEFAULT false;

-- Add payment_date column
ALTER TABLE public.registration_requests 
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone;

-- Add comments
COMMENT ON COLUMN public.registration_requests.payment_verified IS 
'Indicates whether the proof of payment has been verified by admin';

COMMENT ON COLUMN public.registration_requests.payment_date IS 
'Timestamp when payment was made or verified';

COMMIT;
