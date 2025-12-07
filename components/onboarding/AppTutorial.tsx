/**
 * App Tutorial / Onboarding Component
 * 
 * Shows a series of tutorial screens on first app launch.
 * Can be replayed from settings.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPreferencesSafe } from '@/contexts/AppPreferencesContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TutorialStep {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  gradient: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    icon: 'school',
    iconColor: '#00f5ff',
    title: 'Welcome to EduDash Pro',
    description: 'Your AI-powered educational dashboard for preschools. Let\'s take a quick tour!',
    gradient: ['#0a0a0f', '#1a1a2e'],
  },
  {
    id: 'dash-ai',
    icon: 'sparkles',
    iconColor: '#8B5CF6',
    title: 'Meet Dash AI',
    description: 'Tap the floating button anywhere to chat with Dash - your AI assistant. You can drag it to any position on screen!',
    gradient: ['#1a1a2e', '#2d1b4e'],
  },
  {
    id: 'navigation',
    icon: 'apps',
    iconColor: '#10b981',
    title: 'Easy Navigation',
    description: 'Use the bottom navigation bar to switch between screens. It auto-hides when you scroll for more space!',
    gradient: ['#0a2520', '#1a1a2e'],
  },
  {
    id: 'messages',
    icon: 'chatbubbles',
    iconColor: '#3b82f6',
    title: 'Stay Connected',
    description: 'Send messages to teachers or parents in real-time. New messages appear instantly without refreshing!',
    gradient: ['#0a1628', '#1a1a2e'],
  },
  {
    id: 'settings',
    icon: 'settings',
    iconColor: '#f59e0b',
    title: 'Customize Your Experience',
    description: 'Visit Settings to customize the app, toggle the Dash button visibility, or replay this tutorial anytime.',
    gradient: ['#2a1f0a', '#1a1a2e'],
  },
];

interface AppTutorialProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function AppTutorial({ onComplete, forceShow = false }: AppTutorialProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { tutorialCompleted, setTutorialCompleted, isLoaded } = useAppPreferencesSafe();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Don't show if tutorial completed and not forced
  if (!isLoaded || (tutorialCompleted && !forceShow)) {
    return null;
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    if (currentIndex < TUTORIAL_STEPS.length - 1) {
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
        {/* Icon */}
        <View style={[styles.iconCircle, { borderColor: item.iconColor }]}>
          <Ionicons name={item.icon} size={64} color={item.iconColor} />
        </View>
        
        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]}>
          {item.title}
        </Text>
        
        {/* Description */}
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {item.description}
        </Text>
      </View>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {TUTORIAL_STEPS.map((_, index) => (
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
        data={TUTORIAL_STEPS}
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
              {currentIndex === TUTORIAL_STEPS.length - 1 
                ? t('common.get_started', { defaultValue: 'Get Started' })
                : t('common.next', { defaultValue: 'Next' })}
            </Text>
            <Ionicons 
              name={currentIndex === TUTORIAL_STEPS.length - 1 ? 'checkmark' : 'arrow-forward'} 
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
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
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
