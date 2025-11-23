-- Add payment tracking columns to students table
-- Date: 2025-11-23
-- Purpose: Track registration fee payments for students in EduDashPro

BEGIN;

-- Add registration fee amount column
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS registration_fee_amount decimal(10,2);

-- Add registration fee paid status
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS registration_fee_paid boolean DEFAULT false;

-- Add payment verification status
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS payment_verified boolean DEFAULT false;

-- Add payment date
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone;

-- Add comments for documentation
COMMENT ON COLUMN public.students.registration_fee_amount IS 
'Registration fee amount for the student';

COMMENT ON COLUMN public.students.registration_fee_paid IS 
'Indicates whether registration fee has been marked as paid';

COMMENT ON COLUMN public.students.payment_verified IS 
'Indicates whether the proof of payment has been verified by principal/admin';

COMMENT ON COLUMN public.students.payment_date IS 
'Timestamp when payment was made or verified';

COMMIT;
