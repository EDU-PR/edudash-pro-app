import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentScheduleScreen() {
  return (
    <K12StudentFeatureScreen
      title="Schedule"
      subtitle="Daily timetable and upcoming periods."
      heroTitle="Prepare for your next period"
      heroDescription="Run a 5-minute Tutor warmup before class starts."
      heroCta="Start 5-Min Warmup"
      heroIcon="time-outline"
      heroTone="green"
      onHeroPress={() =>
        router.push('/screens/dash-assistant?mode=tutor&source=k12_student&tutorMode=practice' as any)
      }
      items={[
        { id: 'slot-1', title: '08:00 • Mathematics', subtitle: 'Room 201 • Mr. Johnson', icon: 'calculator-outline', tone: '#10B981' },
        { id: 'slot-2', title: '09:15 • English Literature', subtitle: 'Room 105 • Ms. Williams', icon: 'book-outline', tone: '#6366F1' },
        { id: 'slot-3', title: '11:00 • Physical Sciences', subtitle: 'Lab 3 • Dr. Smith', icon: 'flask-outline', tone: '#F59E0B' },
      ]}
    />
  );
}
