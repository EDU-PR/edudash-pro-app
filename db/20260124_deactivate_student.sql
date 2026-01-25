-- Deactivate (soft-remove) a student from a school
-- Keeps historical data but hides the student from active lists

create or replace function public.deactivate_student(
  student_uuid uuid,
  reason text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean := false;
begin
  update public.students
  set
    is_active = false,
    status = 'inactive',
    class_id = null,
    updated_at = now(),
    notes = case
      when reason is null or reason = '' then notes
      when notes is null or notes = '' then reason
      else notes || ' | ' || reason
    end
  where id = student_uuid;

  get diagnostics v_updated = row_count > 0;
  return v_updated;
end;
$$;

grant execute on function public.deactivate_student(uuid, text) to authenticated, service_role;
