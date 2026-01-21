/**
 * K-12 Route Group Layout
 * 
 * Layout for all K-12 school routes (parents, students, teachers)
 * This route group handles schools with school_type: k12, combined, primary, secondary, community_school
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function K12Layout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="parent/dashboard" options={{ title: 'Parent Dashboard' }} />
      <Stack.Screen name="student/dashboard" options={{ title: 'Student Dashboard' }} />
    </Stack>
  );
}
