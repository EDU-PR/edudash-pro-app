-- =============================================================================
-- Migration: Add age_group and whatsapp_number to job_postings
-- Date: 2026-02-09
-- Purpose: Allow principals to specify the target age group for the teaching
--          position and a WhatsApp number for quick candidate communication.
-- =============================================================================

-- Add age_group column (nullable, free text for flexibility)
ALTER TABLE job_postings
    ADD COLUMN IF NOT EXISTS age_group text;

COMMENT ON COLUMN job_postings.age_group
    IS 'Target student age group for the position, e.g. 0-2, 3-5, Grade R, Grade 1-3';

-- Add whatsapp_number column for quick contact during hiring
ALTER TABLE job_postings
    ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN job_postings.whatsapp_number
    IS 'WhatsApp number for quick candidate communication during approval stage';
