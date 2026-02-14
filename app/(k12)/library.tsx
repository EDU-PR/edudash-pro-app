import React from 'react';
import { router } from 'expo-router';
import { K12StudentFeatureScreen } from '@/domains/k12/components/K12StudentFeatureScreen';

export default function K12LibraryScreen() {
  return (
    <K12StudentFeatureScreen
      title="Library"
      subtitle="Study resources, notes, and revision packs."
      heroTitle="Generate a revision pack"
      heroDescription="Ask Dash Tutor to build a targeted practice set from your current topic."
      heroCta="Create Revision Pack"
      heroIcon="library-outline"
      heroTone="purple"
      onHeroPress={() =>
        router.push('/screens/dash-assistant?mode=tutor&source=k12_student&tutorMode=practice' as any)
      }
      items={[
        { id: 'lib-1', title: 'Mathematics Formula Sheet', subtitle: 'Algebra + Geometry quick reference', icon: 'document-attach-outline', tone: '#10B981' },
        { id: 'lib-2', title: 'English Writing Guide', subtitle: 'Essay structure and examples', icon: 'book-outline', tone: '#6366F1' },
        { id: 'lib-3', title: 'Science Concepts Pack', subtitle: 'Energy, forces, and experiments', icon: 'flask-outline', tone: '#F59E0B' },
      ]}
    />
  );
}
