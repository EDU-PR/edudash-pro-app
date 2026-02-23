/**
 * ActivityPlayer — Interactive Game Component
 *
 * Renders a preschool activity round-by-round with:
 * - Haptic feedback on every interaction (correct/wrong/tap)
 * - Dash speaking bubble — voice + visual presence
 * - Auto-reveal after 3 wrong attempts (never let child get stuck)
 * - Never-freeze: auto-advance after 8s celebration timeout
 * - Encouragement between rounds
 * - Animated feedback (correct/incorrect/celebration)
 * - Hint system on wrong answers
 * - Star rating at completion
 *
 * ≤400 lines (WARP.md compliant)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useCelebration } from '@/hooks/useCelebration';
import type { PreschoolActivity, ActivityResult, ActivityRound } from '@/lib/activities/preschoolActivities.types';
import { createActivityPlayerStyles } from './ActivityPlayer.styles';
import { AnimatedEmojiGrid } from './animated/AnimatedEmojiGrid';
import { AnimatedOptions } from './animated/AnimatedOptions';

/** Max wrong before auto-revealing — child NEVER gets stuck */
const MAX_WRONG = 3;

/** Dash encouragement shown between rounds */
const DASH_CHEERS = [
  "You're rocking it! 🎸", "So clever! Let's keep playing! 💫",
  "High five! Ready for more? ✋", "You're on fire! 🔥",
  "Brilliant brain! Next round! 🧠", "Wow, look at you go! 🚀",
];

interface ActivityPlayerProps {
  activity: PreschoolActivity;
  childId: string;
  onComplete: (result: ActivityResult) => void;
  onClose: () => void;
  onSpeak?: (text: string) => void;
}

export function ActivityPlayer({ activity, childId, onComplete, onClose, onSpeak }: ActivityPlayerProps) {
  const { theme } = useTheme();
  const styles = createActivityPlayerStyles(theme);
  const { successHaptic, errorHaptic, milestoneHaptic, selectionHaptic } = useCelebration();

  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [usedHints, setUsedHints] = useState(false);
  const [dashMessage, setDashMessage] = useState<string | null>(null);
  const [autoRevealed, setAutoRevealed] = useState(false);

  const bounceAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const starAnim = useRef(new Animated.Value(0)).current;
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRound = activity.rounds[roundIndex] as ActivityRound | undefined;
  const isLastRound = roundIndex >= activity.rounds.length - 1;
  const progress = (roundIndex + 1) / activity.rounds.length;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
  }, []);

  // Speak the prompt when round changes + show Dash message
  useEffect(() => {
    if (currentRound && onSpeak) {
      const speakText = currentRound.prompt.replace(/[^\w\s!?.,']/g, '');
      onSpeak(speakText);

      // Counting mode: invite child to tap emojis after prompt
      if (activity.gameType === 'emoji_counting' && currentRound.emojiGrid?.length) {
        setTimeout(() => onSpeak('Tap each one to count them!'), 2500);
      }
    }
    setSelectedOptionId(null);
    setShowHint(false);
    setShowCelebration(false);
    setWrongAttempts(0);
    setAutoRevealed(false);
    setDashMessage(null);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [roundIndex]);

  // Never-freeze: auto-advance after 8s if celebration is showing
  useEffect(() => {
    if (showCelebration) {
      celebrationTimer.current = setTimeout(() => {
        handleNext();
      }, 8000);
      return () => {
        if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      };
    }
  }, [showCelebration]);

  const animateBounce = useCallback(() => {
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [bounceAnim]);

  const animateStars = useCallback(() => {
    starAnim.setValue(0);
    Animated.spring(starAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [starAnim]);

  const showEncouragement = () => {
    const cheer = DASH_CHEERS[Math.floor(Math.random() * DASH_CHEERS.length)];
    setDashMessage(cheer);
    setTimeout(() => setDashMessage(null), 2500);
  };

  /** Number words for counting narration by Dash */
  const NUMBER_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

  /** Counting mode: Dash says each number as child taps */
  const handleCountTap = useCallback((count: number) => {
    if (NUMBER_WORDS[count - 1]) {
      onSpeak?.(NUMBER_WORDS[count - 1] + '!');
    }
  }, [onSpeak]);

  /** Counting mode: celebrate when all emojis counted */
  const handleCountComplete = useCallback((total: number) => {
    setDashMessage(`You counted ${total}! 🌟 Now pick the right number!`);
    onSpeak?.(`Great counting! You counted ${total}! Now pick the right number!`);
  }, [onSpeak]);

  /** Auto-reveal correct answer when child is stuck */
  const autoReveal = () => {
    const correct = currentRound?.options?.find(o => o.isCorrect);
    if (!correct) return;
    setAutoRevealed(true);
    setSelectedOptionId(correct.id);
    setShowCelebration(true);
    setCorrectCount(c => c + 1);
    animateBounce();
    successHaptic();
    const helpText = "That's okay! The answer is " + correct.label + ". You'll get it next time!";
    setDashMessage(helpText);
    if (onSpeak) onSpeak(helpText);
  };

  const handleOptionPress = (optionId: string) => {
    if (showCelebration || autoRevealed) return;
    selectionHaptic(); // Tactile feedback on every tap

    const option = currentRound?.options?.find(o => o.id === optionId);
    if (!option) return;
    setSelectedOptionId(optionId);

    if (option.isCorrect) {
      setCorrectCount(c => c + 1);
      setShowCelebration(true);
      animateBounce();
      successHaptic();
      if (onSpeak && currentRound?.celebration) onSpeak(currentRound.celebration);
    } else {
      const newWrong = wrongAttempts + 1;
      const hintThreshold = currentRound?.minWrongForHint ?? 1;
      const shouldShowHint = newWrong >= hintThreshold;
      setWrongAttempts(newWrong);
      setShowHint(shouldShowHint);
      if (shouldShowHint) {
        setUsedHints(true);
      }
      errorHaptic();

      // AnimatedOptions handles its own shake animation

      // After MAX_WRONG, auto-reveal so child never gets stuck
      if (newWrong >= MAX_WRONG) {
        setTimeout(() => autoReveal(), 1200);
      } else {
        setTimeout(() => setSelectedOptionId(null), 800);
      }
    }
  };

  const handleConfirm = () => {
    setCorrectCount(c => c + 1);
    setShowCelebration(true);
    animateBounce();
    successHaptic();
    if (onSpeak && currentRound?.celebration) onSpeak(currentRound.celebration);
  };

  const handleNext = () => {
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);

    if (isLastRound) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const totalRounds = activity.rounds.length;
      const ratio = correctCount / Math.max(1, totalRounds);
      const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;

      animateStars();
      milestoneHaptic();
      if (onSpeak) onSpeak(activity.dashCelebration);

      setTimeout(() => {
        onComplete({
          activityId: activity.id,
          childId,
          totalRounds,
          correctAnswers: correctCount,
          timeSpentSeconds: elapsed,
          completedAt: new Date().toISOString(),
          stars,
          usedHints,
        });
      }, 1500);
      return;
    }

    // Show encouragement between rounds
    showEncouragement();
    setTimeout(() => setRoundIndex(i => i + 1), 600);
  };

  if (!currentRound) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={activity.gradient} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.activityEmoji}>{activity.emoji}</Text>
            <View>
              <Text style={styles.headerTitle}>{activity.title}</Text>
              <Text style={styles.roundLabel}>
                Round {roundIndex + 1} of {activity.rounds.length}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </LinearGradient>

      {/* Dash Speaking Indicator */}
      {dashMessage && (
        <View style={styles.dashBubble}>
          <Text style={styles.dashBubbleEmoji}>🤖</Text>
          <View style={styles.dashBubbleContent}>
            <Text style={styles.dashBubbleText}>{dashMessage}</Text>
          </View>
        </View>
      )}

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.prompt}>{currentRound.prompt}</Text>

          {/* Emoji Grid — animated per-item with counting support */}
          {currentRound.emojiGrid && currentRound.emojiGrid.length > 0 && (
            <AnimatedEmojiGrid
              emojis={currentRound.emojiGrid}
              gameType={activity.gameType}
              roundId={currentRound.id}
              onCountTap={handleCountTap}
              onCountComplete={handleCountComplete}
              disabled={showCelebration || autoRevealed}
            />
          )}

          {/* Movements */}
          {currentRound.movements && currentRound.movements.length > 0 && (
            <View style={styles.movementCard}>
              {currentRound.movements.map((m, i) => (
                <View key={i} style={styles.movementRow}>
                  <Text style={styles.movementEmoji}>{m.emoji}</Text>
                  <View style={styles.movementInfo}>
                    <Text style={styles.movementText}>{m.instruction}</Text>
                    <Text style={styles.movementTime}>{m.durationSeconds}s</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Options — animated with stagger, bounce, shake */}
          {currentRound.options && !currentRound.confirmOnly && (
            <AnimatedOptions
              options={currentRound.options}
              roundId={currentRound.id}
              selectedOptionId={selectedOptionId}
              autoRevealed={autoRevealed}
              showCelebration={showCelebration}
              wrongAttempts={wrongAttempts}
              onSelect={handleOptionPress}
            />
          )}

          {/* Confirm Only */}
          {currentRound.confirmOnly && !showCelebration && (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <Ionicons name="checkmark-done" size={24} color="#fff" />
              <Text style={styles.confirmText}>Done!</Text>
            </TouchableOpacity>
          )}

          {/* Hint */}
          {showHint && currentRound.hint && !showCelebration && !autoRevealed && (
            <View style={styles.hintCard}>
              <Ionicons name="bulb" size={20} color="#F59E0B" />
              <Text style={styles.hintText}>{currentRound.hint}</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Celebration overlay */}
      {showCelebration && (
        <View style={styles.celebrationOverlay}>
          <Animated.View style={[styles.celebrationCard, { transform: [{ scale: bounceAnim }] }]}>
            <Text style={styles.celebrationEmoji}>{autoRevealed ? '💪' : '🌟'}</Text>
            <Text style={styles.celebrationText}>
              {autoRevealed ? "That's a tricky one! Now you know!" : (currentRound.celebration || 'Great job!')}
            </Text>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>
                {isLastRound ? 'Finish! 🎉' : 'Next Round →'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
