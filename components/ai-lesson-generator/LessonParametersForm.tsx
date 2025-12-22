/**
 * LessonParametersForm - Form inputs for lesson generation parameters
 * @module components/ai-lesson-generator/LessonParametersForm
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import type { LessonParametersFormProps } from './types';
import {
  SUBJECT_OPTIONS,
  GRADE_LEVEL_OPTIONS,
  DURATION_OPTIONS,
  LANGUAGE_OPTIONS,
} from './types';

/**
 * Form component for entering lesson generation parameters
 */
export function LessonParametersForm({
  formState,
  onFormChange,
  isGenerating,
  onGenerate,
  disabled = false,
}: LessonParametersFormProps) {
  const isFormValid = formState.topic.trim().length >= 3;
  const canGenerate = isFormValid && !isGenerating && !disabled;

  return (
    <View style={styles.container}>
      {/* Topic Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Lesson Topic <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textInput, disabled && styles.inputDisabled]}
          placeholder="e.g., Introduction to Fractions"
          placeholderTextColor="#9CA3AF"
          value={formState.topic}
          onChangeText={(value) => onFormChange('topic', value)}
          editable={!isGenerating && !disabled}
          multiline={false}
        />
        {formState.topic.length > 0 && formState.topic.length < 3 && (
          <Text style={styles.helperText}>Topic must be at least 3 characters</Text>
        )}
      </View>

      {/* Subject Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Subject</Text>
        <View style={[styles.pickerContainer, disabled && styles.inputDisabled]}>
          <Picker
            selectedValue={formState.subject}
            onValueChange={(value) => onFormChange('subject', value)}
            style={styles.picker}
            enabled={!isGenerating && !disabled}
          >
            {SUBJECT_OPTIONS.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Grade Level Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Grade Level</Text>
        <View style={[styles.pickerContainer, disabled && styles.inputDisabled]}>
          <Picker
            selectedValue={formState.gradeLevel}
            onValueChange={(value) => onFormChange('gradeLevel', value)}
            style={styles.picker}
            enabled={!isGenerating && !disabled}
          >
            {GRADE_LEVEL_OPTIONS.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Duration Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Duration</Text>
        <View style={[styles.pickerContainer, disabled && styles.inputDisabled]}>
          <Picker
            selectedValue={formState.duration}
            onValueChange={(value) => onFormChange('duration', value)}
            style={styles.picker}
            enabled={!isGenerating && !disabled}
          >
            {DURATION_OPTIONS.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Language Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Language</Text>
        <View style={[styles.pickerContainer, disabled && styles.inputDisabled]}>
          <Picker
            selectedValue={formState.language}
            onValueChange={(value) => onFormChange('language', value)}
            style={styles.picker}
            enabled={!isGenerating && !disabled}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Learning Objectives (optional) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Learning Objectives (optional)</Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            disabled && styles.inputDisabled,
          ]}
          placeholder="Enter specific learning objectives, one per line..."
          placeholderTextColor="#9CA3AF"
          value={formState.objectives}
          onChangeText={(value) => onFormChange('objectives', value)}
          editable={!isGenerating && !disabled}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={[
          styles.generateButton,
          !canGenerate && styles.generateButtonDisabled,
        ]}
        onPress={onGenerate}
        disabled={!canGenerate}
        activeOpacity={0.8}
      >
        {isGenerating ? (
          <>
            <Ionicons name="hourglass-outline" size={20} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>Generating...</Text>
          </>
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>Generate Lesson</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
  helperText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#111827',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default LessonParametersForm;
