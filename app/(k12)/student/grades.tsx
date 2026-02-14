import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentGradesScreen() {
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
      items={[
        { id: 'grade-math', title: 'Mathematics: 78%', subtitle: 'Up 6% from last month', icon: 'trending-up-outline', tone: '#10B981' },
        { id: 'grade-eng', title: 'English: 72%', subtitle: 'Stable performance • Focus on essays', icon: 'text-outline', tone: '#6366F1' },
        { id: 'grade-sci', title: 'Physical Sciences: 64%', subtitle: 'Needs practice • Try guided revision', icon: 'flash-outline', tone: '#F59E0B' },
      ]}
    />
  );
}
