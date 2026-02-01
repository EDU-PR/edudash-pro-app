import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import DashAssistant from '@/components/ai/DashAssistant';
import { useTheme } from '@/contexts/ThemeContext';

export default function BrainstormRoomScreen() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Dash AI Brainstorm', headerShown: false }} />
      <DashAssistant
        initialMessage="Brainstorm a weekly theme with daily routines, activities, and parent tips."
      />
    </View>
  );
}
