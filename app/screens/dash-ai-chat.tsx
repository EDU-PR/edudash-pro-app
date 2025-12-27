/**
 * Dash AI Chat Screen - Full ChatGPT-Style Interface
 * 
 * This is a dedicated screen for the Dash AI assistant with:
 * - Full chat interface with markdown rendering
 * - Voice input/output via VoiceOrb
 * - Tool execution feedback
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import DashAIChat from '@/components/super-admin/DashAIChat';

export default function DashAIChatScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Dash AI Assistant',
          headerShown: false,
        }}
      />
      <DashAIChat />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
