-- Allow public/anon read of active, non-expired job postings for web apply pages
alter table public.job_postings enable row level security;

drop policy if exists "public_view_active_job_postings" on public.job_postings;

create policy "public_view_active_job_postings"
on public.job_postings
for select
to anon, authenticated
using (
  status = 'active'
  and (expires_at is null or expires_at > now())
);
