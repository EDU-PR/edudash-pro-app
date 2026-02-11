import { redirect } from 'next/navigation';

export default function TeacherInteractiveActivitiesAliasPage() {
  redirect('/dashboard/teacher/lessons/create?mode=quick');
}
