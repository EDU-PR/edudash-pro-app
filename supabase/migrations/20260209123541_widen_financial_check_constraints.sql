-- ============================================================
-- Widen CHECK constraints on financial_transactions and payments
-- ============================================================
-- Fixes:
--   1. financial_transactions: payment_method 'manual' was rejected (400)
--   2. financial_transactions: status 'voided' was rejected (400)
--   3. financial_transactions: type 'salary'/'purchase'/'operational_expense' were rejected
--   4. payments: status 'reversed' was rejected
--
-- App code now maps to existing valid values, but we also widen the
-- constraints so legitimate new values are accepted going forward.
-- ============================================================

-- ── financial_transactions ──────────────────────────────────────

-- payment_method: add 'manual' and 'debit_order'
ALTER TABLE public.financial_transactions
    DROP CONSTRAINT IF EXISTS financial_transactions_payment_method_check;

ALTER TABLE public.financial_transactions
    ADD CONSTRAINT financial_transactions_payment_method_check
    CHECK (
        payment_method = ANY (ARRAY[
            'cash', 'bank_transfer', 'eft', 'card',
            'mobile_payment', 'cheque', 'other',
            'manual', 'debit_order'
        ])
    );

-- status: add 'voided' and 'reversed'
ALTER TABLE public.financial_transactions
    DROP CONSTRAINT IF EXISTS financial_transactions_status_check;

ALTER TABLE public.financial_transactions
    ADD CONSTRAINT financial_transactions_status_check
    CHECK (
        status = ANY (ARRAY[
            'pending', 'completed', 'failed', 'cancelled',
            'voided', 'reversed'
        ])
    );

-- type: add 'salary', 'operational_expense', 'purchase', 'income'
ALTER TABLE public.financial_transactions
    DROP CONSTRAINT IF EXISTS financial_transactions_type_check;

ALTER TABLE public.financial_transactions
    ADD CONSTRAINT financial_transactions_type_check
    CHECK (
        type = ANY (ARRAY[
            'fee_payment', 'expense', 'refund', 'adjustment',
            'salary', 'operational_expense', 'purchase', 'income'
        ])
    );

-- ── payments ────────────────────────────────────────────────────

-- status: add 'reversed' and 'cancelled'
ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_status_check
    CHECK (
        status = ANY (ARRAY[
            'pending', 'completed', 'failed', 'refunded',
            'proof_submitted', 'under_review', 'approved', 'rejected',
            'reversed', 'cancelled'
        ])
    );
