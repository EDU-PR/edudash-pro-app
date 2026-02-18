/**
 * K-12 Route Group Layout
 * 
 * Layout for all K-12 school routes (parents, students, teachers)
 * This route group handles schools with school_type: k12, combined, primary, secondary, community_school
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { K12NextGenThemeProvider } from '@/contexts/K12NextGenThemeContext';
import { createNextGenTheme } from '@/contexts/theme/nextGenVariant';

export default function K12Layout() {
  const { theme, isDark } = useTheme();
  const nextGenTheme = createNextGenTheme(theme, isDark);

  return (
    <K12NextGenThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: nextGenTheme.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="parent/dashboard" options={{ title: 'Parent Dashboard' }} />
        <Stack.Screen name="student/dashboard" options={{ title: 'Student Dashboard' }} />
      </Stack>
    </K12NextGenThemeProvider>
  );
}
