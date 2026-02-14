import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentAssignmentsScreen() {
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
      items={[
        { id: 'asg-1', title: 'Math Worksheet: Fractions', subtitle: 'Due tomorrow • 3 questions left', icon: 'document-text-outline', tone: '#10B981' },
        { id: 'asg-2', title: 'English Essay Draft', subtitle: 'Due Mar 15 • In progress', icon: 'create-outline', tone: '#6366F1' },
        { id: 'asg-3', title: 'Science Lab Reflection', subtitle: 'Due Mar 18 • Not started', icon: 'flask-outline', tone: '#F59E0B' },
      ]}
    />
  );
}
