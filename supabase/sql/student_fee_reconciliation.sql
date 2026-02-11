-- Student tuition mismatch audit + correction runbook
--
-- Usage notes:
-- 1) Replace every occurrence of REPLACE_WITH_SCHOOL_ID with the target school UUID.
-- 2) Run Section A first (audit), then Section B.1 for targeted learner checks,
--    then Section B.2 for bulk correction only after verifying Section A results.
-- 3) Section B only updates unpaid tuition rows:
--    status in ('pending','overdue','partially_paid') and amount_paid = 0.

-- =====================================================================
-- Section A: Audit unresolved/mismatched tuition rows
-- =====================================================================
with active_students as (
  select
    s.id as student_id,
    trim(concat_ws(' ', s.first_name, s.last_name)) as student_name,
    s.date_of_birth,
    nullif(trim(s.grade_level), '') as grade_level,
    nullif(trim(coalesce(c.name, s.grade_level)), '') as class_label,
    coalesce(s.organization_id, s.preschool_id) as school_id
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.is_active = true
    and lower(coalesce(s.status, 'active')) = 'active'
    and coalesce(s.organization_id, s.preschool_id) = 'REPLACE_WITH_SCHOOL_ID'
),
tuition_structures as (
  select
    fs.id as fee_structure_id,
    fs.amount,
    fs.name,
    fs.description,
    fs.grade_levels,
    fs.effective_from,
    fs.created_at
  from public.fee_structures fs
  where fs.preschool_id = 'REPLACE_WITH_SCHOOL_ID'
    and fs.is_active = true
    and (
      lower(coalesce(fs.fee_type, '')) in ('tuition', 'school_fees', 'school_fee', 'monthly', 'monthly_fee')
      or lower(coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')) ~ 'tuition|school\\s*fee|monthly\\s*fee'
    )
),
candidate_matches as (
  select
    st.student_id,
    st.student_name,
    ts.fee_structure_id,
    ts.amount as expected_amount,
    case
      when st.grade_level is not null
        and exists (
          select 1
          from unnest(coalesce(ts.grade_levels, '{}')) gl
          where lower(trim(gl)) = lower(trim(st.grade_level))
        )
        then 1
      when st.class_label is not null
        and (
          lower(trim(coalesce(ts.name, ''))) = lower(trim(st.class_label))
          or lower(trim(coalesce(ts.description, ''))) = lower(trim(st.class_label))
          or exists (
            select 1
            from unnest(coalesce(ts.grade_levels, '{}')) gl
            where lower(trim(gl)) = lower(trim(st.class_label))
          )
        )
        then 2
      else null
    end as match_rank
  from active_students st
  cross join tuition_structures ts
),
best_rank as (
  select
    cm.student_id,
    min(cm.match_rank) as min_rank
  from candidate_matches cm
  where cm.match_rank is not null
  group by cm.student_id
),
ranked_matches as (
  select
    cm.student_id,
    cm.student_name,
    cm.fee_structure_id,
    cm.expected_amount,
    cm.match_rank,
    count(*) over (partition by cm.student_id, cm.match_rank) as rank_count
  from candidate_matches cm
  join best_rank br
    on br.student_id = cm.student_id
   and br.min_rank = cm.match_rank
),
expected_tuition as (
  select
    rm.student_id,
    rm.student_name,
    rm.fee_structure_id,
    rm.expected_amount,
    case when rm.rank_count = 1 then 'matched' else 'ambiguous' end as resolver_status,
    rm.match_rank
  from ranked_matches rm
),
unresolved_students as (
  select
    st.student_id,
    st.student_name,
    case
      when br.student_id is null then 'unmatched'
      when exists (
        select 1
        from ranked_matches rm
        where rm.student_id = st.student_id
          and rm.rank_count > 1
      ) then 'ambiguous'
      else 'matched'
    end as resolver_status
  from active_students st
  left join best_rank br on br.student_id = st.student_id
),
eligible_student_fees as (
  select
    sf.id as student_fee_id,
    sf.student_id,
    sf.fee_structure_id as current_fee_structure_id,
    sf.final_amount as current_amount,
    sf.amount_paid,
    sf.amount_outstanding,
    sf.status
  from public.student_fees sf
  left join public.fee_structures fs on fs.id = sf.fee_structure_id
  where sf.status in ('pending', 'overdue', 'partially_paid')
    and coalesce(sf.amount_paid, 0) = 0
    and (
      lower(coalesce(sf.category_code, '')) = 'tuition'
      or lower(coalesce(fs.fee_type, '')) in ('tuition', 'school_fees', 'school_fee', 'monthly', 'monthly_fee')
      or lower(coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')) ~ 'tuition|school\\s*fee|monthly\\s*fee'
    )
)
select
  esf.student_fee_id,
  esf.student_id,
  coalesce(et.student_name, us.student_name) as student_name,
  esf.current_fee_structure_id,
  esf.current_amount,
  et.fee_structure_id as expected_fee_structure_id,
  et.expected_amount,
  coalesce(et.resolver_status, us.resolver_status, 'unmatched') as resolver_status,
  case
    when et.student_id is null then 'no deterministic tuition match'
    when abs(esf.current_amount - et.expected_amount) > 0.01 then 'amount_mismatch'
    else 'ok'
  end as audit_outcome
from eligible_student_fees esf
left join expected_tuition et
  on et.student_id = esf.student_id
 and et.resolver_status = 'matched'
left join unresolved_students us
  on us.student_id = esf.student_id
where et.student_id is null
   or abs(esf.current_amount - et.expected_amount) > 0.01
order by student_name, esf.student_fee_id;

-- =====================================================================
-- Section B.1: Targeted verification for one learner first
-- Example: Puseletso Hlalethwa
-- =====================================================================
with audit as (
  select *
  from (
    with active_students as (
      select
        s.id as student_id,
        trim(concat_ws(' ', s.first_name, s.last_name)) as student_name,
        s.date_of_birth,
        nullif(trim(s.grade_level), '') as grade_level,
        nullif(trim(coalesce(c.name, s.grade_level)), '') as class_label,
        coalesce(s.organization_id, s.preschool_id) as school_id
      from public.students s
      left join public.classes c on c.id = s.class_id
      where s.is_active = true
        and lower(coalesce(s.status, 'active')) = 'active'
        and coalesce(s.organization_id, s.preschool_id) = 'REPLACE_WITH_SCHOOL_ID'
    ),
    tuition_structures as (
      select fs.id as fee_structure_id, fs.amount, fs.name, fs.description, fs.grade_levels
      from public.fee_structures fs
      where fs.preschool_id = 'REPLACE_WITH_SCHOOL_ID'
        and fs.is_active = true
        and (
          lower(coalesce(fs.fee_type, '')) in ('tuition', 'school_fees', 'school_fee', 'monthly', 'monthly_fee')
          or lower(coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')) ~ 'tuition|school\\s*fee|monthly\\s*fee'
        )
    ),
    candidate_matches as (
      select
        st.student_id,
        st.student_name,
        ts.fee_structure_id,
        ts.amount as expected_amount,
        case
          when st.grade_level is not null
            and exists (
              select 1
              from unnest(coalesce(ts.grade_levels, '{}')) gl
              where lower(trim(gl)) = lower(trim(st.grade_level))
            ) then 1
          when st.class_label is not null
            and (
              lower(trim(coalesce(ts.name, ''))) = lower(trim(st.class_label))
              or lower(trim(coalesce(ts.description, ''))) = lower(trim(st.class_label))
              or exists (
                select 1
                from unnest(coalesce(ts.grade_levels, '{}')) gl
                where lower(trim(gl)) = lower(trim(st.class_label))
              )
            ) then 2
          else null
        end as match_rank
      from active_students st
      cross join tuition_structures ts
    ),
    best_rank as (
      select student_id, min(match_rank) as min_rank
      from candidate_matches
      where match_rank is not null
      group by student_id
    ),
    ranked_matches as (
      select
        cm.student_id,
        cm.student_name,
        cm.fee_structure_id,
        cm.expected_amount,
        cm.match_rank,
        count(*) over (partition by cm.student_id, cm.match_rank) as rank_count
      from candidate_matches cm
      join best_rank br on br.student_id = cm.student_id and br.min_rank = cm.match_rank
    )
    select
      rm.student_id,
      rm.student_name,
      rm.fee_structure_id,
      rm.expected_amount,
      case when rm.rank_count = 1 then 'matched' else 'ambiguous' end as resolver_status
    from ranked_matches rm
  ) q
)
select *
from audit
where student_name ilike 'Puseletso Hlalethwa%';

-- =====================================================================
-- Section B.2: Bulk correction for unpaid tuition rows only
-- =====================================================================
with active_students as (
  select
    s.id as student_id,
    trim(concat_ws(' ', s.first_name, s.last_name)) as student_name,
    nullif(trim(s.grade_level), '') as grade_level,
    nullif(trim(coalesce(c.name, s.grade_level)), '') as class_label
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.is_active = true
    and lower(coalesce(s.status, 'active')) = 'active'
    and coalesce(s.organization_id, s.preschool_id) = 'REPLACE_WITH_SCHOOL_ID'
),
tuition_structures as (
  select fs.id as fee_structure_id, fs.amount, fs.name, fs.description, fs.grade_levels
  from public.fee_structures fs
  where fs.preschool_id = 'REPLACE_WITH_SCHOOL_ID'
    and fs.is_active = true
    and (
      lower(coalesce(fs.fee_type, '')) in ('tuition', 'school_fees', 'school_fee', 'monthly', 'monthly_fee')
      or lower(coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')) ~ 'tuition|school\\s*fee|monthly\\s*fee'
    )
),
candidate_matches as (
  select
    st.student_id,
    st.student_name,
    ts.fee_structure_id,
    ts.amount as expected_amount,
    case
      when st.grade_level is not null
        and exists (
          select 1
          from unnest(coalesce(ts.grade_levels, '{}')) gl
          where lower(trim(gl)) = lower(trim(st.grade_level))
        ) then 1
      when st.class_label is not null
        and (
          lower(trim(coalesce(ts.name, ''))) = lower(trim(st.class_label))
          or lower(trim(coalesce(ts.description, ''))) = lower(trim(st.class_label))
          or exists (
            select 1
            from unnest(coalesce(ts.grade_levels, '{}')) gl
            where lower(trim(gl)) = lower(trim(st.class_label))
          )
        ) then 2
      else null
    end as match_rank
  from active_students st
  cross join tuition_structures ts
),
best_rank as (
  select student_id, min(match_rank) as min_rank
  from candidate_matches
  where match_rank is not null
  group by student_id
),
ranked_matches as (
  select
    cm.student_id,
    cm.student_name,
    cm.fee_structure_id,
    cm.expected_amount,
    count(*) over (partition by cm.student_id, cm.match_rank) as rank_count
  from candidate_matches cm
  join best_rank br on br.student_id = cm.student_id and br.min_rank = cm.match_rank
),
expected_tuition as (
  select
    rm.student_id,
    rm.student_name,
    rm.fee_structure_id,
    rm.expected_amount
  from ranked_matches rm
  where rm.rank_count = 1
),
target_rows as (
  select
    sf.id as student_fee_id,
    sf.student_id,
    et.student_name,
    sf.fee_structure_id as old_fee_structure_id,
    sf.final_amount as old_amount,
    et.fee_structure_id as new_fee_structure_id,
    et.expected_amount as new_amount
  from public.student_fees sf
  join expected_tuition et on et.student_id = sf.student_id
  left join public.fee_structures fs on fs.id = sf.fee_structure_id
  where sf.status in ('pending', 'overdue', 'partially_paid')
    and coalesce(sf.amount_paid, 0) = 0
    and (
      lower(coalesce(sf.category_code, '')) = 'tuition'
      or lower(coalesce(fs.fee_type, '')) in ('tuition', 'school_fees', 'school_fee', 'monthly', 'monthly_fee')
      or lower(coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')) ~ 'tuition|school\\s*fee|monthly\\s*fee'
    )
    and abs(sf.final_amount - et.expected_amount) > 0.01
),
updated as (
  update public.student_fees sf
  set
    fee_structure_id = tr.new_fee_structure_id,
    amount = tr.new_amount,
    final_amount = tr.new_amount,
    amount_outstanding = tr.new_amount,
    updated_at = now()
  from target_rows tr
  where sf.id = tr.student_fee_id
  returning
    sf.id as student_fee_id,
    tr.student_id,
    tr.student_name,
    tr.old_fee_structure_id,
    tr.new_fee_structure_id,
    tr.old_amount,
    tr.new_amount
)
insert into public.audit_logs (
  action,
  event_type,
  event_name,
  event_description,
  target_id,
  target_name,
  target_type,
  resource_id,
  resource_type,
  changes_made,
  metadata,
  success,
  occurred_at
)
select
  'correct_fee_assignment' as action,
  'admin_action' as event_type,
  'correct_fee_assignment' as event_name,
  'Corrected unpaid tuition amount from reconciliation runbook' as event_description,
  u.student_id as target_id,
  u.student_name as target_name,
  'student' as target_type,
  u.student_fee_id as resource_id,
  'student_fees' as resource_type,
  jsonb_build_object(
    'old_fee_structure_id', u.old_fee_structure_id,
    'new_fee_structure_id', u.new_fee_structure_id,
    'old_amount', u.old_amount,
    'new_amount', u.new_amount
  ) as changes_made,
  jsonb_build_object(
    'source', 'student_fee_reconciliation_sql',
    'school_id', 'REPLACE_WITH_SCHOOL_ID'
  ) as metadata,
  true as success,
  now() as occurred_at
from updated u;
