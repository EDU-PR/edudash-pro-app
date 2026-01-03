/**
 * Teacher Activity Builder Screen
 * 
 * Allows teachers to create and manage interactive activities
 * for preschool students (matching games, counting, etc.)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { SubPageHeader } from '@/components/SubPageHeader';

// ====================================================================
// TYPES
// ====================================================================

type ActivityType = 'matching' | 'counting' | 'sorting' | 'sequence' | 'quiz';

interface MatchPair {
  id: string;
  left: string;
  right: string;
}

interface CountingItem {
  id: string;
  emoji: string;
  count: number;
}

interface ActivityDraft {
  type: ActivityType;
  title: string;
  instructions: string;
  difficulty: number;
  ageGroupMin: number;
  ageGroupMax: number;
  starsReward: number;
  subject: string;
  pairs?: MatchPair[];
  countingItems?: CountingItem[];
}

// ====================================================================
// ACTIVITY TYPE CONFIG
// ====================================================================

const ACTIVITY_TYPES = [
  {
    type: 'matching' as ActivityType,
    icon: '🔀',
    name: 'Matching Game',
    description: 'Match items together (animals & sounds, colors & objects)',
  },
  {
    type: 'counting' as ActivityType,
    icon: '🔢',
    name: 'Counting Game',
    description: 'Count objects and select the right number',
  },
  {
    type: 'sorting' as ActivityType,
    icon: '📊',
    name: 'Sorting Game',
    description: 'Put items in order (size, sequence)',
  },
  {
    type: 'sequence' as ActivityType,
    icon: '1️⃣',
    name: 'Sequence Game',
    description: 'Arrange events in the correct order',
  },
  {
    type: 'quiz' as ActivityType,
    icon: '❓',
    name: 'Quiz',
    description: 'Multiple choice questions',
  },
];

const SUBJECTS = ['math', 'language', 'science', 'art', 'social'];

const EMOJI_PICKER = ['🐕', '🐱', '🐦', '🐘', '🦋', '🌸', '☀️', '🌈', '⭐', '❤️', '🍎', '🍌', '🎈', '🚗', '🏠', '🎂'];

// ====================================================================
// COMPONENT
// ====================================================================

export default function TeacherActivityBuilder() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user, profile } = useAuth();
  
  const [step, setStep] = useState<'type' | 'details' | 'content'>('type');
  const [draft, setDraft] = useState<ActivityDraft>({
    type: 'matching',
    title: '',
    instructions: '',
    difficulty: 1,
    ageGroupMin: 3,
    ageGroupMax: 5,
    starsReward: 2,
    subject: 'math',
    pairs: [],
    countingItems: [],
  });
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<'left' | 'right' | 'counting' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // ====================================================================
  // HANDLERS
  // ====================================================================

  const handleSelectType = (type: ActivityType) => {
    setDraft(prev => ({ ...prev, type }));
    setStep('details');
  };

  const handleDetailsNext = () => {
    if (!draft.title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your activity');
      return;
    }
    setStep('content');
  };

  const handleAddMatchPair = () => {
    const newPair: MatchPair = {
      id: `pair-${Date.now()}`,
      left: '',
      right: '',
    };
    setDraft(prev => ({
      ...prev,
      pairs: [...(prev.pairs || []), newPair],
    }));
  };

  const handleUpdateMatchPair = (index: number, field: 'left' | 'right', value: string) => {
    setDraft(prev => ({
      ...prev,
      pairs: prev.pairs?.map((p, i) => i === index ? { ...p, [field]: value } : p),
    }));
  };

  const handleRemoveMatchPair = (index: number) => {
    setDraft(prev => ({
      ...prev,
      pairs: prev.pairs?.filter((_, i) => i !== index),
    }));
  };

  const handleAddCountingItem = () => {
    const newItem: CountingItem = {
      id: `count-${Date.now()}`,
      emoji: '🍎',
      count: 1,
    };
    setDraft(prev => ({
      ...prev,
      countingItems: [...(prev.countingItems || []), newItem],
    }));
  };

  const handleUpdateCountingItem = (index: number, field: 'emoji' | 'count', value: string | number) => {
    setDraft(prev => ({
      ...prev,
      countingItems: prev.countingItems?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleRemoveCountingItem = (index: number) => {
    setDraft(prev => ({
      ...prev,
      countingItems: prev.countingItems?.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!profile?.preschool_id) {
      Alert.alert('Error', 'You must be associated with a school');
      return;
    }

    // Validate content
    if (draft.type === 'matching' && (!draft.pairs || draft.pairs.length < 2)) {
      Alert.alert('Not Enough Pairs', 'Please add at least 2 matching pairs');
      return;
    }
    if (draft.type === 'counting' && (!draft.countingItems || draft.countingItems.length < 2)) {
      Alert.alert('Not Enough Items', 'Please add at least 2 counting items');
      return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();

      // Build content JSON
      let content = {};
      if (draft.type === 'matching') {
        content = {
          pairs: draft.pairs?.map(p => ({
            id: p.id,
            image1: p.left,
            text2: p.right,
          })),
        };
      } else if (draft.type === 'counting') {
        content = {
          items: draft.countingItems?.map(item => ({
            image: item.emoji.repeat(item.count),
            count: item.count,
          })),
        };
      }

      const { error } = await supabase
        .from('interactive_activities')
        .insert({
          preschool_id: profile.preschool_id,
          teacher_id: user?.id,
          activity_type: draft.type,
          title: draft.title,
          instructions: draft.instructions || `Complete the ${draft.type} activity!`,
          content,
          difficulty_level: draft.difficulty,
          age_group_min: draft.ageGroupMin,
          age_group_max: draft.ageGroupMax,
          stars_reward: draft.starsReward,
          subject: draft.subject,
          skills: JSON.stringify(getSkillsForType(draft.type)),
          is_active: true,
          is_template: false,
        });

      if (error) throw error;

      Alert.alert('Success!', 'Activity created successfully! 🎉', [
        { text: 'Create Another', onPress: resetForm },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDraft({
      type: 'matching',
      title: '',
      instructions: '',
      difficulty: 1,
      ageGroupMin: 3,
      ageGroupMax: 5,
      starsReward: 2,
      subject: 'math',
      pairs: [],
      countingItems: [],
    });
    setStep('type');
  };

  const getSkillsForType = (type: ActivityType): string[] => {
    const skills: Record<ActivityType, string[]> = {
      matching: ['memory', 'matching', 'recognition'],
      counting: ['counting', 'numbers', 'math'],
      sorting: ['sorting', 'comparison', 'logic'],
      sequence: ['sequence', 'order', 'logic'],
      quiz: ['knowledge', 'recall', 'learning'],
    };
    return skills[type] || [];
  };

  const handleEmojiSelect = (emoji: string) => {
    if (showEmojiPicker === 'left' && editingIndex !== null) {
      handleUpdateMatchPair(editingIndex, 'left', emoji);
    } else if (showEmojiPicker === 'right' && editingIndex !== null) {
      handleUpdateMatchPair(editingIndex, 'right', emoji);
    } else if (showEmojiPicker === 'counting' && editingIndex !== null) {
      handleUpdateCountingItem(editingIndex, 'emoji', emoji);
    }
    setShowEmojiPicker(null);
    setEditingIndex(null);
  };

  // ====================================================================
  // RENDER STEPS
  // ====================================================================

  const renderTypeSelection = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What type of activity?
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Choose an activity type for your students
      </Text>

      <View style={styles.typeGrid}>
        {ACTIVITY_TYPES.map(actType => (
          <TouchableOpacity
            key={actType.type}
            onPress={() => handleSelectType(actType.type)}
            style={[
              styles.typeCard,
              { 
                backgroundColor: colors.cardBackground,
                borderColor: draft.type === actType.type ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={styles.typeIcon}>{actType.icon}</Text>
            <Text style={[styles.typeName, { color: colors.text }]}>{actType.name}</Text>
            <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>
              {actType.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderDetails = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Activity Details
        </Text>

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
          <TextInput
            value={draft.title}
            onChangeText={text => setDraft(prev => ({ ...prev, title: text }))}
            placeholder="e.g., Animal Sounds Match"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
            ]}
          />
        </View>

        {/* Instructions */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Instructions</Text>
          <TextInput
            value={draft.instructions}
            onChangeText={text => setDraft(prev => ({ ...prev, instructions: text }))}
            placeholder="e.g., Match each animal with the sound it makes!"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            style={[
              styles.textArea,
              { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
            ]}
          />
        </View>

        {/* Subject */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Subject</Text>
          <View style={styles.chipRow}>
            {SUBJECTS.map(subj => (
              <TouchableOpacity
                key={subj}
                onPress={() => setDraft(prev => ({ ...prev, subject: subj }))}
                style={[
                  styles.chip,
                  { 
                    backgroundColor: draft.subject === subj ? colors.primary : colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[
                  styles.chipText,
                  { color: draft.subject === subj ? '#fff' : colors.text },
                ]}>
                  {subj.charAt(0).toUpperCase() + subj.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Difficulty */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Difficulty</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map(level => (
              <TouchableOpacity
                key={level}
                onPress={() => setDraft(prev => ({ ...prev, difficulty: level }))}
                style={[
                  styles.difficultyChip,
                  { 
                    backgroundColor: draft.difficulty === level ? colors.primary : colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[
                  styles.chipText,
                  { color: draft.difficulty === level ? '#fff' : colors.text },
                ]}>
                  {'⭐'.repeat(level)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age Range */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Age Range</Text>
          <View style={styles.rangeRow}>
            <TextInput
              value={String(draft.ageGroupMin)}
              onChangeText={text => setDraft(prev => ({ ...prev, ageGroupMin: parseInt(text) || 3 }))}
              keyboardType="number-pad"
              style={[
                styles.rangeInput,
                { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.rangeTo, { color: colors.textSecondary }]}>to</Text>
            <TextInput
              value={String(draft.ageGroupMax)}
              onChangeText={text => setDraft(prev => ({ ...prev, ageGroupMax: parseInt(text) || 6 }))}
              keyboardType="number-pad"
              style={[
                styles.rangeInput,
                { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>years old</Text>
          </View>
        </View>

        {/* Stars Reward */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Stars Reward</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map(stars => (
              <TouchableOpacity
                key={stars}
                onPress={() => setDraft(prev => ({ ...prev, starsReward: stars }))}
                style={[
                  styles.chip,
                  { 
                    backgroundColor: draft.starsReward === stars ? '#FFD700' : colors.cardBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.chipText}>{stars} ⭐</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Next Button */}
        <TouchableOpacity
          onPress={handleDetailsNext}
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.nextButtonText}>Next: Add Content</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

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
            onPress={() => { setEditingIndex(index); setShowEmojiPicker('left'); }}
            style={[styles.pairInput, { backgroundColor: colors.background }]}
          >
            <Text style={styles.pairEmoji}>{pair.left || '➕'}</Text>
          </TouchableOpacity>
          <Ionicons name="swap-horizontal" size={20} color={colors.textSecondary} />
          <TextInput
            value={pair.right}
            onChangeText={text => handleUpdateMatchPair(index, 'right', text)}
            placeholder="Sound/text"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.pairTextInput,
              { backgroundColor: colors.background, color: colors.text },
            ]}
          />
          <TouchableOpacity
            onPress={() => handleRemoveMatchPair(index)}
            style={styles.removeButton}
          >
            <Ionicons name="close-circle" size={24} color="#FF5252" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={handleAddMatchPair}
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
            onPress={() => { setEditingIndex(index); setShowEmojiPicker('counting'); }}
            style={[styles.countEmojiBtn, { backgroundColor: colors.background }]}
          >
            <Text style={styles.countEmoji}>{item.emoji}</Text>
          </TouchableOpacity>
          <Text style={[styles.countX, { color: colors.textSecondary }]}>×</Text>
          <View style={styles.countInputWrapper}>
            <TouchableOpacity
              onPress={() => handleUpdateCountingItem(index, 'count', Math.max(1, item.count - 1))}
              style={[styles.countBtn, { backgroundColor: colors.border }]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.countNumber, { color: colors.text }]}>{item.count}</Text>
            <TouchableOpacity
              onPress={() => handleUpdateCountingItem(index, 'count', Math.min(10, item.count + 1))}
              style={[styles.countBtn, { backgroundColor: colors.border }]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => handleRemoveCountingItem(index)}
            style={styles.removeButton}
          >
            <Ionicons name="close-circle" size={24} color="#FF5252" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={handleAddCountingItem}
        style={[styles.addButton, { borderColor: colors.primary }]}
      >
        <Ionicons name="add" size={24} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Item</Text>
      </TouchableOpacity>
    </>
  );

  const renderContent = () => (
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
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: '#4CAF50', opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Save Activity</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmojiPicker(null)}
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
                  onPress={() => handleEmojiSelect(emoji)}
                  style={[styles.emojiOption, { borderColor: colors.border }]}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowEmojiPicker(null)}
              style={[styles.cancelButton, { backgroundColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );

  // ====================================================================
  // RENDER
  // ====================================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SubPageHeader
        title="Create Activity"
        onBack={() => {
          if (step === 'content') setStep('details');
          else if (step === 'details') setStep('type');
          else router.back();
        }}
      />

      {/* Progress Steps */}
      <View style={[styles.stepsBar, { backgroundColor: colors.cardBackground }]}>
        {['type', 'details', 'content'].map((s, i) => (
          <View key={s} style={styles.stepWrapper}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: 
                    step === s ? colors.primary 
                    : ['details', 'content'].indexOf(step) > i ? '#4CAF50'
                    : colors.border,
                },
              ]}
            >
              {['details', 'content'].indexOf(step) > i ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={styles.stepNum}>{i + 1}</Text>
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              { color: step === s ? colors.primary : colors.textSecondary },
            ]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </View>
        ))}
      </View>

      {step === 'type' && renderTypeSelection()}
      {step === 'details' && renderDetails()}
      {step === 'content' && renderContent()}
    </SafeAreaView>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stepWrapper: {
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNum: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  difficultyChip: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeInput: {
    width: 60,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  rangeTo: {
    fontSize: 14,
  },
  rangeLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contentSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  pairInput: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairEmoji: {
    fontSize: 28,
  },
  pairTextInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  removeButton: {
    padding: 4,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  countEmojiBtn: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countEmoji: {
    fontSize: 28,
  },
  countX: {
    fontSize: 16,
  },
  countInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  comingSoon: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  emojiPickerModal: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  emojiPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  emojiOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiOptionText: {
    fontSize: 28,
  },
  cancelButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
