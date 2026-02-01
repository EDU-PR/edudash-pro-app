-- Add parent contact fields to registration_requests
alter table public.registration_requests
  add column if not exists parent_email text,
  add column if not exists parent_first_name text,
  add column if not exists parent_last_name text,
  add column if not exists parent_phone text;
