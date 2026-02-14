import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentMessagesScreen() {
  return (
    <K12StudentFeatureScreen
      title="Messages"
      subtitle="Stay connected with teachers and school updates."
      heroTitle="Need to ask a teacher quickly?"
      heroDescription="Start a guided Dash chat and prepare a clear question before sending."
      heroCta="Open Dash Chat"
      heroIcon="chatbubbles-outline"
      heroTone="purple"
      onHeroPress={() =>
        router.push('/screens/dash-assistant?source=k12_student&mode=tutor&tutorMode=explain' as any)
      }
      items={[
        { id: 'msg-1', title: 'English Teacher', subtitle: 'Essay feedback available', icon: 'mail-outline', tone: '#6366F1' },
        { id: 'msg-2', title: 'Math Teacher', subtitle: 'Homework reminder for tomorrow', icon: 'notifications-outline', tone: '#10B981' },
        { id: 'msg-3', title: 'School Office', subtitle: 'Exam timetable update posted', icon: 'megaphone-outline', tone: '#F59E0B' },
      ]}
    />
  );
}
