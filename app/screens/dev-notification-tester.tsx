/**
 * Dev Notification Tester Screen
 * 
 * Full-screen view for testing push notifications
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { DevNotificationTester } from '@/components/dev/DevNotificationTester';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DevNotificationTesterScreen() {
  const insets = useSafeAreaInsets();

  // Only show in dev mode
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      <DevNotificationTester />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});
