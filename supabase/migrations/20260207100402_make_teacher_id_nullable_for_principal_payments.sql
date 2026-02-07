-- Make teacher_id nullable on teacher_payments to support principal/staff payments
-- that are not tied to a specific teacher record.
ALTER TABLE teacher_payments
    ALTER COLUMN teacher_id DROP NOT NULL;

-- Drop the existing FK constraint and re-add with ON DELETE SET NULL
ALTER TABLE teacher_payments
    DROP CONSTRAINT IF EXISTS teacher_payments_teacher_id_fkey;

ALTER TABLE teacher_payments
    ADD CONSTRAINT teacher_payments_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- Add index on recipient_role for filtering principal/staff payments
CREATE INDEX IF NOT EXISTS idx_teacher_payments_recipient_role
    ON teacher_payments(recipient_role);
