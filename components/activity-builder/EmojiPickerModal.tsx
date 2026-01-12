/**
 * Emoji picker modal component
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { EMOJI_PICKER } from './activity-builder.types';
import { activityBuilderStyles as styles } from './activity-builder.styles';

interface EmojiPickerModalProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPickerModal({ visible, onSelect, onClose }: EmojiPickerModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.emojiPickerModal, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.emojiPickerTitle, { color: colors.text }]}>
            Pick an Emoji
          </Text>
          <View style={styles.emojiGrid}>
            {EMOJI_PICKER.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => onSelect(emoji)}
                style={[styles.emojiOption, { borderColor: colors.border }]}
              >
                <Text style={styles.emojiOptionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.cancelButton, { backgroundColor: colors.border }]}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
