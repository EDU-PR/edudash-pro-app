-- =============================================================================
-- Backwards-Compatibility: provider/model on ai_usage_logs
-- =============================================================================
-- Some deployed clients/edge jobs query:
--   /rest/v1/ai_usage_logs?select=preschool_id,provider,model,...
-- but the current schema uses:
--   - ai_usage_logs.ai_model_used (not model)
--   - ai_usage_logs.ai_service_id -> ai_services.provider (not provider)
--
-- PostgREST returns HTTP 400 for unknown columns. This migration adds
-- denormalized columns to eliminate those 400s, and keeps them in sync.
-- =============================================================================

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS provider text;

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS model text;

COMMENT ON COLUMN public.ai_usage_logs.provider IS
  'Denormalized provider (from ai_services.provider) for backwards-compatible selects.';

COMMENT ON COLUMN public.ai_usage_logs.model IS
  'Backwards-compatible alias for ai_model_used.';

-- ---------------------------------------------------------------------------
-- Backfill existing rows
-- ---------------------------------------------------------------------------
UPDATE public.ai_usage_logs
SET model = ai_model_used
WHERE ai_model_used IS NOT NULL
  AND model IS DISTINCT FROM ai_model_used;

UPDATE public.ai_usage_logs l
SET provider = s.provider
FROM public.ai_services s
WHERE l.ai_service_id = s.id
  AND s.provider IS NOT NULL
  AND l.provider IS DISTINCT FROM s.provider;

-- ---------------------------------------------------------------------------
-- Keep future rows in sync
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_usage_logs_set_provider_model()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- model: keep in sync with ai_model_used
  IF NEW.ai_model_used IS NOT NULL THEN
    NEW.model := NEW.ai_model_used;
  END IF;

  -- provider: denormalize from ai_services via ai_service_id
  IF NEW.ai_service_id IS NOT NULL THEN
    SELECT s.provider INTO NEW.provider
    FROM public.ai_services s
    WHERE s.id = NEW.ai_service_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ai_usage_logs_set_provider_model ON public.ai_usage_logs;

CREATE TRIGGER trg_ai_usage_logs_set_provider_model
BEFORE INSERT OR UPDATE OF ai_model_used, ai_service_id
ON public.ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION public.ai_usage_logs_set_provider_model();

