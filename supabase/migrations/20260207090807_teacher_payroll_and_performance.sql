-- =============================================================================
-- Teacher Payroll & Performance Tables
-- =============================================================================
-- Creates teacher_salaries, teacher_payments, and teacher_performance_reviews
-- tables. Teacher payments also log to financial_transactions for unified
-- finance tracking.
-- =============================================================================

-- 1. teacher_salaries – current salary configuration per teacher
CREATE TABLE IF NOT EXISTS teacher_salaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    preschool_id    UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    basic_salary    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    allowances      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deductions      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_salary      NUMERIC(12, 2) GENERATED ALWAYS AS (basic_salary + allowances - deductions) STORED,
    pay_scale       TEXT,
    effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (teacher_id)
);

-- 2. teacher_payments – individual payment records
CREATE TABLE IF NOT EXISTS teacher_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id          UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    preschool_id        UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    amount              NUMERIC(12, 2) NOT NULL,
    payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method      TEXT CHECK (
        payment_method IN ('bank_transfer', 'cash', 'cheque', 'eft', 'other')
    ),
    reference_number    TEXT,
    period_start        DATE,
    period_end          DATE,
    notes               TEXT,
    financial_tx_id     UUID REFERENCES financial_transactions(id),
    recorded_by         UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. teacher_performance_reviews – review records
CREATE TABLE IF NOT EXISTS teacher_performance_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id          UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    preschool_id        UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
    reviewer_id         UUID NOT NULL,
    rating              NUMERIC(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    review_period_start DATE,
    review_period_end   DATE,
    strengths           TEXT[] DEFAULT '{}',
    improvement_areas   TEXT[] DEFAULT '{}',
    goals               TEXT[] DEFAULT '{}',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_teacher_salaries_preschool
    ON teacher_salaries(preschool_id);

CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher
    ON teacher_salaries(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_payments_preschool
    ON teacher_payments(preschool_id);

CREATE INDEX IF NOT EXISTS idx_teacher_payments_teacher
    ON teacher_payments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_payments_date
    ON teacher_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_performance_reviews_preschool
    ON teacher_performance_reviews(preschool_id);

CREATE INDEX IF NOT EXISTS idx_teacher_performance_reviews_teacher
    ON teacher_performance_reviews(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_performance_reviews_date
    ON teacher_performance_reviews(review_date DESC);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE teacher_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_performance_reviews ENABLE ROW LEVEL SECURITY;

-- teacher_salaries: principals can manage for their school
CREATE POLICY teacher_salaries_select ON teacher_salaries
    FOR SELECT USING (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

CREATE POLICY teacher_salaries_insert ON teacher_salaries
    FOR INSERT WITH CHECK (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

CREATE POLICY teacher_salaries_update ON teacher_salaries
    FOR UPDATE USING (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

-- teacher_payments: principals can manage for their school
CREATE POLICY teacher_payments_select ON teacher_payments
    FOR SELECT USING (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

CREATE POLICY teacher_payments_insert ON teacher_payments
    FOR INSERT WITH CHECK (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

-- teacher_performance_reviews: principals can manage for their school
CREATE POLICY teacher_perf_reviews_select ON teacher_performance_reviews
    FOR SELECT USING (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

CREATE POLICY teacher_perf_reviews_insert ON teacher_performance_reviews
    FOR INSERT WITH CHECK (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

CREATE POLICY teacher_perf_reviews_update ON teacher_performance_reviews
    FOR UPDATE USING (
        preschool_id IN (
            SELECT COALESCE(organization_id, preschool_id)
            FROM profiles
            WHERE id = auth.uid()
              AND role IN ('principal', 'super_admin')
        )
    );

-- =============================================================================
-- updated_at TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_teacher_salaries_updated_at
    BEFORE UPDATE ON teacher_salaries
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_teacher_perf_reviews_updated_at
    BEFORE UPDATE ON teacher_performance_reviews
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
