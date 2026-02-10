-- Prevent duplicate EduSite registration sync records.
-- Root issue: sync relied only on edusite_id; if missing/unstable, cron could
-- repeatedly insert duplicate registration_requests rows.

BEGIN;

ALTER TABLE public.registration_requests
  ADD COLUMN IF NOT EXISTS edusite_sync_key TEXT;

-- Backfill deterministic sync key for already-synced rows.
UPDATE public.registration_requests rr
SET edusite_sync_key = concat_ws(
  '|',
  rr.organization_id::text,
  lower(trim(coalesce(nullif(rr.parent_email, ''), nullif(rr.guardian_email, ''), ''))),
  lower(trim(coalesce(rr.student_first_name, ''))),
  lower(trim(coalesce(rr.student_last_name, ''))),
  coalesce(rr.student_dob::text, '')
)
WHERE rr.synced_from_edusite IS TRUE
  AND rr.edusite_sync_key IS NULL;

-- Keep latest row per sync key (if duplicates already exist).
WITH ranked AS (
  SELECT
    rr.id,
    row_number() OVER (
      PARTITION BY rr.edusite_sync_key
      ORDER BY rr.updated_at DESC NULLS LAST, rr.created_at DESC NULLS LAST, rr.id DESC
    ) AS rn
  FROM public.registration_requests rr
  WHERE rr.synced_from_edusite IS TRUE
    AND rr.edusite_sync_key IS NOT NULL
)
DELETE FROM public.registration_requests rr
USING ranked r
WHERE rr.id = r.id
  AND r.rn > 1;

-- Canonical external-id uniqueness guard.
CREATE UNIQUE INDEX IF NOT EXISTS registration_requests_edusite_id_uidx
  ON public.registration_requests(edusite_id)
  WHERE edusite_id IS NOT NULL;

-- Fallback uniqueness guard when source IDs are missing/unstable.
CREATE UNIQUE INDEX IF NOT EXISTS registration_requests_edusite_sync_key_uidx
  ON public.registration_requests(edusite_sync_key)
  WHERE synced_from_edusite IS TRUE
    AND edusite_sync_key IS NOT NULL;

COMMIT;

