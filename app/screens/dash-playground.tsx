/**
 * Dash Playground — Interactive Learning Activities for 3-5 Year Olds
 *
 * The fun entry point for parents to try Dash-powered activities with their kids.
 * Features:
 * - Domain-grouped activity cards (Numeracy, Literacy, Science, Movement, Cognitive)
 * - Interactive game player with emoji-based rounds
 * - Star ratings and completion celebration
 * - Seamless handoff to Dash AI for follow-up conversation
 * - Tier-gated activities with upgrade prompts
 * - Child switcher for multi-child families
 * - Voice integration — Dash speaks prompts and celebrations
 *
 * Screen limit: ≤500 lines (WARP.md)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { assertSupabase } from '@/lib/supabase';
import { ChildSwitcher } from '@/components/dashboard/parent';
import { ActivityPlayer } from '@/components/activities/ActivityPlayer';
import { ActivityComplete } from '@/components/activities/ActivityComplete';
import { useKidVoice } from '@/hooks/useKidVoice';
import { track } from '@/lib/analytics';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import {
  PRESCHOOL_ACTIVITIES,
  DOMAIN_LABELS,
  getActivitiesGroupedByDomain,
} from '@/lib/activities/preschoolActivities.data';
import type { PreschoolActivity, ActivityResult } from '@/lib/activities/preschoolActivities.types';

type TierKey = 'free' | 'starter' | 'plus';

const normalizeTier = (tierRaw?: string | null): TierKey => {
  const capTier = getCapabilityTier(normalizeTierName(tierRaw || 'free'));
  if (capTier === 'premium' || capTier === 'enterprise') return 'plus';
  if (capTier === 'starter') return 'starter';
  return 'free';
};

const TIER_RANK: Record<TierKey, number> = { free: 0, starter: 1, plus: 2 };

const mapDomainToSubject = (domain?: string): string => {
  switch ((domain || '').toLowerCase()) {
    case 'numeracy':
      return 'mathematics';
    case 'literacy':
      return 'reading';
    case 'science':
      return 'science';
    case 'movement':
      return 'physical_education';
    case 'cognitive':
    default:
      return 'life_skills';
  }
};

export default function DashPlaygroundScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { data, loading } = useParentDashboard();

  const tierKey = normalizeTier(tier);
  const grouped = useMemo(() => getActivitiesGroupedByDomain(), []);
  const { speak, speakIntro, speakCelebration, stop: stopSpeech, isSpeaking } = useKidVoice({ tier });

  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [activeActivity, setActiveActivity] = useState<PreschoolActivity | null>(null);
  const [activityResult, setActivityResult] = useState<ActivityResult | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const children = useMemo(() => data?.children || [], [data?.children]);
  const activeChild = useMemo(
    () => children.find((c: any) => c.id === activeChildId) || children[0],
    [children, activeChildId],
  );

  useEffect(() => {
    if (children.length > 0 && !activeChildId) {
      setActiveChildId(children[0].id);
    }
  }, [children, activeChildId]);

  const hasTierAccess = useCallback(
    (required?: string | null) => {
      if (!required) return true;
      return TIER_RANK[tierKey] >= TIER_RANK[required as TierKey];
    },
    [tierKey],
  );

  const handleStartActivity = (activity: PreschoolActivity) => {
    if (!hasTierAccess(activity.requiresTier)) {
      router.push('/screens/subscription-setup' as any);
      return;
    }
    track('playground.activity_started', { activityId: activity.id, domain: activity.domain });
    setActiveActivity(activity);
    setActivityResult(null);
    // Dash speaks the intro when activity opens
    if (activity.dashIntro) {
      speakIntro(activity.dashIntro);
    }
  };

  const handleComplete = (result: ActivityResult) => {
    if (activeActivity && activeChild?.id && user?.id) {
      const score = result.totalRounds > 0
        ? Math.round((result.correctAnswers / result.totalRounds) * 100)
        : 0;
      const learnerSummary = [
        `${activeChild.firstName || 'Child'} completed ${activeActivity.title}.`,
        `Correct answers: ${result.correctAnswers}/${result.totalRounds}.`,
        `Time spent: ${result.timeSpentSeconds}s.`,
      ].join(' ');

      void (async () => {
        try {
          const { error } = await assertSupabase()
            .from('dash_ai_tutor_attempts')
            .insert({
              user_id: user.id,
              student_id: String(activeChild.id),
              mode: 'practice',
              subject: 'family_activity',
              grade: activeChild.grade || null,
              topic: activeActivity.title,
              question: activeActivity.learningObjective || activeActivity.subtitle || null,
              learner_answer: learnerSummary,
              score,
              feedback: result.stars >= 3
                ? 'Excellent completion'
                : result.stars === 2
                  ? 'Good completion with room to improve'
                  : 'Completed with support needed',
              is_correct: result.stars >= 2,
              metadata: {
                source: 'dash_playground_activity',
                activity_id: activeActivity.id,
                activity_domain: activeActivity.domain,
                activity_skills: activeActivity.skills,
                stars: result.stars,
                used_hints: result.usedHints,
                completed_at: result.completedAt,
              },
            });
          if (error) {
            console.warn('[DashPlayground] Failed to persist completion record:', error.message);
          }
        } catch (error) {
          console.warn('[DashPlayground] Completion persistence error:', error);
        }
      })();
    }

    track('playground.activity_completed', {
      activityId: result.activityId,
      stars: result.stars,
      correctAnswers: result.correctAnswers,
      timeSpent: result.timeSpentSeconds,
    });
    setActivityResult(result);
  };

  const handleContinueWithDash = () => {
    if (!activeActivity?.dashFollowUp) return;
    const childName = activeChild?.firstName || 'my child';
    const prompt = `${activeActivity.dashFollowUp} Their name is ${childName}.`;
    stopSpeech();
    setActiveActivity(null);
    setActivityResult(null);
    router.push({ pathname: '/screens/dash-assistant', params: { initialMessage: prompt } });
  };

  const handlePlayAgain = () => {
    setActivityResult(null);
  };

  const handleCloseActivity = () => {
    stopSpeech();
    setActiveActivity(null);
    setActivityResult(null);
  };

  const handleUploadAndGrade = () => {
    if (!activeActivity || !activeChild?.id) return;
    const childName = `${activeChild.firstName || ''} ${activeChild.lastName || ''}`.trim()
      || activeChild.firstName
      || 'Child';
    const gradeLevel = activeChild.grade || 'Age 5';
    const subject = mapDomainToSubject(activeActivity.domain);
    const title = `${activeActivity.title} - Family Activity`;
    const description = `We completed ${activeActivity.title} together at home. ${activeActivity.learningObjective}`;
    const learningArea = activeActivity.skills?.slice(0, 2).join(', ') || activeActivity.domain;

    stopSpeech();
    setActiveActivity(null);
    setActivityResult(null);
    router.push({
      pathname: '/screens/parent-picture-of-progress',
      params: {
        studentId: String(activeChild.id),
        studentName: encodeURIComponent(childName),
        prefillTitle: encodeURIComponent(title),
        prefillDescription: encodeURIComponent(description),
        prefillSubject: encodeURIComponent(subject),
        prefillLearningArea: encodeURIComponent(learningArea),
        nextStep: 'grade',
        gradeLevel: encodeURIComponent(gradeLevel),
        assignmentTitle: encodeURIComponent(`${activeActivity.title} Review`),
        submissionTemplate: encodeURIComponent(`${childName} completed ${activeActivity.title}. Add what they did, where they found it easy/hard, and what they learned.`),
        contextTag: encodeURIComponent('family_activity'),
        sourceFlow: encodeURIComponent('dash_playground'),
        activityId: encodeURIComponent(activeActivity.id),
        activityTitle: encodeURIComponent(activeActivity.title),
      },
    } as any);
  };

  const displayDomains = useMemo(() => {
    if (!filter) return Object.keys(grouped);
    return [filter];
  }, [filter, grouped]);

  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets]);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Dash Playground</Text>
            <Text style={styles.subtitle}>
              Fun activities for {activeChild?.firstName || 'your little one'} 🎈
            </Text>
          </View>
        </View>

        {/* Child Switcher */}
        <ChildSwitcher
          children={children.map((c: any) => ({
            id: c.id,
            firstName: c.firstName || c.first_name,
            lastName: c.lastName || c.last_name,
            avatarUrl: c.avatarUrl,
          }))}
          activeChildId={activeChildId}
          onChildChange={setActiveChildId}
        />

        {/* Intro Card */}
        <LinearGradient colors={['#6D28D9', '#8B5CF6']} style={styles.introCard}>
          <Text style={styles.introEmoji}>🧸</Text>
          <View style={styles.introContent}>
            <Text style={styles.introTitle}>Play & Learn with Dash!</Text>
            <Text style={styles.introText}>
              Fun activities designed by early childhood experts. Each one builds real skills —
              counting, letters, shapes, and more! After each activity, Dash can continue
              the learning conversation. 🌟
            </Text>
          </View>
        </LinearGradient>

        {/* Domain Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !filter && styles.filterChipActive]}
            onPress={() => setFilter(null)}
          >
            <Text style={[styles.filterText, !filter && styles.filterTextActive]}>All 🎯</Text>
          </TouchableOpacity>
          {Object.entries(DOMAIN_LABELS).map(([key, { label, emoji }]) => {
            if (!grouped[key]) return null;
            const isActive = filter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilter(isActive ? null : key)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {emoji} {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Activity Cards by Domain */}
        {displayDomains.map(domain => {
          const activities = grouped[domain];
          if (!activities || activities.length === 0) return null;
          const domainInfo = DOMAIN_LABELS[domain] || { label: domain, emoji: '📋', color: '#6B7280' };

          return (
            <View key={domain} style={styles.domainSection}>
              <Text style={styles.domainTitle}>
                {domainInfo.emoji} {domainInfo.label}
              </Text>
              {activities.map(activity => {
                const locked = !hasTierAccess(activity.requiresTier);
                return (
                  <TouchableOpacity
                    key={activity.id}
                    activeOpacity={0.85}
                    onPress={() => handleStartActivity(activity)}
                    style={styles.activityCard}
                  >
                    <LinearGradient colors={activity.gradient} style={styles.activityGradient}>
                      <View style={styles.activityRow}>
                        <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                        <View style={styles.activityInfo}>
                          <Text style={styles.activityTitle}>{activity.title}</Text>
                          <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                        </View>
                        {locked ? (
                          <View style={styles.lockBadge}>
                            <Ionicons name="lock-closed" size={14} color="#fff" />
                          </View>
                        ) : (
                          <View style={styles.durationBadge}>
                            <Ionicons name="time-outline" size={13} color="#fff" />
                            <Text style={styles.durationText}>{activity.durationMinutes}m</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.skillRow}>
                        {activity.skills.slice(0, 3).map(skill => (
                          <View key={skill} style={styles.skillTag}>
                            <Text style={styles.skillText}>{skill}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.objectiveText} numberOfLines={2}>
                        {activity.learningObjective}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* Bottom CTA */}
        <TouchableOpacity
          style={styles.dashCta}
          onPress={() => router.push('/screens/dash-assistant')}
        >
          <Ionicons name="sparkles" size={20} color={theme.primary} />
          <Text style={[styles.dashCtaText, { color: theme.primary }]}>
            Or just chat with Dash for a custom activity!
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Activity Player Modal */}
      <Modal visible={!!activeActivity && !activityResult} animationType="slide" presentationStyle="fullScreen">
        {activeActivity && (
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <ActivityPlayer
              activity={activeActivity}
              childId={activeChildId || 'unknown'}
              onComplete={handleComplete}
              onClose={handleCloseActivity}
              onSpeak={speak}
            />
          </SafeAreaView>
        )}
      </Modal>

      {/* Completion Modal */}
      <Modal visible={!!activityResult && !!activeActivity} animationType="fade" presentationStyle="fullScreen">
        {activityResult && activeActivity && (
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <ActivityComplete
              activity={activeActivity}
              result={activityResult}
              onPlayAgain={handlePlayAgain}
              onContinueWithDash={handleContinueWithDash}
              onUploadAndGrade={handleUploadAndGrade}
              onClose={handleCloseActivity}
            />
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, topInset: number, bottomInset: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: theme.textSecondary, fontSize: 14 },
    modalSafe: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: 16, paddingBottom: bottomInset + 40, gap: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.border,
    },
    headerCenter: { flex: 1 },
    title: { fontSize: 24, fontWeight: '800', color: theme.text },
    subtitle: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
    introCard: {
      borderRadius: 20, padding: 20,
      flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    introEmoji: { fontSize: 48 },
    introContent: { flex: 1, gap: 6 },
    introTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    introText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 19 },
    filterRow: { flexDirection: 'row', marginBottom: -8 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
      marginRight: 8,
    },
    filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterText: { fontSize: 13, fontWeight: '600', color: theme.text },
    filterTextActive: { color: '#fff' },
    domainSection: { gap: 10 },
    domainTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 4 },
    activityCard: { borderRadius: 18, overflow: 'hidden', elevation: 3 },
    activityGradient: { padding: 16, gap: 10 },
    activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    activityEmoji: { fontSize: 36 },
    activityInfo: { flex: 1 },
    activityTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
    activitySubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    lockBadge: {
      backgroundColor: 'rgba(0,0,0,0.3)', width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    durationBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    },
    durationText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    skillTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    skillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    objectiveText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', lineHeight: 17 },
    dashCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 16, backgroundColor: theme.surface, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border,
    },
    dashCtaText: { fontSize: 14, fontWeight: '600' },
  });
