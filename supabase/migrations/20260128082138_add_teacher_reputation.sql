-- Teacher reputation + market profile support

-- Candidate profiles: public market info + location
create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid()
);

alter table if exists public.candidate_profiles
  add column if not exists user_id uuid;

alter table if exists public.candidate_profiles
  add column if not exists is_public boolean not null default false,
  add column if not exists location_city text,
  add column if not exists location_province text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_source text,
  add column if not exists preferred_radius_km integer,
  add column if not exists location_updated_at timestamptz;

create unique index if not exists candidate_profiles_user_id_key
  on public.candidate_profiles (user_id);

create index if not exists idx_candidate_profiles_public_location
  on public.candidate_profiles (is_public, location_city, location_province);

-- Employment history for verification
create table if not exists public.teacher_employment_history (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null,
  organization_id uuid not null,
  principal_id uuid not null,
  role text,
  start_date date not null default (now()::date),
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teacher_employment_history_teacher
  on public.teacher_employment_history (teacher_user_id, organization_id);

-- References & ratings
create table if not exists public.teacher_references (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  teacher_user_id uuid,
  organization_id uuid not null,
  principal_id uuid not null,
  rating_overall integer not null check (rating_overall between 1 and 5),
  rating_communication integer check (rating_communication between 1 and 5),
  rating_classroom integer check (rating_classroom between 1 and 5),
  rating_planning integer check (rating_planning between 1 and 5),
  rating_professionalism integer check (rating_professionalism between 1 and 5),
  rating_parent_engagement integer check (rating_parent_engagement between 1 and 5),
  rating_reliability integer check (rating_reliability between 1 and 5),
  title text,
  comment text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists teacher_references_unique_per_principal
  on public.teacher_references (candidate_profile_id, organization_id, principal_id);

create index if not exists idx_teacher_references_candidate
  on public.teacher_references (candidate_profile_id);

create index if not exists idx_teacher_references_teacher_user
  on public.teacher_references (teacher_user_id);

create table if not exists public.teacher_reference_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  requester_org_id uuid not null,
  requester_principal_id uuid not null,
  target_org_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_teacher_reference_requests_candidate
  on public.teacher_reference_requests (candidate_profile_id);

-- Rating summary view
create or replace view public.teacher_rating_summary as
select
  tr.candidate_profile_id,
  tr.teacher_user_id,
  count(*)::integer as rating_count,
  round(avg(tr.rating_overall)::numeric, 2) as avg_rating,
  round(avg(tr.rating_communication)::numeric, 2) as avg_communication,
  round(avg(tr.rating_classroom)::numeric, 2) as avg_classroom,
  round(avg(tr.rating_planning)::numeric, 2) as avg_planning,
  round(avg(tr.rating_professionalism)::numeric, 2) as avg_professionalism,
  round(avg(tr.rating_parent_engagement)::numeric, 2) as avg_parent_engagement,
  round(avg(tr.rating_reliability)::numeric, 2) as avg_reliability,
  max(tr.created_at) as last_rating_at
from public.teacher_references tr
group by tr.candidate_profile_id, tr.teacher_user_id;

-- RLS
alter table if exists public.candidate_profiles enable row level security;
alter table if exists public.teacher_employment_history enable row level security;
alter table if exists public.teacher_references enable row level security;
alter table if exists public.teacher_reference_requests enable row level security;

-- Candidate profiles: teacher can manage their own; principals can view public
drop policy if exists "Teachers manage their public profile" on public.candidate_profiles;
create policy "Teachers manage their public profile"
  on public.candidate_profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Principals can view public teacher profiles" on public.candidate_profiles;
create policy "Principals can view public teacher profiles"
  on public.candidate_profiles
  for select
  using (
    is_public = true
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
    )
  );

-- Employment history: principals within org can manage
drop policy if exists "Principals manage employment history" on public.teacher_employment_history;
create policy "Principals manage employment history"
  on public.teacher_employment_history
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
        and (p.organization_id = organization_id or p.preschool_id = organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
        and (p.organization_id = organization_id or p.preschool_id = organization_id)
    )
  );

-- References: principals can view; teachers can view their own
drop policy if exists "Principals can view teacher references" on public.teacher_references;
create policy "Principals can view teacher references"
  on public.teacher_references
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
    )
    or teacher_user_id = auth.uid()
    or candidate_profile_id in (
      select id
      from public.candidate_profiles cp
      where cp.user_id = auth.uid()
    )
  );

drop policy if exists "Principals can create references for former teachers" on public.teacher_references;
create policy "Principals can create references for former teachers"
  on public.teacher_references
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
        and (p.organization_id = organization_id or p.preschool_id = organization_id)
    )
    and exists (
      select 1
      from public.teacher_employment_history h
      join public.candidate_profiles cp on cp.user_id = h.teacher_user_id
      where cp.id = candidate_profile_id
        and h.organization_id = organization_id
    )
  );

drop policy if exists "Principals can update their references" on public.teacher_references;
create policy "Principals can update their references"
  on public.teacher_references
  for update
  using (principal_id = auth.uid())
  with check (principal_id = auth.uid());

drop policy if exists "Principals can delete their references" on public.teacher_references;
create policy "Principals can delete their references"
  on public.teacher_references
  for delete
  using (principal_id = auth.uid());

-- Reference requests: principals manage their org requests
drop policy if exists "Principals manage reference requests" on public.teacher_reference_requests;
create policy "Principals manage reference requests"
  on public.teacher_reference_requests
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
        and (p.organization_id = requester_org_id or p.preschool_id = requester_org_id)
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('principal', 'principal_admin', 'super_admin', 'superadmin')
        and (p.organization_id = requester_org_id or p.preschool_id = requester_org_id)
    )
  );
