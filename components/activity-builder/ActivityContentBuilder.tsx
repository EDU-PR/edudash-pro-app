/**
 * Activity content builder step component
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ActivityDraft, MatchPair, CountingItem } from './activity-builder.types';
import { activityBuilderStyles as styles } from './activity-builder.styles';
import { EmojiPickerModal } from './EmojiPickerModal';
import { EmojiPickerMode } from '@/hooks/useActivityBuilder';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface ActivityContentBuilderProps {
  draft: ActivityDraft;
  saving: boolean;
  showEmojiPicker: EmojiPickerMode;
  
  // Match pair handlers
  onAddMatchPair: () => void;
  onUpdateMatchPair: (index: number, field: 'left' | 'right', value: string) => void;
  onRemoveMatchPair: (index: number) => void;
  
  // Counting item handlers
  onAddCountingItem: () => void;
  onUpdateCountingItem: (index: number, field: 'emoji' | 'count', value: string | number) => void;
  onRemoveCountingItem: (index: number) => void;
  
  // Emoji picker handlers
  onOpenEmojiPicker: (mode: EmojiPickerMode, index: number) => void;
  onEmojiSelect: (emoji: string) => void;
  onCloseEmojiPicker: () => void;
  
  // Save handler
  onSave: () => void;
}

export function ActivityContentBuilder({
  draft,
  saving,
  showEmojiPicker,
  onAddMatchPair,
  onUpdateMatchPair,
  onRemoveMatchPair,
  onAddCountingItem,
  onUpdateCountingItem,
  onRemoveCountingItem,
  onOpenEmojiPicker,
  onEmojiSelect,
  onCloseEmojiPicker,
  onSave,
}: ActivityContentBuilderProps) {
  const { colors } = useTheme();

  const renderMatchingContent = () => (
    <>
      <Text style={[styles.contentTitle, { color: colors.text }]}>
        Add Matching Pairs
      </Text>
      <Text style={[styles.contentSubtitle, { color: colors.textSecondary }]}>
        Create pairs that students will match together
      </Text>

      {draft.pairs?.map((pair, index) => (
        <View key={pair.id} style={[styles.pairRow, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity
            onPress={() => onOpenEmojiPicker('left', index)}
            style={[styles.pairInput, { backgroundColor: colors.background }]}
          >
            <Text style={styles.pairEmoji}>{pair.left || '➕'}</Text>
          </TouchableOpacity>
          <Ionicons name="swap-horizontal" size={20} color={colors.textSecondary} />
          <TextInput
            value={pair.right}
            onChangeText={text => onUpdateMatchPair(index, 'right', text)}
            placeholder="Sound/text"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.pairTextInput,
              { backgroundColor: colors.background, color: colors.text },
            ]}
          />
          <TouchableOpacity
            onPress={() => onRemoveMatchPair(index)}
            style={styles.removeButton}
          >
            <Ionicons name="close-circle" size={24} color="#FF5252" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={onAddMatchPair}
        style={[styles.addButton, { borderColor: colors.primary }]}
      >
        <Ionicons name="add" size={24} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Pair</Text>
      </TouchableOpacity>
    </>
  );

  const renderCountingContent = () => (
    <>
      <Text style={[styles.contentTitle, { color: colors.text }]}>
        Add Counting Items
      </Text>
      <Text style={[styles.contentSubtitle, { color: colors.textSecondary }]}>
        Choose an emoji and how many times it appears
      </Text>

      {draft.countingItems?.map((item, index) => (
        <View key={item.id} style={[styles.countRow, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity
            onPress={() => onOpenEmojiPicker('counting', index)}
            style={[styles.countEmojiBtn, { backgroundColor: colors.background }]}
          >
            <Text style={styles.countEmoji}>{item.emoji}</Text>
          </TouchableOpacity>
          <Text style={[styles.countX, { color: colors.textSecondary }]}>×</Text>
          <View style={styles.countInputWrapper}>
            <TouchableOpacity
              onPress={() => onUpdateCountingItem(index, 'count', Math.max(1, item.count - 1))}
              style={[styles.countBtn, { backgroundColor: colors.border }]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.countNumber, { color: colors.text }]}>{item.count}</Text>
            <TouchableOpacity
              onPress={() => onUpdateCountingItem(index, 'count', Math.min(10, item.count + 1))}
              style={[styles.countBtn, { backgroundColor: colors.border }]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => onRemoveCountingItem(index)}
            style={styles.removeButton}
          >
            <Ionicons name="close-circle" size={24} color="#FF5252" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={onAddCountingItem}
        style={[styles.addButton, { borderColor: colors.primary }]}
      >
        <Ionicons name="add" size={24} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Item</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        {draft.type === 'matching' && renderMatchingContent()}
        {draft.type === 'counting' && renderCountingContent()}
        {!['matching', 'counting'].includes(draft.type) && (
          <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>
            {draft.type.charAt(0).toUpperCase() + draft.type.slice(1)} builder coming soon!
          </Text>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: '#4CAF50', opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <EduDashSpinner color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Save Activity</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        visible={showEmojiPicker !== null}
        onSelect={onEmojiSelect}
        onClose={onCloseEmojiPicker}
      />
    </KeyboardAvoidingView>
  );
}
