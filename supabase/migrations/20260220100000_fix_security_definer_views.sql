-- Fix Security Definer Views
-- ============================================================
-- Both views were created WITHOUT `WITH (security_invoker = true)`,
-- making them security-definer by default.  This means they bypass
-- RLS on the `students` table and can leak cross-tenant data.
--
-- This migration recreates both views with security_invoker = true
-- so that queries against these views honour the calling user's RLS
-- policies.
-- ============================================================

-- 1) student_status_consistency_report
DROP VIEW IF EXISTS public.student_status_consistency_report;

CREATE VIEW public.student_status_consistency_report
  WITH (security_invoker = true)
AS
SELECT
  s.id AS student_id,
  COALESCE(s.organization_id, s.preschool_id) AS preschool_id,
  s.first_name,
  s.last_name,
  s.status,
  s.is_active,
  CASE
    WHEN lower(COALESCE(s.status, '')) = 'active' AND s.is_active IS DISTINCT FROM true
      THEN 'active_status_but_inactive_flag'
    WHEN lower(COALESCE(s.status, '')) <> 'active' AND s.is_active IS DISTINCT FROM false
      THEN 'non_active_status_but_active_flag'
    ELSE 'ok'
  END AS issue_type,
  s.created_at,
  s.updated_at
FROM public.students s
WHERE (
  lower(COALESCE(s.status, '')) = 'active' AND s.is_active IS DISTINCT FROM true
) OR (
  lower(COALESCE(s.status, '')) <> 'active' AND s.is_active IS DISTINCT FROM false
);

-- 2) student_duplicate_candidates
DROP VIEW IF EXISTS public.student_duplicate_candidates;

CREATE VIEW public.student_duplicate_candidates
  WITH (security_invoker = true)
AS
WITH normalized AS (
  SELECT
    s.id,
    COALESCE(s.organization_id, s.preschool_id) AS preschool_id,
    lower(regexp_replace(COALESCE(s.first_name, ''), '[^a-z0-9]', '', 'g')) AS first_key,
    lower(regexp_replace(COALESCE(s.last_name, ''), '[^a-z0-9]', '', 'g')) AS last_key,
    s.date_of_birth,
    COALESCE(s.parent_id, s.guardian_id) AS caregiver_id,
    s.first_name,
    s.last_name,
    s.status,
    s.is_active,
    s.class_id,
    s.created_at
  FROM public.students s
  WHERE COALESCE(s.first_name, '') <> ''
), grouped AS (
  SELECT
    preschool_id,
    first_key,
    date_of_birth,
    caregiver_id,
    COUNT(*) AS candidate_count,
    ARRAY_AGG(id ORDER BY created_at DESC) AS student_ids,
    ARRAY_AGG(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ORDER BY created_at DESC) AS names,
    ARRAY_AGG(status ORDER BY created_at DESC) AS statuses,
    ARRAY_AGG(is_active ORDER BY created_at DESC) AS active_flags,
    MAX(created_at) AS latest_created_at
  FROM normalized
  WHERE date_of_birth IS NOT NULL
  GROUP BY preschool_id, first_key, date_of_birth, caregiver_id
  HAVING COUNT(*) > 1
)
SELECT
  g.preschool_id,
  g.first_key,
  g.date_of_birth,
  g.caregiver_id,
  g.candidate_count,
  g.student_ids,
  g.names,
  g.statuses,
  g.active_flags,
  g.latest_created_at
FROM grouped g;
