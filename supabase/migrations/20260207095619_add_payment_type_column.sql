-- =============================================================================
-- Add payment_type to teacher_payments for advance/loan/bonus tracking
-- Also add a recipient field to support principal self-payments
-- =============================================================================

ALTER TABLE teacher_payments
    ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'salary'
        CHECK (payment_type IN (
            'salary',
            'advance',
            'loan',
            'bonus',
            'reimbursement',
            'deduction_recovery',
            'other'
        )),
    ADD COLUMN IF NOT EXISTS recipient_role TEXT NOT NULL DEFAULT 'teacher'
        CHECK (recipient_role IN ('teacher', 'principal', 'staff')),
    ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_teacher_payments_type
    ON teacher_payments(payment_type);
