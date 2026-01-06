-- Migration: Add proof of payment column to aftercare_registrations
-- Description: Add column to store proof of payment file URL and create storage bucket
-- Date: 2026-01-06

-- Add proof_of_payment_url column to aftercare_registrations table
ALTER TABLE aftercare_registrations 
ADD COLUMN IF NOT EXISTS proof_of_payment_url TEXT;

-- Add index for queries filtering by proof of payment status
CREATE INDEX IF NOT EXISTS idx_aftercare_reg_has_pop 
ON aftercare_registrations((proof_of_payment_url IS NOT NULL));

-- Comment on the new column
COMMENT ON COLUMN aftercare_registrations.proof_of_payment_url IS 'URL to uploaded proof of payment file in Supabase Storage';

-- Create storage bucket for aftercare payment proofs (if not exists)
-- Note: Storage buckets are created via the Dashboard or storage API, not SQL
-- This is documented here for reference

-- Create storage policy for aftercare-payments bucket
-- Anyone can upload (public registration form)
-- Only authenticated principals/admins can read
-- INSERT statement from storage schema would go here if bucket created via SQL

-- Grant INSERT access to anon role for uploads (will be done in storage settings)
-- Grant SELECT access to authenticated users with role check

-- Add policy comment
COMMENT ON TABLE aftercare_registrations IS 'Aftercare program registrations for schools. Includes proof of payment upload capability.';
