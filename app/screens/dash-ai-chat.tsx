/**
 * Dash AI Chat Screen - Full ChatGPT-Style Interface
 * 
 * This is a dedicated screen for the Dash AI assistant with:
 * - Full chat interface with markdown rendering
 * - Voice input/output via VoiceOrb
 * - Tool execution feedback
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import DashAIChat from '@/components/super-admin/DashAIChat';
import { isSuperAdmin } from '@/lib/roleUtils';

export default function DashAIChatScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isAllowed = isSuperAdmin(profile?.role || '');

  if (!isAllowed) {
    return (
      <View style={[styles.deniedContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Dash AI Ops Chat',
            headerShown: false,
          }}
        />
        <Text style={[styles.deniedText, { color: theme.textSecondary }]}>Access denied</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Dash AI Ops Chat',
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
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deniedText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
