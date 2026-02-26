/**
 * DashAssistBar — AI message improvement bar (M11)
 *
 * Collapsible bar above the message composer that lets users improve,
 * formalise, friendlify, grammar-check, or shorten their draft message
 * using the Dash AI assistant.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toast } from '@/components/ui/ToastProvider';
import {
  useDashMessageAssistant,
  type AssistAction,
} from '@/hooks/messaging/useDashMessageAssistant';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { GRADIENT_DASH_AI, PURPLE_LIGHT } from './theme';

interface ActionChip {
  action: AssistAction;
  label: string;
  icon: string;
}

const ACTIONS: ActionChip[] = [
  { action: 'improve_tone', label: 'Improve', icon: '✏️' },
  { action: 'make_formal', label: 'Formal', icon: '👔' },
  { action: 'make_friendly', label: 'Friendly', icon: '😊' },
  { action: 'grammar_check', label: 'Grammar', icon: '📝' },
  { action: 'shorten', label: 'Shorten', icon: '✂️' },
];

interface DashAssistBarProps {
  visible: boolean;
  composerText: string;
  onAccept: (text: string) => void;
  onClose: () => void;
  recipientRole?: string;
}

export function DashAssistBar({
  visible,
  composerText,
  onAccept,
  onClose,
  recipientRole,
}: DashAssistBarProps) {
  const { assistMessage, isProcessing } = useDashMessageAssistant();
  const [preview, setPreview] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (!visible) {
      setPreview(null);
      setOriginalText('');
    }
  }, [visible]);

  const handleAction = useCallback(
    async (action: AssistAction) => {
      const text = composerText.trim();
      if (!text) {
        toast.warn('Type a message first', 'AI Assist');
        return;
      }

      setOriginalText(text);
      setPreview(null);

      try {
        const result = await assistMessage(text, action, {
          recipientRole,
        });
        setPreview(result);
      } catch {
        toast.error('AI assist failed. Please try again.', 'AI Assist');
      }
    },
    [composerText, assistMessage, recipientRole],
  );

  const handleAccept = useCallback(() => {
    if (preview) {
      onAccept(preview);
      setPreview(null);
      setOriginalText('');
      onClose();
    }
  }, [preview, onAccept, onClose]);

  const handleRevert = useCallback(() => {
    setPreview(null);
    setOriginalText('');
  }, []);

  if (!visible) return null;

  const maxHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <Animated.View style={[styles.container, { maxHeight, opacity }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✨ Dash AI Assist</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Action chips */}
      {!preview && !isProcessing && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {ACTIONS.map((chip) => (
            <TouchableOpacity
              key={chip.action}
              style={styles.chip}
              onPress={() => handleAction(chip.action)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipIcon}>{chip.icon}</Text>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Loading state */}
      {isProcessing && (
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="small" color={PURPLE_LIGHT} />
          <Text style={styles.loadingText}>Improving your message...</Text>
        </View>
      )}

      {/* Preview */}
      {preview && !isProcessing && (
        <View style={styles.previewContainer}>
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Suggested</Text>
            <Text style={styles.previewText}>{preview}</Text>
          </View>

          {originalText !== preview && (
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.revertButton} onPress={handleRevert}>
                <Ionicons name="arrow-undo-outline" size={16} color="#9ca3af" />
                <Text style={styles.revertText}>Revert</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
    overflow: 'hidden',
    marginHorizontal: 6,
    borderRadius: 14,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.3,
  },
  chipsRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    gap: 6,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  previewContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  previewCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    gap: 6,
  },
  revertText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    gap: 6,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
