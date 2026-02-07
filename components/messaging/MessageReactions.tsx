/**
 * MessageReactions — Quick emoji reactions on messages (iMessage-style)
 * 
 * Features:
 * - Tap-and-hold triggers a floating reaction bar
 * - Supports: ❤️ 👍 😂 😮 😢 🙏
 * - Shows aggregated reactions below the message bubble
 * - Animated selection with haptic feedback
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  Animated,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// Available reaction emojis
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;
type ReactionEmoji = (typeof REACTIONS)[number];

export interface Reaction {
  emoji: ReactionEmoji;
  userId: string;
  userName?: string;
}

interface ReactionBarProps {
  visible: boolean;
  onSelect: (emoji: ReactionEmoji) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

/**
 * Floating reaction picker bar
 */
export function ReactionBar({ visible, onSelect, onClose, position = 'top' }: ReactionBarProps) {
  const { theme } = useTheme();
  const [scaleAnims] = useState(() => REACTIONS.map(() => new Animated.Value(1)));

  if (!visible) return null;

  const handlePress = (emoji: ReactionEmoji, index: number) => {
    // Quick bounce animation
    Animated.sequence([
      Animated.spring(scaleAnims[index], {
        toValue: 1.5,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    onSelect(emoji);
  };

  const styles = StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 999,
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 28,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 2,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        },
        android: {
          elevation: 12,
        },
      }),
      borderWidth: 1,
      borderColor: theme.border,
    },
    emojiButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 24,
    },
  });

  return (
    <>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.container, position === 'bottom' ? { marginTop: 4 } : { marginBottom: 4 }]}>
        {REACTIONS.map((emoji, index) => (
          <Animated.View key={emoji} style={{ transform: [{ scale: scaleAnims[index] }] }}>
            <TouchableOpacity
              style={styles.emojiButton}
              onPress={() => handlePress(emoji, index)}
              activeOpacity={0.6}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

interface ReactionBubblesProps {
  reactions: Reaction[];
  currentUserId: string;
  onReactionPress?: (emoji: ReactionEmoji) => void;
  isOwnMessage?: boolean;
}

/**
 * Aggregated reaction bubbles shown below message
 */
export function ReactionBubbles({ reactions, currentUserId, onReactionPress, isOwnMessage }: ReactionBubblesProps) {
  const { theme } = useTheme();

  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, { count: number; hasMine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasMine: false };
    acc[r.emoji].count++;
    if (r.userId === currentUserId) acc[r.emoji].hasMine = true;
    return acc;
  }, {});

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 4,
      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
      paddingHorizontal: isOwnMessage ? 0 : 8,
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 3,
    },
    bubbleActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
    },
    bubbleEmoji: {
      fontSize: 14,
    },
    bubbleCount: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    bubbleCountActive: {
      color: theme.primary,
    },
  });

  return (
    <View style={styles.container}>
      {Object.entries(grouped).map(([emoji, { count, hasMine }]) => (
        <TouchableOpacity
          key={emoji}
          style={[styles.bubble, hasMine && styles.bubbleActive]}
          onPress={() => onReactionPress?.(emoji as ReactionEmoji)}
          activeOpacity={0.6}
        >
          <Text style={styles.bubbleEmoji}>{emoji}</Text>
          {count > 1 && (
            <Text style={[styles.bubbleCount, hasMine && styles.bubbleCountActive]}>{count}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export { REACTIONS };
export type { ReactionEmoji };
