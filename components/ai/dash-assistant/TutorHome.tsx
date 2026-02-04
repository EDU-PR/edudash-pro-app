import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface TutorHomeProps {
  styles: any;
  theme: any;
  onSendMessage?: (text: string) => void;
  onAgeBandChange?: (ageBand: string) => void;
  learnerContext?: {
    learnerName?: string | null;
    grade?: string | null;
    ageBand?: string | null;
    schoolType?: string | null;
    role?: string | null;
  } | null;
}

const TUTOR_HOME_COLLAPSE_KEY = '@dash_ai_tutor_home_collapsed';

export const TutorHome: React.FC<TutorHomeProps> = ({
  styles,
  theme,
  onSendMessage,
  onAgeBandChange,
  learnerContext,
}) => {
  const [ageBand, setAgeBand] = useState('auto');
  const [ageBandLoaded, setAgeBandLoaded] = useState(false);
  const [lastConversationId, setLastConversationId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(Dimensions.get('window').width < 420);

  const normalizedSchool = (learnerContext?.schoolType || '').toLowerCase();
  const isPreschool = normalizedSchool.includes('preschool') ||
    normalizedSchool.includes('ecd') ||
    normalizedSchool.includes('early');
  const roleValue = (learnerContext?.role || '').toLowerCase();
  const isStaff = ['teacher', 'principal', 'admin', 'manager', 'staff'].includes(roleValue);
  const lockAgeBand = !!learnerContext?.ageBand && (learnerContext?.role === 'student' || learnerContext?.role === 'learner');

  const ageChips = useMemo(() => ([
    { id: 'auto', label: 'Auto' },
    { id: '3-5', label: '3–5' },
    { id: '6-8', label: '6–8' },
    { id: '9-12', label: '9–12' },
    { id: '13-15', label: '13–15' },
    { id: '16-18', label: '16–18' },
    { id: 'adult', label: 'Adult' },
  ]), []);

  const visibleAgeChips = useMemo(() => {
    if (!isPreschool) return ageChips;
    return ageChips.filter(chip => ['auto', '3-5', '6-8'].includes(chip.id));
  }, [ageChips, isPreschool]);

  useEffect(() => {
    let mounted = true;
    const loadLastConversation = async () => {
      try {
        const storedId = await AsyncStorage.getItem('@dash_ai_current_conversation_id');
        if (mounted) {
          setLastConversationId(storedId || null);
        }
      } catch {
        if (mounted) setLastConversationId(null);
      }
    };
    loadLastConversation();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCollapsePref = async () => {
      try {
        const stored = await AsyncStorage.getItem(TUTOR_HOME_COLLAPSE_KEY);
        if (!mounted) return;
        if (stored !== null) {
          setCollapsed(stored === 'true');
        }
      } catch {
        // keep default
      }
    };
    loadCollapsePref();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem(TUTOR_HOME_COLLAPSE_KEY, next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadAgeBand = async () => {
      try {
        const storedAge = await AsyncStorage.getItem('@dash_ai_age_band');
        if (storedAge && ageChips.some((chip) => chip.id === storedAge)) {
          if (mounted) setAgeBand(storedAge);
        }
      } catch {
        // ignore, keep default
      } finally {
        if (mounted) setAgeBandLoaded(true);
      }
    };
    loadAgeBand();
    return () => {
      mounted = false;
    };
  }, [ageChips]);

  useEffect(() => {
    if (!learnerContext?.ageBand) return;
    if (lockAgeBand) {
      setAgeBand(learnerContext.ageBand);
      return;
    }
    setAgeBand(prev => (prev === 'auto' ? learnerContext.ageBand || prev : prev));
  }, [learnerContext?.ageBand, lockAgeBand]);

  useEffect(() => {
    if (!ageBandLoaded) return;
    if (!lockAgeBand) {
      AsyncStorage.setItem('@dash_ai_age_band', ageBand).catch(() => {});
      onAgeBandChange?.(ageBand);
      return;
    }
    if (learnerContext?.ageBand) {
      onAgeBandChange?.(learnerContext.ageBand);
    }
  }, [ageBand, ageBandLoaded, onAgeBandChange, lockAgeBand, learnerContext?.ageBand]);

  const buildPrompt = (intent: string, topic?: string) => {
    const ageLabel = ageChips.find((chip) => chip.id === ageBand)?.label || ageBand;
    const agePrefix = lockAgeBand || ageBand === 'auto' ? '' : `Age group: ${ageLabel}. `;
    const topicPrefix = topic ? `Topic: ${topic}. ` : '';
    return `${agePrefix}${topicPrefix}${intent}`;
  };

  const sendTutorIntent = (intent: string, topic?: string) => {
    onSendMessage?.(buildPrompt(intent, topic));
  };

  const defaultQuickStart = useMemo(() => (
    isPreschool
      ? 'Use a short story and ask one simple question to get started.'
      : 'Ask me one short diagnostic question first, then explain step-by-step in simple language.'
  ), [isPreschool]);

  const staffActions = useMemo(() => {
    if (!isStaff) return [];
    const base = isPreschool
      ? 'Use ECD language and play-based activities suitable for ages 3-6.'
      : 'Use CAPS-aligned structure with clear objectives and lesson outcomes.';
    return [
      {
        id: 'brainstorm-theme',
        label: 'Theme & routines',
        icon: 'sparkles-outline',
        prompt: `Brainstorm a weekly theme plan with daily activities, circle time ideas, and parent tips. ${base}`,
      },
      {
        id: 'daily-routine',
        label: 'Daily routine',
        icon: 'time-outline',
        prompt: `Create a structured daily routine with transitions and classroom management cues. ${base}`,
      },
      {
        id: 'interactive-lesson',
        label: 'Interactive activity',
        icon: 'hand-left-outline',
        prompt: `Design a hands-on interactive activity that aligns with today's class lesson. Include materials, steps, and assessment. ${base}`,
      },
    ];
  }, [isStaff, isPreschool]);

  const lessonBuilderRoute = useMemo(() => {
    if (!isStaff) return null;
    return isPreschool ? '/screens/preschool-lesson-generator' : '/screens/ai-lesson-generator';
  }, [isStaff, isPreschool]);

  if (collapsed) {
    return (
      <View style={[styles.emptyStateContainer, { paddingBottom: 8 }]}>
        <LinearGradient
          colors={['#0b1220', '#101b2d', '#0b1220']}
          style={[styles.emptyStateHero, { borderColor: theme.border, paddingVertical: 16, marginBottom: 8 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={[styles.emptyStateLogo, { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary }]}>
                <Ionicons name="sparkles" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.emptyStateTitle, { color: theme.text, fontSize: 18, marginBottom: 2 }]}>
                  Tutor mode
                </Text>
                <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary, fontSize: 12 }]}>
                  {isPreschool ? 'Play‑based help in seconds.' : 'Quick help, clear steps, focused practice.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleCollapsed}
              accessibilityLabel="Expand tutor mode"
              style={{
                padding: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surfaceVariant,
              }}
            >
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={[
                styles.primaryCta,
                { backgroundColor: theme.primary, flexBasis: 'auto', flexGrow: 0, paddingHorizontal: 14, paddingVertical: 8 },
              ]}
              onPress={() => sendTutorIntent(defaultQuickStart)}
            >
              <Ionicons name="play" size={16} color={theme.onPrimary || '#fff'} />
              <Text style={[styles.primaryCtaText, { color: theme.onPrimary || '#fff' }]}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryCta,
                { backgroundColor: theme.surfaceVariant, borderWidth: 1, borderColor: theme.border, flexBasis: 'auto', flexGrow: 0, paddingHorizontal: 14, paddingVertical: 8 },
              ]}
              onPress={toggleCollapsed}
            >
              <Ionicons name="options-outline" size={16} color={theme.text} />
              <Text style={[styles.primaryCtaText, { color: theme.text }]}>Customize</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.emptyStateContainer}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#0b1220', '#101b2d', '#0b1220']}
        style={[styles.emptyStateHero, { borderColor: theme.border }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.emptyStateHeroTop, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={[styles.emptyStateLogo, { backgroundColor: theme.primary }]}>
              <Ionicons name="sparkles" size={28} color="#fff" />
            </View>
            <View style={styles.emptyStateHeroText}>
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                {isPreschool ? 'Your play‑based tutor' : 'Your personal tutor'}
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>
                {isPreschool
                  ? 'Tell me what your child is learning. I’ll use stories and simple questions.'
                  : 'Tell me what you’re stuck on. I’ll diagnose, teach, and practice with you.'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={toggleCollapsed}
            accessibilityLabel="Collapse tutor mode"
            style={{
              padding: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surfaceVariant,
            }}
          >
            <Ionicons name="chevron-up" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.primaryCtasRow}>
          <TouchableOpacity
            style={[styles.primaryCta, { backgroundColor: theme.primary }]}
            onPress={() => sendTutorIntent(
              defaultQuickStart
            )}
          >
            <Ionicons name="bulb-outline" size={18} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.primaryCtaText, { color: theme.onPrimary || '#fff' }]}>Explain it</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryCta, { backgroundColor: theme.success || '#16a34a' }]}
            onPress={() => sendTutorIntent(
              isPreschool
                ? 'Give one playful practice question. Wait for the answer before continuing.'
                : 'Give me one practice question to diagnose my level. Wait for my answer before continuing.'
            )}
          >
            <Ionicons name="pencil-outline" size={18} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.primaryCtaText, { color: theme.onPrimary || '#fff' }]}>Help me solve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryCta, { backgroundColor: theme.warning || '#f59e0b' }]}
            onPress={() => sendTutorIntent(
              isPreschool
                ? 'Quiz with 3 very easy questions using colors, shapes, or counting.'
                : 'Quiz me with 5 questions, starting easy and getting harder.'
            )}
          >
            <Ionicons name="school-outline" size={18} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.primaryCtaText, { color: theme.onPrimary || '#fff' }]}>Test me</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Age & grade</Text>
        {learnerContext && (learnerContext.grade || learnerContext.learnerName || learnerContext.schoolType) && (
          <View style={[styles.profileHint, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="person-circle-outline" size={16} color={theme.primary} />
            <Text style={[styles.profileHintText, { color: theme.textSecondary }]}>
              {learnerContext.learnerName ? `${learnerContext.learnerName}` : 'Learner profile'}
              {learnerContext.grade ? ` · Grade ${learnerContext.grade}` : ''}
              {learnerContext.schoolType ? ` · ${learnerContext.schoolType}` : ''}
            </Text>
          </View>
        )}
        <View style={styles.chipRow}>
          {visibleAgeChips.map((chip) => {
            const active = chip.id === ageBand;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.ageChip,
                  { borderColor: active ? theme.primary : theme.border },
                  active && { backgroundColor: theme.primary + '22' },
                ]}
                onPress={() => {
                  if (lockAgeBand) return;
                  setAgeBand(chip.id);
                }}
                disabled={lockAgeBand}
              >
                <Text style={[styles.ageChipText, { color: active ? theme.primary : theme.textSecondary }]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.journeyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.journeyHeader}>
          <Ionicons name="trail-sign-outline" size={18} color={theme.primary} />
          <Text style={[styles.journeyTitle, { color: theme.text }]}>Your learning journey</Text>
        </View>
        <View style={styles.journeySteps}>
          <View style={styles.journeyStep}>
            <Text style={[styles.journeyStepLabel, { color: theme.text }]}>1. Diagnose</Text>
            <Text style={[styles.journeyStepSub, { color: theme.textSecondary }]}>Find the exact gap</Text>
          </View>
          <View style={styles.journeyStep}>
            <Text style={[styles.journeyStepLabel, { color: theme.text }]}>2. Teach</Text>
            <Text style={[styles.journeyStepSub, { color: theme.textSecondary }]}>Explain with examples</Text>
          </View>
          <View style={styles.journeyStep}>
            <Text style={[styles.journeyStepLabel, { color: theme.text }]}>3. Practice</Text>
            <Text style={[styles.journeyStepSub, { color: theme.textSecondary }]}>Check understanding</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.journeyButton, { backgroundColor: theme.primary }]}
          onPress={() => sendTutorIntent('Start a 5-minute mini lesson. Ask me what topic to focus on.')}
        >
          <Text style={[styles.journeyButtonText, { color: theme.onPrimary || '#fff' }]}>Start a mini lesson</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.onPrimary || '#fff'} />
        </TouchableOpacity>
      </View>

      {lastConversationId && (
        <TouchableOpacity
          style={[styles.resumeCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
          onPress={() => router.push({ pathname: '/screens/dash-assistant', params: { conversationId: lastConversationId } })}
        >
          <View style={styles.resumeLeft}>
            <Ionicons name="time-outline" size={18} color={theme.primary} />
            <Text style={[styles.resumeText, { color: theme.text }]}>Continue your last conversation</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      )}

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Quick starts</Text>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
            onPress={() => sendTutorIntent('Help me with a math problem. Ask one diagnostic question first.')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="calculator-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Math help</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
            onPress={() => sendTutorIntent('Explain a concept in a simple way. Ask me which concept first.')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="book-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Explain a concept</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
            onPress={() => sendTutorIntent('Give me study guidance and tips for this week.')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="compass-outline" size={20} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Study guidance</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {isStaff && (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Planning & brainstorm</Text>
          <View style={styles.quickActionsContainer}>
            {staffActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                activeOpacity={0.7}
                onPress={() => sendTutorIntent(action.prompt)}
              >
                <View style={styles.actionButtonContent}>
                  <Ionicons name={action.icon as any} size={20} color={theme.primary} />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>{action.label}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            ))}
            {lessonBuilderRoute && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                activeOpacity={0.7}
                onPress={() => router.push(lessonBuilderRoute as any)}
              >
                <View style={styles.actionButtonContent}>
                  <Ionicons name="book-outline" size={20} color={theme.primary} />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>Open lesson builder</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() => router.push('/screens/brainstorm-room')}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="people-outline" size={20} color={theme.primary} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Open brainstorm room</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() => router.push('/screens/teacher-activity-builder')}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="extension-puzzle-outline" size={20} color={theme.primary} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Build activity</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default TutorHome;
