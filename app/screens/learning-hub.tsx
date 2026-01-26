import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { ChildSwitcher } from '@/components/dashboard/parent';
import { getLearningHubUsage, incrementLearningHubUsage, type LearningHubUsage } from '@/lib/learningHubUsage';
import { incrementUsage } from '@/lib/ai/usage';

type TierKey = 'free' | 'starter' | 'plus';

type ActivityStep = {
  id: string;
  title: string;
  prompt: string;
  options?: Array<{ label: string; isCorrect?: boolean }>;
  confirmOnly?: boolean;
};

type ActivityCard = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  tags: string[];
  accent: string;
  gradient: [string, string];
  requiresTier?: TierKey;
  aiPrompt?: string;
  steps: ActivityStep[];
  isLesson?: boolean;
};

const TIER_LIMITS: Record<TierKey, { lessons: number; activities: number; aiHints: number }> = {
  free: { lessons: 1, activities: 3, aiHints: 5 },
  starter: { lessons: 3, activities: 8, aiHints: 20 },
  plus: { lessons: Number.POSITIVE_INFINITY, activities: Number.POSITIVE_INFINITY, aiHints: Number.POSITIVE_INFINITY },
};

const normalizeTier = (tierRaw?: string | null): TierKey => {
  const raw = String(tierRaw || 'free').toLowerCase();
  if (raw.includes('plus')) return 'plus';
  if (raw.includes('starter')) return 'starter';
  return 'free';
};

const ACTIVITIES: ActivityCard[] = [
  {
    id: 'robot_pathfinder',
    title: 'Robot Pathfinder',
    subtitle: 'Guide the robot home using arrows',
    duration: '6 min',
    tags: ['Logic', 'Sequencing', 'Robotics'],
    accent: '#2563EB',
    gradient: ['#1D4ED8', '#3B82F6'],
    isLesson: true,
    aiPrompt: 'Create a simple arrow-based sequence game for a preschooler. Keep it playful and very short.',
    steps: [
      {
        id: 'step-1',
        title: 'Choose the Path',
        prompt: 'Which arrow path gets Robo to the star? ⭐',
        options: [
          { label: '⬆️ ➡️ ➡️', isCorrect: false },
          { label: '➡️ ➡️ ⬆️', isCorrect: true },
          { label: '⬆️ ⬆️ ➡️', isCorrect: false },
        ],
      },
      {
        id: 'step-2',
        title: 'Count the Steps',
        prompt: 'How many moves did Robo make?',
        options: [
          { label: '2', isCorrect: false },
          { label: '3', isCorrect: true },
          { label: '4', isCorrect: false },
        ],
      },
      {
        id: 'step-3',
        title: 'Robot High‑Five',
        prompt: 'Give Robo a high‑five in real life, then tap Done.',
        confirmOnly: true,
      },
    ],
  },
  {
    id: 'ai_sound_lab',
    title: 'AI Sound Lab',
    subtitle: 'Match sounds to smart sensors',
    duration: '5 min',
    tags: ['Listening', 'Focus', 'AI'],
    accent: '#7C3AED',
    gradient: ['#6D28D9', '#8B5CF6'],
    requiresTier: 'starter',
    aiPrompt: 'Suggest a playful sound‑matching activity for a preschooler with AI/robot theme.',
    steps: [
      {
        id: 'step-1',
        title: 'Sound Match',
        prompt: 'Which sound would a robot make?',
        options: [
          { label: 'Beep‑Boop 🤖', isCorrect: true },
          { label: 'Meow 🐱', isCorrect: false },
          { label: 'Splash 💧', isCorrect: false },
        ],
      },
      {
        id: 'step-2',
        title: 'Sensor Check',
        prompt: 'Tap the object that can “sense” light.',
        options: [
          { label: 'Flashlight 🔦', isCorrect: true },
          { label: 'Pillow 🛏️', isCorrect: false },
          { label: 'Spoon 🥄', isCorrect: false },
        ],
      },
      {
        id: 'step-3',
        title: 'Real‑World Try',
        prompt: 'Find any light at home and show it to your child. Tap Done when finished.',
        confirmOnly: true,
      },
    ],
  },
  {
    id: 'rocket_math',
    title: 'Rocket Count‑Down',
    subtitle: 'Blast off with numbers',
    duration: '4 min',
    tags: ['Numbers', 'Rhythm', 'Space'],
    accent: '#F97316',
    gradient: ['#EA580C', '#F97316'],
    steps: [
      {
        id: 'step-1',
        title: 'Count Down',
        prompt: 'Pick the correct count down to launch!',
        options: [
          { label: '3, 2, 1, GO! 🚀', isCorrect: true },
          { label: '1, 2, 3, GO! 🚀', isCorrect: false },
          { label: '2, 1, 3, GO! 🚀', isCorrect: false },
        ],
      },
      {
        id: 'step-2',
        title: 'Rocket Stretch',
        prompt: 'Stretch up like a rocket and say “Blast off!” then tap Done.',
        confirmOnly: true,
      },
    ],
  },
  {
    id: 'robot_builder',
    title: 'Build‑a‑Bot',
    subtitle: 'Match shapes to build a robot',
    duration: '7 min',
    tags: ['Shapes', 'Creativity', 'Robotics'],
    accent: '#0EA5E9',
    gradient: ['#0284C7', '#38BDF8'],
    requiresTier: 'plus',
    aiPrompt: 'Create a preschool robot‑building shape activity with simple steps.',
    steps: [
      {
        id: 'step-1',
        title: 'Pick the Head',
        prompt: 'Which shape makes the best robot head?',
        options: [
          { label: 'Circle ⭕', isCorrect: true },
          { label: 'Triangle 🔺', isCorrect: false },
          { label: 'Star ⭐', isCorrect: false },
        ],
      },
      {
        id: 'step-2',
        title: 'Robot Body',
        prompt: 'Which shape looks like a robot body?',
        options: [
          { label: 'Rectangle ▭', isCorrect: true },
          { label: 'Heart ❤️', isCorrect: false },
          { label: 'Diamond 🔷', isCorrect: false },
        ],
      },
      {
        id: 'step-3',
        title: 'Home Build',
        prompt: 'Use paper or blocks to build your robot. Tap Done when you finish.',
        confirmOnly: true,
      },
    ],
  },
];

const formatLimit = (limit: number) => (Number.isFinite(limit) ? String(limit) : '∞');

export default function LearningHubScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { data, loading, refresh } = useParentDashboard();

  const tierKey = normalizeTier(tier);
  const limits = TIER_LIMITS[tierKey];

  const [usage, setUsage] = useState<LearningHubUsage>({
    date: '',
    lessonsUsed: 0,
    activitiesUsed: 0,
    aiHintsUsed: 0,
  });
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [activeActivity, setActiveActivity] = useState<ActivityCard | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

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

  useEffect(() => {
    let mounted = true;
    getLearningHubUsage(user?.id).then((res) => {
      if (mounted) setUsage(res);
    });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);

  const refreshUsage = useCallback(async () => {
    const res = await getLearningHubUsage(user?.id);
    setUsage(res);
  }, [user?.id]);

  const checkTierAccess = (required?: TierKey) => {
    if (!required) return true;
    const rank: Record<TierKey, number> = { free: 0, starter: 1, plus: 2 };
    return rank[tierKey] >= rank[required];
  };

  const canStartLesson = usage.lessonsUsed < limits.lessons;
  const canStartActivity = usage.activitiesUsed < limits.activities;
  const canUseAiHint = usage.aiHintsUsed < limits.aiHints;

  const handleStartActivity = async (activity: ActivityCard) => {
    if (!checkTierAccess(activity.requiresTier)) {
      Alert.alert(
        'Upgrade required',
        'This activity is available on higher tiers. Upgrade to unlock it.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/screens/subscription-setup' as any) },
        ],
      );
      return;
    }

    if (activity.isLesson && !canStartLesson) {
      Alert.alert(
        'Daily limit reached',
        'You have used today’s lesson limit. Upgrade or try again tomorrow.',
        [{ text: 'OK' }],
      );
      return;
    }

    if (!activity.isLesson && !canStartActivity) {
      Alert.alert(
        'Daily limit reached',
        'You have used today’s activity limit. Upgrade or try again tomorrow.',
        [{ text: 'OK' }],
      );
      return;
    }

    setActiveActivity(activity);
    setStepIndex(0);
    setSelectedOption(null);
  };

  const handleCloseModal = () => {
    setActiveActivity(null);
    setStepIndex(0);
    setSelectedOption(null);
  };

  const handleNextStep = async () => {
    if (!activeActivity) return;

    const step = activeActivity.steps[stepIndex];
    if (!step.confirmOnly && step.options && selectedOption === null) {
      Alert.alert('Select an answer', 'Please choose an option to continue.');
      return;
    }

    if (!step.confirmOnly && step.options && selectedOption !== null) {
      const chosen = step.options[selectedOption];
      if (!chosen?.isCorrect) {
        Alert.alert('Try again', 'Let’s try another option.');
        return;
      }
    }

    if (stepIndex < activeActivity.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
      setSelectedOption(null);
      return;
    }

    const updated = await incrementLearningHubUsage(user?.id || 'anonymous', {
      lessonsUsed: activeActivity.isLesson ? 1 : 0,
      activitiesUsed: activeActivity.isLesson ? 0 : 1,
    });
    setUsage(updated);
    handleCloseModal();
    Alert.alert('Great job!', 'Activity completed and saved.');
  };

  const handleAiHint = async () => {
    if (!activeActivity?.aiPrompt) {
      return;
    }
    if (!canUseAiHint) {
      Alert.alert(
        'AI limit reached',
        'You’ve used today’s AI hints. Upgrade to unlock more.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/screens/subscription-setup' as any) },
        ],
      );
      return;
    }

    const updated = await incrementLearningHubUsage(user?.id || 'anonymous', {
      aiHintsUsed: 1,
    });
    setUsage(updated);
    try {
      await incrementUsage('grading_assistance', 1, 'dash_ai');
    } catch {
      // non-fatal
    }

    router.push({
      pathname: '/screens/dash-assistant',
      params: {
        initialMessage: activeActivity.aiPrompt,
      },
    } as any);
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading Learning Hub...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Learning Hub</Text>
          <Text style={styles.subtitle}>
            {activeChild
              ? `Today’s activities for ${activeChild.firstName}`
              : 'Interactive play at home'}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How interactive lessons work</Text>
          <Text style={styles.infoText}>
            • Pick a child and tap an activity card.{'\n'}
            • Follow 2–5 playful steps together (tap, answer, or move).{'\n'}
            • Mark complete to save progress in the app.
          </Text>
          <Text style={styles.infoNote}>
            AI hints are optional and use your daily limit.
          </Text>
        </View>

        <ChildSwitcher
          children={children.map((c: any) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            avatarUrl: c.avatarUrl,
          }))}
          activeChildId={activeChildId}
          onChildChange={setActiveChildId}
        />

        <View style={styles.usageCard}>
          <Text style={styles.sectionTitle}>Daily Usage</Text>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>Lessons</Text>
            <Text style={styles.usageValue}>
              {usage.lessonsUsed}/{formatLimit(limits.lessons)}
            </Text>
          </View>
          <View style={styles.usageBar}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.min(100, (usage.lessonsUsed / (Number.isFinite(limits.lessons) ? limits.lessons : 1)) * 100 || 0)}%`,
                },
              ]}
            />
          </View>

          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>Activities</Text>
            <Text style={styles.usageValue}>
              {usage.activitiesUsed}/{formatLimit(limits.activities)}
            </Text>
          </View>
          <View style={styles.usageBar}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.min(100, (usage.activitiesUsed / (Number.isFinite(limits.activities) ? limits.activities : 1)) * 100 || 0)}%`,
                },
              ]}
            />
          </View>

          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>AI Hints</Text>
            <Text style={styles.usageValue}>
              {usage.aiHintsUsed}/{formatLimit(limits.aiHints)}
            </Text>
          </View>
          <View style={styles.usageBar}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.min(100, (usage.aiHintsUsed / (Number.isFinite(limits.aiHints) ? limits.aiHints : 1)) * 100 || 0)}%`,
                },
              ]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Interactive Lessons</Text>
        {ACTIVITIES.map((activity) => {
          const locked = !checkTierAccess(activity.requiresTier);
          return (
            <TouchableOpacity
              key={activity.id}
              activeOpacity={0.85}
              onPress={() => handleStartActivity(activity)}
              style={styles.activityCard}
            >
              <LinearGradient colors={activity.gradient} style={styles.activityGradient}>
                <View style={styles.activityHeader}>
                  <View>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                  </View>
                  {locked ? (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={14} color="#fff" />
                      <Text style={styles.lockBadgeText}>Locked</Text>
                    </View>
                  ) : (
                    <View style={styles.durationBadge}>
                      <Ionicons name="time-outline" size={14} color="#fff" />
                      <Text style={styles.durationText}>{activity.duration}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.tagRow}>
                  {activity.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.startRow}>
                  <Text style={styles.startText}>{activity.isLesson ? 'Lesson of the day' : 'Quick activity'}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        <View style={styles.refreshRow}>
          <TouchableOpacity style={styles.refreshButton} onPress={async () => { await refresh(); await refreshUsage(); }}>
            <Ionicons name="refresh" size={16} color={theme.primary} />
            <Text style={[styles.refreshText, { color: theme.primary }]}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={!!activeActivity} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {activeActivity ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{activeActivity.title}</Text>
                  <TouchableOpacity onPress={handleCloseModal}>
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>
                  Step {stepIndex + 1} of {activeActivity.steps.length}
                </Text>
                <Text style={styles.stepTitle}>{activeActivity.steps[stepIndex]?.title}</Text>
                <Text style={styles.stepPrompt}>{activeActivity.steps[stepIndex]?.prompt}</Text>

                {activeActivity.steps[stepIndex]?.options && (
                  <View style={styles.optionsGrid}>
                    {activeActivity.steps[stepIndex].options?.map((opt, idx) => {
                      const isSelected = selectedOption === idx;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.optionChip, isSelected && styles.optionChipActive]}
                          onPress={() => setSelectedOption(idx)}
                        >
                          <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {activeActivity.aiPrompt && (
                  <TouchableOpacity style={styles.aiHintButton} onPress={handleAiHint}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={styles.aiHintText}>Ask Dash AI</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
                  <Text style={styles.nextButtonText}>
                    {stepIndex === activeActivity.steps.length - 1 ? 'Complete' : 'Next'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color={theme.primary} />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, topInset: number, bottomInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingTop: topInset + 16,
      paddingHorizontal: 16,
      paddingBottom: bottomInset + 40,
      gap: 16,
    },
    header: {
      gap: 6,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginTop: 8,
    },
    infoCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    infoText: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    infoNote: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    usageCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    usageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    usageLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    usageValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    usageBar: {
      height: 6,
      backgroundColor: theme.elevated,
      borderRadius: 6,
      overflow: 'hidden',
    },
    usageFill: {
      height: 6,
      backgroundColor: theme.primary,
    },
    activityCard: {
      borderRadius: 18,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
    },
    activityGradient: {
      padding: 16,
      gap: 12,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    activityTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
    activitySubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 4,
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    durationText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    lockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.35)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    lockBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    tagText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
    },
    startRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    startText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    refreshRow: {
      alignItems: 'flex-start',
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    refreshText: {
      fontSize: 13,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.surface,
      padding: 20,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      gap: 12,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    modalSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    stepPrompt: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    optionChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.elevated,
    },
    optionChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    optionText: {
      color: theme.text,
      fontWeight: '600',
    },
    optionTextActive: {
      color: theme.onPrimary,
    },
    aiHintButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
    },
    aiHintText: {
      color: theme.onPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    nextButton: {
      backgroundColor: theme.success,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
    },
    nextButtonText: {
      color: theme.onPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
  });
