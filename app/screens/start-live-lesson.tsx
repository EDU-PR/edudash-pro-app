/**
 * Start Live Lesson Screen
 * 
 * Allows teachers to start group video lessons for their classes.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StartLiveLesson } from '@/components/calls/StartLiveLesson';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { DesktopLayout } from '@/components/layout/DesktopLayout';

export default function StartLiveLessonScreen() {
  const { profile } = useAuth();
  const { tier } = useSubscription();

  console.log('[StartLiveLessonScreen] Render with:', {
    profileId: profile?.id,
    preschoolId: profile?.preschool_id,
    organizationId: profile?.organization_id,
    tier,
    email: profile?.email,
  });

  const preschoolId = profile?.preschool_id || profile?.organization_id;

  if (!preschoolId) {
    return (
      <DesktopLayout role="teacher">
        <Stack.Screen 
          options={{ 
            headerShown: false,
            title: 'Start Live Lesson'
          }} 
        />
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Please link to a school to start live lessons
            </Text>
          </View>
        </View>
      </DesktopLayout>
    );
  }
  const teacherName = profile.first_name && profile.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : profile.email || 'Teacher';

  return (
    <DesktopLayout role="teacher">
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: 'Start Live Lesson'
        }} 
      />
      <View style={styles.container}>
        <StartLiveLesson
          preschoolId={preschoolId}
          teacherId={profile.id}
          teacherName={teacherName}
          subscriptionTier={tier}
        />
      </View>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
