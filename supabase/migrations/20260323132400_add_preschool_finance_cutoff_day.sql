-- Per-school finance month cutoff day.
-- When set (1-28), overrides the global FINANCE_MONTH_CUTOFF_DAY for this org.
-- NULL = use global default (24). E.g. cutoff 24 means parents pay from 25th.

ALTER TABLE public.preschools
  ADD COLUMN IF NOT EXISTS finance_month_cutoff_day integer
  CHECK (finance_month_cutoff_day IS NULL OR (finance_month_cutoff_day >= 1 AND finance_month_cutoff_day <= 28));

COMMENT ON COLUMN public.preschools.finance_month_cutoff_day IS
  'Day of month (1-28) that marks billing boundary. Parents pay from (cutoff+1). NULL = use app default (24).';
