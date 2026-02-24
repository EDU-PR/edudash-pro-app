-- Index lesson completion context from feedback JSON for reporting filters.

CREATE INDEX IF NOT EXISTS idx_lesson_completions_assigned_context
  ON public.lesson_completions ((feedback->>'assigned_context'))
  WHERE feedback ? 'assigned_context';
