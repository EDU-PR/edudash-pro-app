import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentClassesScreen() {
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
      items={[
        { id: 'math', title: 'Mathematics', subtitle: '08:00 - 09:00 • Room 201 • Mr. Johnson', icon: 'calculator-outline', tone: '#10B981' },
        { id: 'english', title: 'English Literature', subtitle: '09:15 - 10:15 • Room 105 • Ms. Williams', icon: 'book-outline', tone: '#6366F1' },
        { id: 'science', title: 'Physical Sciences', subtitle: '11:00 - 12:00 • Lab 3 • Dr. Smith', icon: 'flask-outline', tone: '#F59E0B' },
      ]}
    />
  );
}
