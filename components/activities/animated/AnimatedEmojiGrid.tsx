/**
 * AnimatedEmojiGrid — Interactive animated emoji display
 *
 * Per-emoji animations with game-type awareness:
 * - emoji_counting: Tap-to-count with number badges, glow, and counting narration
 * - default: Staggered bounce-in entrance (all game types)
 *
 * ≤400 lines (WARP.md compliant)
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { useCelebration } from '@/hooks/useCelebration';

// ── Types ────────────────────────────────────────────────────

type GridMode = 'counting' | 'default';

interface AnimatedEmojiGridProps {
  emojis: string[];
  gameType: string;
  roundId: string;
  /** Called when child taps an emoji in counting mode — arg is current count (1, 2, 3...) */
  onCountTap?: (count: number) => void;
  /** Called when child has counted every emoji in the grid */
  onCountComplete?: (total: number) => void;
  /** True when the round is answered/celebrating — disables interaction */
  disabled?: boolean;
}

// ── Individual Animated Emoji ────────────────────────────────

interface EmojiItemProps {
  emoji: string;
  index: number;
  mode: GridMode;
  isCounted: boolean;
  countNumber: number | null;
  onTap: (index: number) => void;
  disabled: boolean;
}

const AnimatedEmojiItem = memo(function AnimatedEmojiItem({
  emoji,
  index,
  mode,
  isCounted,
  countNumber,
  onTap,
  disabled,
}: EmojiItemProps) {
  const displayScale = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(0)).current;
  const idleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startIdlePulse = () => {
    idleLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(displayScale, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(displayScale, {
          toValue: 0.95,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    idleLoopRef.current.start();
  };

  // Staggered entrance: spring from scale 0 → 1
  useEffect(() => {
    displayScale.setValue(0);
    glowOpacity.setValue(0);
    numberScale.setValue(0);

    Animated.spring(displayScale, {
      toValue: 1,
      delay: index * 120,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // After entrance, start gentle idle pulse if in counting mode
      if (finished && mode === 'counting' && !isCounted && !disabled) {
        startIdlePulse();
      }
    });

    return () => {
      idleLoopRef.current?.stop();
      idleLoopRef.current = null;
    };
  }, []); // Only on mount — component remounts on roundId via key

  // When counted: stop idle, grow big, show glow + number badge
  useEffect(() => {
    if (isCounted) {
      idleLoopRef.current?.stop();
      idleLoopRef.current = null;

      Animated.parallel([
        Animated.spring(displayScale, {
          toValue: 1.3,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(glowOpacity, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(numberScale, {
          toValue: 1,
          delay: 80,
          friction: 3,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isCounted]);

  // Stop idle when disabled (e.g., round answered)
  useEffect(() => {
    if (disabled && idleLoopRef.current) {
      idleLoopRef.current.stop();
      idleLoopRef.current = null;
      if (!isCounted) {
        Animated.timing(displayScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [disabled, isCounted]);

  const handlePress = () => {
    if (disabled || isCounted) return;
    onTap(index);
  };

  const isTappable = mode === 'counting' && !disabled && !isCounted;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!isTappable}
      activeOpacity={isTappable ? 0.6 : 1}
      style={s.itemTouchable}
    >
      {/* Glow circle behind emoji */}
      <Animated.View
        style={[
          s.glowCircle,
          { opacity: glowOpacity },
        ]}
      />

      {/* Number badge (counting mode) */}
      {countNumber !== null && (
        <Animated.View
          style={[
            s.numberBadge,
            {
              transform: [{ scale: numberScale }],
              opacity: numberScale,
            },
          ]}
        >
          <Text style={s.numberText}>{countNumber}</Text>
        </Animated.View>
      )}

      {/* Emoji */}
      <Animated.Text
        style={[
          s.emoji,
          { transform: [{ scale: displayScale }] },
        ]}
      >
        {emoji}
      </Animated.Text>

      {/* Sparkle on counted items */}
      {isCounted && (
        <Animated.Text style={[s.sparkle, { opacity: glowOpacity }]}>
          ✨
        </Animated.Text>
      )}
    </TouchableOpacity>
  );
});

// ── Main Grid Component ──────────────────────────────────────

export function AnimatedEmojiGrid({
  emojis,
  gameType,
  roundId,
  onCountTap,
  onCountComplete,
  disabled = false,
}: AnimatedEmojiGridProps) {
  const { selectionHaptic, successHaptic } = useCelebration();
  const [countedIndices, setCountedIndices] = useState<number[]>([]);
  const [allCounted, setAllCounted] = useState(false);
  const bannerScale = useRef(new Animated.Value(0)).current;

  const mode: GridMode = gameType === 'emoji_counting' ? 'counting' : 'default';

  // Reset when round changes
  useEffect(() => {
    setCountedIndices([]);
    setAllCounted(false);
    bannerScale.setValue(0);
  }, [roundId]);

  const handleEmojiTap = useCallback(
    (index: number) => {
      if (mode !== 'counting' || countedIndices.includes(index)) return;

      const newCounted = [...countedIndices, index];
      setCountedIndices(newCounted);
      selectionHaptic();
      onCountTap?.(newCounted.length);

      // All emojis counted!
      if (newCounted.length === emojis.length) {
        setAllCounted(true);
        Animated.spring(bannerScale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
        setTimeout(() => {
          successHaptic();
          onCountComplete?.(newCounted.length);
        }, 600);
      }
    },
    [countedIndices, emojis.length, mode, onCountTap, onCountComplete],
  );

  return (
    <View style={s.container}>
      {/* Tap-to-count instruction */}
      {mode === 'counting' && !allCounted && !disabled && (
        <Text style={s.tapInstruction}>👆 Tap each one to count!</Text>
      )}

      {/* Emoji grid */}
      <View style={s.grid}>
        {emojis.map((emoji, i) => {
          const countIdx = countedIndices.indexOf(i);
          return (
            <AnimatedEmojiItem
              key={`${roundId}-${i}`}
              emoji={emoji}
              index={i}
              mode={mode}
              isCounted={countIdx !== -1}
              countNumber={countIdx !== -1 ? countIdx + 1 : null}
              onTap={handleEmojiTap}
              disabled={disabled}
            />
          );
        })}
      </View>

      {/* Count completion banner */}
      {allCounted && (
        <Animated.View
          style={[
            s.countBanner,
            {
              transform: [{ scale: bannerScale }],
              opacity: bannerScale,
            },
          ]}
        >
          <Text style={s.countBannerText}>
            🎉 You counted {emojis.length}!
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  tapInstruction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
    textAlign: 'center',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 16,
  },
  itemTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 72,
    minHeight: 90,
  },
  glowCircle: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FDE68A',
    top: 8,
  },
  numberBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  numberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  emoji: {
    fontSize: 52,
  },
  sparkle: {
    position: 'absolute',
    bottom: -4,
    fontSize: 16,
  },
  countBanner: {
    backgroundColor: '#EDE9FE',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#C4B5FD',
  },
  countBannerText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B21B6',
    textAlign: 'center',
  },
});
