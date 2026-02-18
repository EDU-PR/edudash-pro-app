/**
 * Dash AI Assistant Screen
 * 
 * Screen wrapper for the Dash AI Assistant component that integrates
 * with the app's navigation and provides a full-screen chat experience.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import DashAssistant from '@/components/ai/DashAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/rbac';
import { resolveDashboardFallback } from '@/lib/dashboard/resolveDashboardFallback';
import type { TutorMode } from '@/hooks/dash-assistant/tutorTypes';

export default function DashAssistantScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    initialMessage?: string;
    conversationId?: string;
    source?: string;
    mode?: string;
    tutorMode?: string;
    subject?: string;
    grade?: string;
    topic?: string;
  }>();
  const initialMessage = typeof params?.initialMessage === 'string' ? params.initialMessage : undefined;
  const conversationId = typeof params?.conversationId === 'string' ? params.conversationId : undefined;
  const handoffSource = typeof params?.source === 'string' ? params.source : undefined;
  const isK12ParentDashSource = handoffSource === 'k12_parent_tab';
  const mode = typeof params?.mode === 'string' ? params.mode.toLowerCase() : undefined;
  const tutorMode = (typeof params?.tutorMode === 'string' ? params.tutorMode.toLowerCase() : null) as TutorMode | null;
  const tutorConfig = {
    subject: typeof params?.subject === 'string' ? params.subject : undefined,
    grade: typeof params?.grade === 'string' ? params.grade : undefined,
    topic: typeof params?.topic === 'string' ? params.topic : undefined,
  };
  const hasTutorConfig = Boolean(tutorConfig.subject || tutorConfig.grade || tutorConfig.topic);
  const shouldForceTutorMode = !isK12ParentDashSource && (mode === 'tutor' || !!tutorMode);
  const uiMode: 'advisor' | 'tutor' | 'orb' | 'exam' | null =
    isK12ParentDashSource
      ? 'advisor'
      : mode === 'advisor' || mode === 'orb' || mode === 'tutor' || mode === 'exam'
        ? mode
        : null;

  const handleClose = () => {
    // Navigate back to the previous screen
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(resolveDashboardFallback(profile) as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }} 
      />
      
      <DashAssistant 
        onClose={handleClose}
        initialMessage={initialMessage}
        conversationId={conversationId}
        handoffSource={handoffSource}
        uiMode={uiMode}
        tutorMode={shouldForceTutorMode ? (tutorMode || 'diagnostic') : null}
        tutorConfig={hasTutorConfig ? tutorConfig : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
