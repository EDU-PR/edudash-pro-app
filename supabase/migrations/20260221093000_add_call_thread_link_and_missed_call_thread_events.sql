-- Link calls to chat threads and persist missed-call events into thread history.

BEGIN;

ALTER TABLE public.active_calls
  ADD COLUMN IF NOT EXISTS thread_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'active_calls_thread_id_fkey'
      AND conrelid = 'public.active_calls'::regclass
  ) THEN
    ALTER TABLE public.active_calls
      ADD CONSTRAINT active_calls_thread_id_fkey
      FOREIGN KEY (thread_id)
      REFERENCES public.message_threads(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_active_calls_thread_status_started
  ON public.active_calls(thread_id, status, started_at DESC)
  WHERE thread_id IS NOT NULL;

ALTER TABLE public.call_signals
  DROP CONSTRAINT IF EXISTS call_signals_signal_type_check;

ALTER TABLE public.call_signals
  ADD CONSTRAINT call_signals_signal_type_check CHECK (
    signal_type = ANY (
      ARRAY[
        'offer'::text,
        'answer'::text,
        'ice-candidate'::text,
        'call-ended'::text,
        'call-rejected'::text,
        'call-busy'::text,
        'upgrade_to_video'::text,
        'upgrade_ack'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.insert_missed_call_thread_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_content text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'missed' OR COALESCE(OLD.status, '') = 'missed' THEN
    RETURN NEW;
  END IF;

  IF NEW.thread_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- System payload is encoded in content to avoid risky schema rewrites.
  v_content := '__call_event__' || jsonb_build_object(
    'event_type', 'missed_call',
    'call_id', NEW.call_id,
    'call_type', NEW.call_type,
    'caller_id', NEW.caller_id,
    'caller_name', COALESCE(NULLIF(NEW.caller_name, ''), 'Caller'),
    'thread_id', NEW.thread_id,
    'occurred_at', COALESCE(NEW.ended_at, NOW())
  )::text;

  -- Idempotency guard in case retried updates hit "missed" more than once.
  IF EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.thread_id = NEW.thread_id
      AND m.content = v_content
      AND m.content_type = 'system'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.messages (thread_id, sender_id, content, content_type)
    VALUES (NEW.thread_id, NEW.caller_id, v_content, 'system');
  EXCEPTION WHEN OTHERS THEN
    -- Never block call state transition if message card insert fails.
    RAISE WARNING 'insert_missed_call_thread_event failed for call %: %', NEW.call_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_insert_missed_call_thread_event ON public.active_calls;

CREATE TRIGGER trg_insert_missed_call_thread_event
AFTER UPDATE ON public.active_calls
FOR EACH ROW
WHEN (NEW.status = 'missed' AND COALESCE(OLD.status, '') IS DISTINCT FROM 'missed')
EXECUTE FUNCTION public.insert_missed_call_thread_event();

COMMIT;
