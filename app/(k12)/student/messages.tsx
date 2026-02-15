import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12StudentMessagesScreen() {
  // TODO: Fetch messages/notifications for student from messages table
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
      items={[]}
      emptyMessage="No messages yet."
    />
  );
}
