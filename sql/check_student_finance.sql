-- Finance check for a student
-- Replace <STUDENT_ID> before running.

-- Student fee records
SELECT id, status, final_amount, amount_paid, amount_outstanding, due_date, updated_at
FROM student_fees
WHERE student_id = '<STUDENT_ID>'
ORDER BY due_date DESC NULLS LAST, created_at DESC;

-- Recent transactions
SELECT id, type, amount, status, payment_method, created_at
FROM financial_transactions
WHERE student_id = '<STUDENT_ID>'
ORDER BY created_at DESC
LIMIT 50;

-- Optional: show any mismatches between final_amount and amount_outstanding
SELECT id,
       final_amount,
       amount_paid,
       amount_outstanding,
       (final_amount - COALESCE(amount_paid, 0)) AS expected_outstanding
FROM student_fees
WHERE student_id = '<STUDENT_ID>'
  AND final_amount IS NOT NULL;
