'use client';

import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { TeacherComingSoon } from '@/components/dashboard/teacher/TeacherComingSoon';
import { Video } from 'lucide-react';

export default function LiveLessonPage() {
  return (
    <TeacherShell hideHeader>
      <TeacherComingSoon
        title="Live Lesson"
        description="Start a live lesson session with your class. Share your screen, use the interactive whiteboard, and engage students in real-time."
        icon={Video}
      />
    </TeacherShell>
  );
}
