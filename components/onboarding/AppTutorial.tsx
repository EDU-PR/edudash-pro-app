/**
 * App Tutorial / Onboarding Component
 * 
 * Shows a series of tutorial screens on first app launch.
 * Can be replayed from settings.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPreferencesSafe } from '@/contexts/AppPreferencesContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/rbac';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TutorialHighlight {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface TutorialStep {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  gradient: string[];
  highlights: TutorialHighlight[];
  tip?: string;
}

const buildTutorialSteps = (role: string): TutorialStep[] => {
  const isStudent = role === 'student';
  const isParent = role === 'parent';
  const isTeacher = role === 'teacher';
  const isPrincipal = role === 'principal' || role === 'principal_admin';
  const roleLabel = isStudent ? 'student' : isParent ? 'parent' : isTeacher ? 'teacher' : isPrincipal ? 'principal' : 'user';

  const dashHighlights: TutorialHighlight[] = [
    { id: 'assistant', icon: 'chatbubble-ellipses', text: 'Dash Assistant: full chat + tools' },
    { id: 'orb', icon: 'radio', text: 'Dash Orb Voice: hands-free voice mode' },
    { id: 'history', icon: 'time', text: 'Dash History: continue old conversations' },
  ];

  if (isStudent || isParent) {
    dashHighlights.push(
      { id: 'tutor-playground', icon: 'school', text: 'Dash Tutor + Playground: guided practice and activities' },
    );
  }

  if (isTeacher || isPrincipal) {
    dashHighlights.push(
      { id: 'studio-image', icon: 'color-wand', text: 'Dash Studio + Image Studio: planning and visual generation' },
    );
  }

  return [
    {
      id: 'welcome',
      icon: 'school',
      iconColor: '#00f5ff',
      title: 'Welcome to EduDash Pro',
      description: `Your ${roleLabel}-ready educational workspace is set up. Here is the fastest way to navigate and use Dash AI.`,
      gradient: ['#0a0a0f', '#1a1a2e'],
      highlights: [
        { id: 'tour-fast', icon: 'flash', text: 'This tour takes less than 30 seconds' },
        { id: 'tour-replay', icon: 'refresh', text: 'You can replay it anytime from Settings' },
      ],
    },
    {
      id: 'dash-ai-modes',
      icon: 'sparkles',
      iconColor: '#8B5CF6',
      title: 'Dash AI Surfaces',
      description: 'Dash now has clear entry points by task. Use the right surface to get faster, better results.',
      gradient: ['#1a1a2e', '#2d1b4e'],
      highlights: dashHighlights,
      tip: 'Tip: For quizzes and tutoring, use Dash Tutor mode instead of general chat.',
    },
    {
      id: 'find-feature',
      icon: 'search',
      iconColor: '#22d3ee',
      title: 'Find Any Function Fast',
      description: 'If you cannot find a screen, open Find Feature and type what you need.',
      gradient: ['#0b1f2d', '#1a1a2e'],
      highlights: [
        { id: 'drawer-search', icon: 'menu', text: 'Drawer: tap Find Feature' },
        { id: 'dash-search', icon: 'search-outline', text: 'Dash header: search icon' },
        { id: 'dash-longpress', icon: 'hand-left', text: 'Long-press center Dash tab for Dash-only search' },
      ],
      tip: 'Try keywords: uniforms, menu, finance, messages, tutor.',
    },
    {
      id: 'navigation',
      icon: 'apps',
      iconColor: '#10b981',
      title: 'Navigation Shortcuts',
      description: 'Use bottom tabs for daily actions. Dash is centered for one-tap AI access.',
      gradient: ['#0a2520', '#1a1a2e'],
      highlights: [
        { id: 'tabs', icon: 'grid', text: 'Bottom tabs switch core modules quickly' },
        { id: 'center-dash', icon: 'planet', text: 'Center Dash opens voice-first AI' },
        { id: 'drawer', icon: 'reorder-three', text: 'Drawer lists all role-specific modules' },
      ],
    },
    {
      id: 'messages',
      icon: 'chatbubbles',
      iconColor: '#3b82f6',
      title: 'Messages and Notifications',
      description: 'Your chat and notification feed routes you straight to the right screen.',
      gradient: ['#0a1628', '#1a1a2e'],
      highlights: [
        { id: 'messages-live', icon: 'chatbox', text: 'Real-time threads with delivery/read updates' },
        { id: 'notifications', icon: 'notifications', text: 'Tap notifications to jump to relevant pages' },
      ],
    },
    {
      id: 'settings',
      icon: 'settings',
      iconColor: '#f59e0b',
      title: 'Customize Your Experience',
      description: 'Tune preferences, Dash behavior, and replay this tutorial from Settings.',
      gradient: ['#2a1f0a', '#1a1a2e'],
      highlights: [
        { id: 'tutorial-replay', icon: 'play-back', text: 'Replay tutorial any time' },
        { id: 'dash-controls', icon: 'construct', text: 'Adjust Dash controls and defaults' },
      ],
    },
  ];
};

interface AppTutorialProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function AppTutorial({ onComplete, forceShow = false }: AppTutorialProps) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { tutorialCompleted, setTutorialCompleted, isLoaded } = useAppPreferencesSafe();
  const normalizedRole = normalizeRole(String(profile?.role || '')) || 'parent';
  const tutorialSteps = useMemo(() => buildTutorialSteps(normalizedRole), [normalizedRole]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    iconPulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(iconPulseAnim, { toValue: 1.06, duration: 240, useNativeDriver: true }),
      Animated.timing(iconPulseAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [currentIndex, iconPulseAnim]);

  // Don't show if tutorial completed and not forced
  if (!isLoaded || (tutorialCompleted && !forceShow)) {
    return null;
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    if (currentIndex < tutorialSteps.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    handleComplete();
  };

  const handleComplete = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTutorialCompleted(true);
      onComplete?.();
    });
  };

  const renderStep = ({ item, index }: { item: TutorialStep; index: number }) => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <LinearGradient
        colors={item.gradient as any}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
          Step {index + 1} of {tutorialSteps.length}
        </Text>
        <Animated.View
          style={[
            index === currentIndex ? { transform: [{ scale: iconPulseAnim }] } : undefined,
          ]}
        >
          <View style={[styles.iconCircle, { borderColor: item.iconColor }]}>
            <Ionicons name={item.icon} size={56} color={item.iconColor} />
          </View>
        </Animated.View>
        
        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]}>
          {item.title}
        </Text>
        
        {/* Description */}
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {item.description}
        </Text>

        <View style={styles.highlightList}>
          {item.highlights.map((highlight) => (
            <View key={highlight.id} style={[styles.highlightCard, { borderColor: theme.border, backgroundColor: theme.surface + 'CC' }]}>
              <Ionicons name={highlight.icon} size={16} color={theme.primary} />
              <Text style={[styles.highlightText, { color: theme.text }]}>
                {highlight.text}
              </Text>
            </View>
          ))}
        </View>
        {item.tip ? (
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            {item.tip}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {tutorialSteps.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === currentIndex ? theme.primary : theme.border,
              width: index === currentIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <FlatList
        ref={flatListRef}
        data={tutorialSteps}
        renderItem={renderStep}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(newIndex);
        }}
      />
      
      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
        {renderDots()}
        
        <View style={styles.buttonsRow}>
          {/* Skip button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>
              {t('common.skip', { defaultValue: 'Skip' })}
            </Text>
          </TouchableOpacity>
          
          {/* Next/Done button */}
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.primary }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>
              {currentIndex === tutorialSteps.length - 1 
                ? t('common.get_started', { defaultValue: 'Get Started' })
                : t('common.next', { defaultValue: 'Next' })}
            </Text>
            <Ionicons 
              name={currentIndex === tutorialSteps.length - 1 ? 'checkmark' : 'arrow-forward'} 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0f',
    zIndex: 9999,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 340,
  },
  highlightList: {
    width: '100%',
    marginTop: 18,
    gap: 8,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 42,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  tipText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 340,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AppTutorial;
