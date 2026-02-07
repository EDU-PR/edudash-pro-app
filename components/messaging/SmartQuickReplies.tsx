/**
 * SmartQuickReplies — AI-powered contextual reply suggestions
 * 
 * Shows 2-4 suggested quick reply chips above the message composer.
 * Suggestions adapt based on the last received message content.
 * 
 * Example triggers:
 * - "How is [child] doing?" → "Great! They're doing well" | "Let's discuss" | "Can we schedule a chat?"
 * - Photo received → "Thanks for sharing!" | "Lovely!" | "👍"
 * - Meeting request → "Sounds good!" | "What time works?" | "Let me check my schedule"
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface QuickReplyChip {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface SmartQuickRepliesProps {
  /** The last received message text (used to generate suggestions) */
  lastReceivedMessage?: string;
  /** Called when user taps a suggestion */
  onSelectReply: (text: string) => void;
  /** Hide the component */
  visible?: boolean;
  /** Apply wallpaper-aware glass styling */
  wallpaperMode?: boolean;
  /** Accent color used for chip icon/border */
  accentColor?: string;
  /** Optional explicit surface background */
  surfaceColor?: string;
  /** Wallpaper rendering mode for stronger contrast tuning */
  wallpaperVariant?: 'image' | 'gradient' | 'solid';
}

function withOpacity(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;

    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return color;
}

/**
 * Generate contextual reply suggestions based on message content.
 * This runs locally — no API call. For AI-powered suggestions,
 * replace with a call to the Anthropic API.
 */
function generateSuggestions(message?: string): QuickReplyChip[] {
  if (!message) return [];

  const lower = message.toLowerCase();

  // Greeting patterns
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(lower)) {
    return [
      { text: 'Hi! How are you?', icon: 'hand-left-outline' },
      { text: 'Hello! 😊' },
      { text: 'Good to hear from you!' },
    ];
  }

  // Question about child
  if (/how\s+(is|are|was)\s+\w+\s+(doing|today|at school|in class)/i.test(lower) || lower.includes('progress')) {
    return [
      { text: "They're doing great! 🌟" },
      { text: 'Can we schedule a meeting?', icon: 'calendar-outline' },
      { text: "Let me share some details" },
      { text: 'Thanks for asking!' },
    ];
  }

  // Meeting / schedule
  if (/meeting|schedule|appointment|available|free|call/i.test(lower)) {
    return [
      { text: 'Sounds good!', icon: 'checkmark-circle-outline' },
      { text: "What time works for you?", icon: 'time-outline' },
      { text: 'Let me check my schedule' },
    ];
  }

  // Thanks / appreciation
  if (/thank|thanks|appreciate|grateful/i.test(lower)) {
    return [
      { text: "You're welcome! 😊" },
      { text: 'Happy to help!' },
      { text: 'Anytime!' },
    ];
  }

  // Photo / media shared
  if (/photo|picture|image|video|recording|sent you/i.test(lower)) {
    return [
      { text: 'Thanks for sharing! 📸' },
      { text: 'Lovely!' },
      { text: '👍' },
    ];
  }

  // Homework / assignment
  if (/homework|assignment|task|worksheet|activity/i.test(lower)) {
    return [
      { text: 'Got it, thank you!', icon: 'checkmark-outline' },
      { text: "We'll work on it tonight" },
      { text: 'Any tips for this one?' },
    ];
  }

  // Absence / sick
  if (/absent|sick|ill|not feeling well|won't be|cannot attend/i.test(lower)) {
    return [
      { text: 'I hope they feel better soon! 🙏' },
      { text: 'Thanks for letting me know' },
      { text: "I'll send over the work they missed" },
    ];
  }

  // Event / reminder
  if (/event|concert|play|field trip|reminder|tomorrow|next week/i.test(lower)) {
    return [
      { text: 'Thanks for the reminder!' },
      { text: "We'll be there!", icon: 'checkmark-circle-outline' },
      { text: 'What should we bring?' },
    ];
  }

  // Default fallback suggestions
  return [
    { text: 'Thanks! 👍' },
    { text: 'Got it!' },
    { text: 'Sounds good!' },
  ];
}

export function SmartQuickReplies({
  lastReceivedMessage,
  onSelectReply,
  visible = true,
  wallpaperMode = false,
  accentColor,
  surfaceColor,
  wallpaperVariant = 'gradient',
}: SmartQuickRepliesProps) {
  const { theme } = useTheme();

  const suggestions = useMemo(
    () => generateSuggestions(lastReceivedMessage),
    [lastReceivedMessage]
  );

  if (!visible || suggestions.length === 0) return null;

  const accent = accentColor || theme.primary;
  const isImageWallpaper = wallpaperMode && wallpaperVariant === 'image';
  const resolvedSurface =
    surfaceColor ||
    (wallpaperMode
      ? (isImageWallpaper ? 'rgba(15, 23, 42, 0.94)' : withOpacity(accent, 0.24))
      : theme.surface);
  const resolvedLabelColor = wallpaperMode ? '#e2e8f0' : theme.textSecondary;
  const resolvedChipBg = wallpaperMode
    ? (isImageWallpaper ? 'rgba(15, 23, 42, 0.72)' : withOpacity(accent, 0.28))
    : withOpacity(accent, 0.12);
  const resolvedChipBorder = wallpaperMode ? withOpacity(accent, 0.5) : withOpacity(accent, 0.3);
  const resolvedChipText = wallpaperMode ? '#f8fafc' : accent;
  const resolvedIconColor = wallpaperMode ? '#f8fafc' : accent;

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderTopWidth: 1,
      borderTopColor: wallpaperMode ? 'rgba(148, 163, 184, 0.28)' : theme.border,
      backgroundColor: resolvedSurface,
    },
    label: {
      fontSize: 11,
      color: resolvedLabelColor,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 4,
    },
    scrollContent: {
      gap: 8,
      paddingRight: 12,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: resolvedChipBg,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: resolvedChipBorder,
      gap: 6,
    },
    chipText: {
      fontSize: 14,
      color: resolvedChipText,
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>💡 Quick Replies</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((chip, index) => (
          <TouchableOpacity
            key={index}
            style={styles.chip}
            onPress={() => onSelectReply(chip.text)}
            activeOpacity={0.6}
          >
            {chip.icon && <Ionicons name={chip.icon} size={16} color={resolvedIconColor} />}
            <Text style={styles.chipText}>{chip.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default SmartQuickReplies;
