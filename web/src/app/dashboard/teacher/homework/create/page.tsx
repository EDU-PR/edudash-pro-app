'use client';

import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { TeacherComingSoon } from '@/components/dashboard/teacher/TeacherComingSoon';
import { FileText } from 'lucide-react';

export default function CreateHomeworkPage() {
  return (
    <TeacherShell hideHeader>
      <TeacherComingSoon
        title="Create Homework"
        description="Create homework assignments with AI assistance. Set due dates, attach resources, and assign to specific classes or student groups."
        icon={FileText}
      />
    </TeacherShell>
  );
}
