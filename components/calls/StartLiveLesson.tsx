/**
 * Start Live Lesson (React Native)
 * Main component - orchestrates UI modules and business logic
 */

import React from 'react';
import { View, ActivityIndicator, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LiveLessonHero } from './live-lesson/LiveLessonHero';
import { ExistingCallBanner } from './live-lesson/ExistingCallBanner';
import { StartLessonModal } from './live-lesson/StartLessonModal';
import { useStartLessonLogic } from './live-lesson/useStartLessonLogic';

interface StartLiveLessonProps {
  preschoolId: string;
  teacherId: string;
  teacherName: string;
  subscriptionTier?: string;
}

export function StartLiveLesson({
  preschoolId,
  teacherId,
  teacherName,
  subscriptionTier = 'starter',
}: StartLiveLessonProps) {
  console.log('[StartLiveLesson] Component render with props:', {
    preschoolId,
    teacherId,
    teacherName,
    subscriptionTier,
  });

  const systemColorScheme = useColorScheme();
  const { isDark: themeIsDark } = useTheme();
  const isDark = themeIsDark ?? systemColorScheme === 'dark';

  const logic = useStartLessonLogic(preschoolId, teacherId, teacherName, subscriptionTier);
  
  console.log('[StartLiveLesson] Logic state:', {
    loading: logic.loading,
    classesCount: logic.classes.length,
    tierLabel: logic.tierConfig.label,
    tierBadge: logic.tierConfig.badge,
  });

  // Theme colors
  const colors = {
    background: isDark ? '#0f172a' : '#f8fafc',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    modalBg: isDark ? '#1a1a2e' : '#ffffff',
    inputBg: isDark ? '#27272a' : '#f1f5f9',
    inputBorder: isDark ? '#3f3f46' : '#cbd5e1',
    inputFocusBorder: '#7c3aed',
    text: isDark ? '#fafafa' : '#0f172a',
    textMuted: isDark ? '#a1a1aa' : '#64748b',
    textDimmed: isDark ? '#71717a' : '#94a3b8',
    gradient: ['#7c3aed', '#db2777'],
    accent: '#7c3aed',
    accentLight: isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)',
    border: isDark ? '#3f3f46' : '#e2e8f0',
    error: '#dc2626',
    errorBg: isDark ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
    white: '#ffffff',
    whiteAlpha: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  };

  if (logic.loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Card */}
      <LiveLessonHero
        classCount={logic.classes.length}
        maxDuration={logic.tierConfig.label}
        badge={logic.tierConfig.badge}
        onStartPress={() => logic.setShowModal(true)}
        disabled={logic.classes.length === 0}
      />

      {/* Existing Call Banner */}
      {logic.existingCall && (
        <ExistingCallBanner
          title={logic.existingCall.title}
          className={logic.existingCall.className}
          onRejoin={logic.handleRejoinCall}
          onEnd={logic.handleEndExistingCall}
          isRejoining={logic.isRejoining}
          colors={colors}
        />
      )}

      {/* Modal */}
      <StartLessonModal
        visible={logic.showModal}
        onClose={() => logic.setShowModal(false)}
        onSubmit={logic.handleStartLesson}
        lessonTitle={logic.lessonTitle}
        setLessonTitle={logic.setLessonTitle}
        selectedClass={logic.selectedClass}
        setSelectedClass={logic.setSelectedClass}
        classes={logic.classes}
        isScheduled={logic.isScheduled}
        setIsScheduled={logic.setIsScheduled}
        scheduledDate={logic.scheduledDate}
        setScheduledDate={logic.setScheduledDate}
        scheduledTime={logic.scheduledTime}
        setScheduledTime={logic.setScheduledTime}
        sendReminders={logic.sendReminders}
        setSendReminders={logic.setSendReminders}
        customDuration={logic.customDuration}
        setCustomDuration={logic.setCustomDuration}
        durationOptions={logic.durationOptions}
        maxDurationMinutes={logic.maxDurationMinutes}
        tierBadge={logic.tierConfig.badge}
        tierLabel={logic.tierConfig.label}
        isCreating={logic.isCreating}
        error={logic.error}
        colors={colors}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
