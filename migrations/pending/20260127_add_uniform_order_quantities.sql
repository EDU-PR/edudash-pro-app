ALTER TABLE public.uniform_requests
  ADD COLUMN IF NOT EXISTS tshirt_quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shorts_quantity integer DEFAULT 1;

ALTER TABLE public.uniform_requests DISABLE TRIGGER trg_uniform_requests_set_fields;

UPDATE public.uniform_requests
SET
  tshirt_quantity = COALESCE(tshirt_quantity, 1),
  shorts_quantity = COALESCE(shorts_quantity, 1);

ALTER TABLE public.uniform_requests ENABLE TRIGGER trg_uniform_requests_set_fields;
