-- Backfill preschools.principal_id from existing principal/principal_admin profiles.
-- Non-destructive: updates only rows where principal_id is currently NULL.

BEGIN;

ALTER TABLE public.preschools
  ADD COLUMN IF NOT EXISTS principal_id uuid;

CREATE INDEX IF NOT EXISTS idx_preschools_principal_id
  ON public.preschools(principal_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'preschools_principal_id_fkey'
  ) THEN
    ALTER TABLE public.preschools
      ADD CONSTRAINT preschools_principal_id_fkey
      FOREIGN KEY (principal_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

WITH principal_candidates AS (
  SELECT
    COALESCE(p.organization_id, p.preschool_id) AS school_id,
    p.id AS principal_profile_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(p.organization_id, p.preschool_id)
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
    ) AS rn
  FROM public.profiles p
  WHERE COALESCE(p.organization_id, p.preschool_id) IS NOT NULL
    AND LOWER(COALESCE(p.role, '')) IN ('principal', 'principal_admin')
    AND COALESCE(p.is_active, true) = true
),
resolved_principals AS (
  SELECT school_id, principal_profile_id
  FROM principal_candidates
  WHERE rn = 1
)
UPDATE public.preschools s
SET principal_id = rp.principal_profile_id
FROM resolved_principals rp
WHERE s.id = rp.school_id
  AND s.principal_id IS NULL;

COMMIT;
