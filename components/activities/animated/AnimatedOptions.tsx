/**
 * AnimatedOptions — Animated multiple-choice option buttons
 *
 * Features:
 * - Staggered slide-in entrance from right
 * - Correct answer: bounce pulse + green glow
 * - Wrong answer: horizontal shake + red flash
 * - Auto-reveal: gentle pulse on correct option
 *
 * ≤400 lines (WARP.md compliant)
 */

import React, { useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ActivityOption } from '@/lib/activities/preschoolActivities.types';

// ── Types ────────────────────────────────────────────────────

interface AnimatedOptionsProps {
  options: ActivityOption[];
  roundId: string;
  selectedOptionId: string | null;
  autoRevealed: boolean;
  showCelebration: boolean;
  wrongAttempts: number;
  onSelect: (optionId: string) => void;
}

// ── Individual Animated Option ───────────────────────────────

interface AnimatedOptionItemProps {
  option: ActivityOption;
  index: number;
  roundId: string;
  isSelected: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  revealCorrect: boolean;
  showCelebration: boolean;
  wrongAttempts: number;
  onPress: () => void;
}

const AnimatedOptionItem = memo(function AnimatedOptionItem({
  option,
  index,
  roundId,
  isSelected,
  isCorrect,
  isWrong,
  revealCorrect,
  showCelebration,
  wrongAttempts,
  onPress,
}: AnimatedOptionItemProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(250)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const revealLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Staggered entrance: slide from right
  useEffect(() => {
    slideAnim.setValue(250);
    shakeAnim.setValue(0);
    pulseAnim.setValue(1);
    revealLoop.current?.stop();
    revealLoop.current = null;

    Animated.spring(slideAnim, {
      toValue: 0,
      delay: index * 100 + 200, // 200ms wait for emoji grid to settle
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [roundId]);

  // Correct: bounce pulse
  useEffect(() => {
    if (isCorrect || revealCorrect) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(pulseAnim, {
          toValue: 1.02,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isCorrect, revealCorrect]);

  // Wrong: horizontal shake
  useEffect(() => {
    if (isWrong) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -14, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 14, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [isWrong, wrongAttempts]);

  // Auto-reveal: gentle pulse loop on correct option
  useEffect(() => {
    if (revealCorrect && !isCorrect) {
      revealLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      revealLoop.current.start();
      return () => {
        revealLoop.current?.stop();
        revealLoop.current = null;
      };
    }
    return undefined;
  }, [revealCorrect, isCorrect]);

  const bgColor = (isCorrect || revealCorrect)
    ? '#10B981'
    : isWrong
      ? '#EF4444'
      : theme.surface;
  const borderColor = (isCorrect || revealCorrect)
    ? '#059669'
    : isWrong
      ? '#DC2626'
      : theme.border;
  const textColor = (isCorrect || isWrong || revealCorrect) ? '#fff' : theme.text;

  return (
    <Animated.View
      style={{
        transform: [
          { translateX: Animated.add(slideAnim, shakeAnim) },
          { scale: pulseAnim },
        ],
      }}
    >
      <TouchableOpacity
        style={[
          styles.optionBtn,
          { backgroundColor: bgColor, borderColor },
        ]}
        onPress={onPress}
        disabled={showCelebration}
        activeOpacity={0.7}
      >
        <Text style={[styles.optionLabel, { color: textColor }]}>
          {option.label}
        </Text>
        {(isCorrect || revealCorrect) && (
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
        )}
        {isWrong && (
          <Ionicons name="close-circle" size={24} color="#fff" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Main AnimatedOptions Component ───────────────────────────

export function AnimatedOptions({
  options,
  roundId,
  selectedOptionId,
  autoRevealed,
  showCelebration,
  wrongAttempts,
  onSelect,
}: AnimatedOptionsProps) {
  return (
    <View style={styles.container}>
      {options.map((option, i) => {
        const isSelected = selectedOptionId === option.id;
        const isCorrect = isSelected && option.isCorrect;
        const isWrong = isSelected && !option.isCorrect;
        const revealCorrect = autoRevealed && option.isCorrect;

        return (
          <AnimatedOptionItem
            key={option.id}
            option={option}
            index={i}
            roundId={roundId}
            isSelected={isSelected}
            isCorrect={isCorrect}
            isWrong={isWrong}
            revealCorrect={revealCorrect}
            showCelebration={showCelebration}
            wrongAttempts={wrongAttempts}
            onPress={() => onSelect(option.id)}
          />
        );
      })}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 12,
    overflow: 'hidden',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    minHeight: 64,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
});
