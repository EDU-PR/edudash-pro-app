import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';
import { useStudentAssignments } from '@/hooks/k12/useStudentAssignments';

export default function K12StudentAssignmentsScreen() {
  const { items, loading } = useStudentAssignments();

  return (
    <K12StudentFeatureScreen
      title="Assignments"
      subtitle="Stay on top of due dates and completion."
      heroTitle="Turn homework into guided practice"
      heroDescription="Dash Tutor can break tasks into steps and quiz you before submission."
      heroCta="Start Tutor Practice"
      heroIcon="checkmark-done-outline"
      heroTone="green"
      onHeroPress={() =>
        router.push('/screens/dash-assistant?mode=tutor&source=k12_student&tutorMode=practice' as any)
      }
      items={items}
      loading={loading}
      emptyMessage="No assignments yet. Check back later!"
    />
  );
}
