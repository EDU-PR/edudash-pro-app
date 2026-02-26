/**
 * SmartReplyChips — Contextual quick-reply suggestions (M12)
 *
 * Horizontal scrollable chips above the composer that show AI-free smart
 * replies based on the last received message. Tapping a chip inserts the
 * text into the composer and optionally auto-sends.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { useSmartReplies } from '@/hooks/messaging/useSmartReplies';

interface SmartReplyChipsProps {
  lastMessage?: { content: string; senderRole?: string };
  isLastMessageFromOther: boolean;
  onSelect: (text: string) => void;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export function SmartReplyChips({
  lastMessage,
  isLastMessageFromOther,
  onSelect,
  onDismiss,
  dismissed = false,
}: SmartReplyChipsProps) {
  const { suggestions } = useSmartReplies(
    isLastMessageFromOther ? lastMessage : undefined,
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const shouldShow = !dismissed && isLastMessageFromOther && suggestions.length > 0;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, fadeAnim]);

  if (!shouldShow) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={onDismiss}
      >
        {suggestions.map((text, index) => (
          <TouchableOpacity
            key={`${text}-${index}`}
            style={styles.chip}
            onPress={() => onSelect(text)}
            activeOpacity={0.65}
          >
            <Text style={styles.chipText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#93c5fd',
  },
});
