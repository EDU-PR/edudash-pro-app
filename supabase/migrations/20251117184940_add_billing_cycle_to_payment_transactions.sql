-- Add billing_cycle column to payment_transactions table
-- This column tracks the subscription billing cycle (monthly, yearly, etc.)

-- Add the column if it doesn't exist
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS billing_cycle text;

-- Add a comment to document the column
COMMENT ON COLUMN public.payment_transactions.billing_cycle IS 'Subscription billing cycle: monthly, yearly, etc.';

-- Create index for faster queries filtering by billing cycle
CREATE INDEX IF NOT EXISTS idx_payment_transactions_billing_cycle 
ON public.payment_transactions (billing_cycle);
