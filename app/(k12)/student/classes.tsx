import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentClassesScreen() {
  // TODO: Fetch enrolled classes from course_enrollments table
  return (
    <K12StudentFeatureScreen
      title="Classes"
      subtitle="Track periods, rooms, and teacher notes."
      heroTitle="Need help before class?"
      heroDescription="Start Tutor Mode for a quick concept preview before your next lesson."
      heroCta="Open Tutor Session"
      heroIcon="school-outline"
      heroTone="green"
      onHeroPress={() =>
        router.push('/screens/dash-assistant?mode=tutor&source=k12_student&tutorMode=diagnostic' as any)
      }
      items={[]}
      emptyMessage="No classes enrolled yet. Ask your teacher to add you."
    />
  );
}
