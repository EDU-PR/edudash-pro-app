-- Add deactivate_student RPC for soft-removing a student
-- Marks student inactive and removes class assignment

create or replace function public.deactivate_student(student_uuid uuid, reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.students
  set is_active = false,
      status = 'inactive',
      class_id = null,
      notes = case
        when reason is null or reason = '' then notes
        when notes is null or notes = '' then reason
        else notes || ' | ' || reason
      end,
      updated_at = now()
  where id = student_uuid;

  return true;
end;
$$;

grant execute on function public.deactivate_student(uuid, text) to authenticated, service_role;
