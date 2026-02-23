-- Excursion Preflight Checks
-- Mandatory safety checklist before excursion can be approved
-- Date: 2026-03-02

ALTER TABLE school_excursions
ADD COLUMN IF NOT EXISTS preflight_checks JSONB DEFAULT '{}';

COMMENT ON COLUMN school_excursions.preflight_checks IS 'Safety checklist: transport_verified, first_aid_kit, consent_forms, emergency_contacts, staff_ratio, weather_venue, allergy_medical. All must be true before approval.';
