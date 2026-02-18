import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentGradesScreen() {
  // TODO: Aggregate grades from assignment_submissions grouped by subject
  return (
    <K12StudentFeatureScreen
      title="Grades"
      subtitle="Monitor subject performance and growth."
      heroTitle="Improve weak topics fast"
      heroDescription="Use Tutor Mode to target low-scoring concepts with adaptive questions."
      heroCta="Open Diagnostic Tutor"
      heroIcon="ribbon-outline"
      heroTone="purple"
      onHeroPress={() =>
        router.push('/screens/dash-assistant?mode=tutor&source=k12_student&tutorMode=diagnostic' as any)
      }
      items={[]}
      emptyMessage="No grades available yet. Complete some assignments first!"
    />
  );
}
