-- Fix policy creation for teacher reputation (Postgres doesn't support CREATE POLICY IF NOT EXISTS)

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidate_profiles'
      and policyname = 'Teachers manage their public profile'
  ) then
    execute $policy$
      create policy "Teachers manage their public profile"
        on public.candidate_profiles
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidate_profiles'
      and policyname = 'Principals can view public teacher profiles'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_employment_history'
      and policyname = 'Principals manage employment history'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_references'
      and policyname = 'Principals can view teacher references'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_references'
      and policyname = 'Principals can create references for former teachers'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_references'
      and policyname = 'Principals can update their references'
  ) then
    execute $policy$
      create policy "Principals can update their references"
        on public.teacher_references
        for update
        using (principal_id = auth.uid())
        with check (principal_id = auth.uid())
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_references'
      and policyname = 'Principals can delete their references'
  ) then
    execute $policy$
      create policy "Principals can delete their references"
        on public.teacher_references
        for delete
        using (principal_id = auth.uid())
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_reference_requests'
      and policyname = 'Principals manage reference requests'
  ) then
    execute $policy$
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
        )
    $policy$;
  end if;
end $$;
