/**
 * Activity details form step component
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ActivityDraft, SUBJECTS } from './activity-builder.types';
import { activityBuilderStyles as styles } from './activity-builder.styles';

interface ActivityDetailsFormProps {
  draft: ActivityDraft;
  onUpdateDraft: (updates: Partial<ActivityDraft>) => void;
  onNext: () => void;
}

export function ActivityDetailsForm({ draft, onUpdateDraft, onNext }: ActivityDetailsFormProps) {
  const { colors } = useTheme();

  return (
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
            onChangeText={text => onUpdateDraft({ title: text })}
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
            onChangeText={text => onUpdateDraft({ instructions: text })}
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
                onPress={() => onUpdateDraft({ subject: subj })}
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
                onPress={() => onUpdateDraft({ difficulty: level })}
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
              onChangeText={text => onUpdateDraft({ ageGroupMin: parseInt(text) || 3 })}
              keyboardType="number-pad"
              style={[
                styles.rangeInput,
                { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.rangeTo, { color: colors.textSecondary }]}>to</Text>
            <TextInput
              value={String(draft.ageGroupMax)}
              onChangeText={text => onUpdateDraft({ ageGroupMax: parseInt(text) || 6 })}
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
                onPress={() => onUpdateDraft({ starsReward: stars })}
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
          onPress={onNext}
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.nextButtonText}>Next: Add Content</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
