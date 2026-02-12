'use client';

import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { TeacherComingSoon } from '@/components/dashboard/teacher/TeacherComingSoon';
import { Users2 } from 'lucide-react';

export default function GroupsPage() {
  return (
    <TeacherShell hideHeader>
      <TeacherComingSoon
        title="Groups"
        description="Create and manage student groups for differentiated instruction, collaborative activities, and targeted communication with parents."
        icon={Users2}
      />
    </TeacherShell>
  );
}
