import React from 'react';
import DashAssistant from '@/components/ai/DashAssistant';

export default function BrainstormRoomScreen() {
  return (
    <DashAssistant
      initialMessage="Brainstorm a weekly theme with daily routines, activities, and parent tips."
    />
  );
}
