import React from 'react';
import { Stack } from 'expo-router';
import TeacherDashboardWrapper from '@/components/dashboard/TeacherDashboardWrapper';
import { DesktopLayout } from '@/components/layout/DesktopLayout';

export default function TeacherDashboardScreen() {
  return (
    <DesktopLayout role="teacher">
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />
      <TeacherDashboardWrapper />
    </DesktopLayout>
  );
}
