import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import ThemedStatusBar from '../../components/ui/ThemedStatusBar';

export default function ScreensLayout() {
  const { theme } = useTheme();
  
  return (
    <>
      <ThemedStatusBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          presentation: 'card',
          animationTypeForReplace: 'push',
          headerTitle: '',
          // Workaround: Android New Architecture + react-native-screens ScreenStack
          // can crash with IndexOutOfBoundsException during animated transitions.
          // Use simple fade to avoid the drawing-order race condition.
          ...(Platform.OS === 'android' ? { animation: 'fade', animationDuration: 200 } : {}),
        }}
      >
        {/* Let expo-router auto-register child routes; each screen renders its own RoleBasedHeader */}
      </Stack>
    </>
  );
}
