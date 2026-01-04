/**
 * Matching Game Component for Preschoolers
 * 
 * Interactive matching game where children match items (animals to sounds,
 * colors to objects, etc.) Tracks attempts and awards stars/badges.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '../../../lib/supabase';

// ====================================================================
// TYPES
// ====================================================================

interface MatchPair {
  id: string;
  image1?: string;
  text1?: string;
  image2?: string;
  text2?: string;
}

interface MatchingGameProps {
  /** Activity ID for tracking */
  activityId?: string;
  /** Student ID for recording attempts */
  studentId?: string;
  /** Title shown at top */
  title?: string;
  /** Instructions for the child */
  instructions?: string;
  /** The pairs to match */
  pairs: MatchPair[];
  /** Stars awarded on completion */
  starsReward?: number;
  /** Called when game completes */
  onComplete?: (result: GameResult) => void;
  /** Called when user exits */
  onExit?: () => void;
}

interface GameResult {
  completed: boolean;
  score: number;
  timeSpentSeconds: number;
  attempts: number;
  matchedCount: number;
  totalPairs: number;
}

interface ShuffledItem {
  id: string;
  content: string;
  pairId: string;
  type: 'left' | 'right';
  isMatched: boolean;
}

// ====================================================================
// COMPONENT
// ====================================================================

export function MatchingGame({
  activityId,
  studentId,
  title = 'Match the Items!',
  instructions = 'Tap to select, then tap the matching item',
  pairs,
  starsReward = 2,
  onComplete,
  onExit,
}: MatchingGameProps) {
  const { colors, isDark } = useTheme();
  const [startTime] = useState(Date.now());
  const [attempts, setAttempts] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ShuffledItem | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);
  const [incorrectPair, setIncorrectPair] = useState<string | null>(null);
  const [shakeAnim] = useState(new Animated.Value(0));
  const [bounceAnim] = useState(new Animated.Value(1));

  // Shuffle items into two columns
  const { leftItems, rightItems } = useMemo(() => {
    const left: ShuffledItem[] = pairs.map(p => ({
      id: `left-${p.id}`,
      content: p.image1 || p.text1 || '',
      pairId: p.id,
      type: 'left' as const,
      isMatched: false,
    }));

    const right: ShuffledItem[] = pairs.map(p => ({
      id: `right-${p.id}`,
      content: p.image2 || p.text2 || '',
      pairId: p.id,
      type: 'right' as const,
      isMatched: false,
    }));

    // Shuffle right column
    for (let i = right.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [right[i], right[j]] = [right[j], right[i]];
    }

    return { leftItems: left, rightItems: right };
  }, [pairs]);

  // Check for game completion
  useEffect(() => {
    if (matchedPairs.size === pairs.length && pairs.length > 0) {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const score = Math.max(0, Math.round(100 - (attempts - pairs.length) * 10));
      
      setShowSuccess(true);
      
      // Bounce animation
      Animated.spring(bounceAnim, {
        toValue: 1.2,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }).start(() => {
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }).start();
      });

      // Record attempt and call onComplete
      if (activityId && studentId) {
        recordAttempt(score, timeSpent);
      }

      setTimeout(() => {
        onComplete?.({
          completed: true,
          score,
          timeSpentSeconds: timeSpent,
          attempts,
          matchedCount: matchedPairs.size,
          totalPairs: pairs.length,
        });
      }, 2000);
    }
  }, [matchedPairs.size, pairs.length]);

  const recordAttempt = async (score: number, timeSpent: number) => {
    try {
      const supabase = assertSupabase();
      await supabase.from('activity_attempts').insert({
        activity_id: activityId,
        student_id: studentId,
        status: 'completed',
        score,
        time_spent_seconds: timeSpent,
        stars_earned: score >= 70 ? starsReward : Math.floor(starsReward / 2),
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error recording attempt:', error);
    }
  };

  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleItemPress = useCallback((item: ShuffledItem) => {
    if (matchedPairs.has(item.pairId)) return;

    if (!selectedItem) {
      // First selection
      setSelectedItem(item);
    } else if (selectedItem.id === item.id) {
      // Deselect
      setSelectedItem(null);
    } else if (selectedItem.type === item.type) {
      // Same column - switch selection
      setSelectedItem(item);
    } else {
      // Checking for match
      setAttempts(prev => prev + 1);

      if (selectedItem.pairId === item.pairId) {
        // Correct match!
        setMatchedPairs(prev => new Set([...prev, item.pairId]));
        setSelectedItem(null);
      } else {
        // Wrong match
        setIncorrectPair(item.id);
        shakeAnimation();
        setTimeout(() => {
          setIncorrectPair(null);
          setSelectedItem(null);
        }, 500);
      }
    }
  }, [selectedItem, matchedPairs, shakeAnimation]);

  const isSelected = (item: ShuffledItem) => selectedItem?.id === item.id;
  const isMatched = (item: ShuffledItem) => matchedPairs.has(item.pairId);
  const isIncorrect = (item: ShuffledItem) => incorrectPair === item.id;

  const renderItem = (item: ShuffledItem, index: number) => {
    const matched = isMatched(item);
    const selected = isSelected(item);
    const incorrect = isIncorrect(item);

    return (
      <Animated.View
        key={item.id}
        style={[
          { transform: [{ translateX: incorrect ? shakeAnim : 0 }] },
        ]}
      >
        <TouchableOpacity
          onPress={() => handleItemPress(item)}
          disabled={matched}
          activeOpacity={0.7}
          style={[
            styles.itemCard,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
            selected && { borderColor: colors.primary, borderWidth: 3 },
            matched && { backgroundColor: '#4CAF5033', borderColor: '#4CAF50' },
            incorrect && { backgroundColor: '#FF525233', borderColor: '#FF5252' },
          ]}
        >
          <Text style={[styles.itemText, { color: matched ? '#4CAF50' : colors.text }]}>
            {item.content}
          </Text>
          {matched && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Success overlay
  if (showSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.View 
          style={[
            styles.successContainer,
            { transform: [{ scale: bounceAnim }] }
          ]}
        >
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            Great Job!
          </Text>
          <View style={styles.starsRow}>
            {[...Array(starsReward)].map((_, i) => (
              <Text key={i} style={styles.star}>⭐</Text>
            ))}
          </View>
          <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
            You matched all {pairs.length} pairs!
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.exitButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.instructions, { color: colors.textSecondary }]}>
            {instructions}
          </Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {matchedPairs.size}/{pairs.length}
          </Text>
        </View>
      </View>

      {/* Game Area */}
      <View style={styles.gameArea}>
        <View style={styles.column}>
          {leftItems.map(renderItem)}
        </View>
        <View style={styles.divider}>
          <Ionicons name="swap-horizontal" size={24} color={colors.textSecondary} />
        </View>
        <View style={styles.column}>
          {rightItems.map(renderItem)}
        </View>
      </View>

      {/* Footer Stats */}
      <View style={[styles.footer, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.stat}>
          <Ionicons name="finger-print" size={20} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.text }]}>
            {attempts} taps
          </Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={[styles.statText, { color: colors.text }]}>
            {starsReward} ⭐ to earn
          </Text>
        </View>
      </View>
    </View>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 80) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  exitButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  instructions: {
    fontSize: 14,
    marginTop: 4,
  },
  progressBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  gameArea: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  column: {
    flex: 1,
    gap: 12,
  },
  divider: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCard: {
    width: CARD_WIDTH,
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    position: 'relative',
  },
  itemText: {
    fontSize: 28,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  star: {
    fontSize: 40,
    marginHorizontal: 4,
  },
  successSubtext: {
    fontSize: 16,
  },
});

export default MatchingGame;
