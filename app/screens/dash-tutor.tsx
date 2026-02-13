/**
 * Dash Tutor Screen
 *
 * Dedicated interactive tutoring screen with age-adaptive theming.
 * Provides a focused learning experience separate from the general
 * Dash AI chat. Adapts visuals, text size, mascot, and interaction
 * patterns to the learner's age band.
 *
 * Route: /screens/dash-tutor
 * Params:
 *   - mode?: TutorMode ('explain' | 'practice' | 'quiz' | 'play' | 'diagnostic')
 *   - subject?: string
 *   - grade?: string
 *   - initialMessage?: string
 *   - conversationId?: string
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import DashAssistant from '@/components/ai/DashAssistant';
import { getTutorTheme, isPreschoolBand } from '@/lib/dash-ai/tutorTheme';
import { resolveAgeBand } from '@/lib/dash-ai/learnerContext';
import { normalizeRole } from '@/lib/rbac';
import type { TutorMode } from '@/hooks/dash-assistant/tutorTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashTutorScreen() {
  const { theme: appTheme } = useTheme();
  const { profile, user } = useAuth();
  const params = useLocalSearchParams<{
    mode?: string;
    subject?: string;
    grade?: string;
    initialMessage?: string;
    conversationId?: string;
    ageBand?: string;
  }>();

  // Resolve age band from params, profile, or default
  const ageBand = useMemo(() => {
    if (params?.ageBand) return params.ageBand;
    // Try to get from profile metadata
    const ageYears = (profile as any)?.age_years ?? (profile as any)?.ageYears ?? null;
    const grade = params?.grade ?? (profile as any)?.grade ?? null;
    return resolveAgeBand(ageYears, grade) || '9-12';
  }, [params?.ageBand, params?.grade, profile]);

  const tutorTheme = useMemo(() => getTutorTheme(ageBand), [ageBand]);
  const isPreschool = isPreschoolBand(ageBand);

  // Build initial message based on mode
  const initialMessage = useMemo(() => {
    if (params?.initialMessage) return params.initialMessage;

    const mode = params?.mode as TutorMode | undefined;
    const subject = params?.subject || '';
    const grade = params?.grade || '';

    switch (mode) {
      case 'play':
        return "Let's play a learning game! 🎮";
      case 'practice':
        return subject
          ? `Let's practice ${subject}${grade ? ` for Grade ${grade}` : ''}`
          : "Let's practice! What subject?";
      case 'quiz':
        return subject
          ? `Quiz me on ${subject}${grade ? ` Grade ${grade}` : ''}`
          : 'Quiz me! What subject?';
      case 'diagnostic':
        return subject
          ? `Diagnose my ${subject} level${grade ? ` for Grade ${grade}` : ''}`
          : 'Check my level — diagnose me!';
      case 'explain':
        return subject
          ? `Explain ${subject}${grade ? ` at Grade ${grade} level` : ''}`
          : 'Teach me something! What topic?';
      default:
        return isPreschool
          ? "Hi Dash! Let's learn together! 🌟"
          : undefined;
    }
  }, [params?.initialMessage, params?.mode, params?.subject, params?.grade, isPreschool]);

  const conversationId = typeof params?.conversationId === 'string' ? params.conversationId : undefined;

  const getFallbackPath = useCallback(() => {
    const role = normalizeRole(String(profile?.role || ''));
    switch (role) {
      case 'teacher':
        return '/screens/teacher-dashboard';
      case 'principal':
      case 'principal_admin':
        return '/screens/principal-dashboard';
      case 'parent':
        return '/screens/parent-dashboard';
      case 'super_admin':
        return '/screens/super-admin-dashboard';
      default:
        return '/';
    }
  }, [profile?.role]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(getFallbackPath());
    }
  }, [getFallbackPath]);

  // Compute header title based on mode
  const headerTitle = useMemo(() => {
    const mode = params?.mode as TutorMode | undefined;
    switch (mode) {
      case 'play': return 'Play & Learn';
      case 'practice': return 'Practice';
      case 'quiz': return 'Quiz Time';
      case 'diagnostic': return 'Level Check';
      case 'explain': return 'Learn';
      default: return isPreschool ? 'Play & Learn' : 'Dash Tutor';
    }
  }, [params?.mode, isPreschool]);

  // Age-band badge
  const ageBadge = useMemo(() => {
    switch (ageBand) {
      case '3-5': return '👶 Ages 3-5';
      case '6-8': return '🧒 Grade R-3';
      case '9-12': return '📚 Grade 4-6';
      case '13-15': return '📖 Grade 7-9';
      case '16-18': return '🎓 Grade 10-12';
      default: return '';
    }
  }, [ageBand]);

  return (
    <View style={[styles.container, { backgroundColor: tutorTheme.colors.background }]}>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerShown: true,
          headerStyle: {
            backgroundColor: tutorTheme.colors.surface,
          },
          headerTitleStyle: {
            color: tutorTheme.colors.bubbleText,
            fontSize: tutorTheme.typography.headingSize - 4,
            fontWeight: '700',
          },
          headerTintColor: tutorTheme.colors.primary,
          headerRight: () => (
            <View style={styles.headerRight}>
              {ageBadge ? (
                <View style={[styles.ageBadge, { backgroundColor: tutorTheme.colors.primary + '18' }]}>
                  <Text style={[styles.ageBadgeText, { color: tutorTheme.colors.primary }]}>
                    {ageBadge}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />

      {/* Mascot greeting for preschool */}
      {tutorTheme.layout.showMascot && !conversationId && (
        <View style={[styles.mascotBanner, { backgroundColor: tutorTheme.colors.mascotGlow + '15' }]}>
          <Text style={styles.mascotEmoji}>{tutorTheme.mascot.emoji}</Text>
          <View style={styles.mascotTextWrap}>
            <Text
              style={[
                styles.mascotGreeting,
                {
                  color: tutorTheme.colors.bubbleText,
                  fontSize: tutorTheme.typography.bodySize,
                },
              ]}
            >
              {isPreschool
                ? "Hi there! I'm Dash! Let's play and learn together! 🌟"
                : `Hey! I'm ${tutorTheme.mascot.name}. Ready to learn?`}
            </Text>
          </View>
        </View>
      )}

      {/* Main chat area — re-uses DashAssistant with tutor context */}
      <View style={styles.chatArea}>
        <DashAssistant
          initialMessage={initialMessage}
          conversationId={conversationId}
          handoffSource="tutor"
          onClose={handleClose}
          tutorMode={(params?.mode as TutorMode) || null}
          tutorConfig={{
            subject: params?.subject,
            grade: params?.grade,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  ageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mascotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  mascotEmoji: {
    fontSize: 40,
  },
  mascotTextWrap: {
    flex: 1,
  },
  mascotGreeting: {
    fontWeight: '600',
    lineHeight: 24,
  },
  chatArea: {
    flex: 1,
  },
});
