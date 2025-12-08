/**
 * Start Lesson Modal
 * Advanced settings: title, class, scheduling, duration, reminders
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  student_count?: number;
}

interface StartLessonModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  lessonTitle: string;
  setLessonTitle: (title: string) => void;
  selectedClass: string;
  setSelectedClass: (id: string) => void;
  classes: Class[];
  isScheduled: boolean;
  setIsScheduled: (value: boolean) => void;
  scheduledDate: string;
  setScheduledDate: (date: string) => void;
  scheduledTime: string;
  setScheduledTime: (time: string) => void;
  sendReminders: boolean;
  setSendReminders: (value: boolean) => void;
  customDuration: number;
  setCustomDuration: (duration: number) => void;
  durationOptions: { value: number; label: string }[];
  maxDurationMinutes: number;
  tierBadge: string;
  tierLabel: string;
  isCreating: boolean;
  error: string | null;
  colors: any;
}

export function StartLessonModal(props: StartLessonModalProps) {
  const {
    visible,
    onClose,
    onSubmit,
    lessonTitle,
    setLessonTitle,
    selectedClass,
    setSelectedClass,
    classes,
    isScheduled,
    setIsScheduled,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    sendReminders,
    setSendReminders,
    customDuration,
    setCustomDuration,
    durationOptions,
    maxDurationMinutes,
    tierBadge,
    tierLabel,
    isCreating,
    error,
    colors,
  } = props;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.modalBg }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.icon}>
                <Ionicons name="videocam" size={24} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.title}>Start Live Lesson</Text>
                <Text style={styles.subtitle}>Parents will be notified instantly</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {/* Lesson Title */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Lesson Title</Text>
              <TextInput
                value={lessonTitle}
                onChangeText={setLessonTitle}
                placeholder="e.g., Math - Counting to 10"
                placeholderTextColor={colors.textDimmed}
                style={[styles.input, { 
                  backgroundColor: colors.inputBg, 
                  color: colors.text, 
                  borderColor: colors.inputBorder 
                }]}
              />
            </View>

            {/* Class Selector */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Select Class</Text>
              <View style={styles.classGrid}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[
                      styles.classCard,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      selectedClass === cls.id && { 
                        borderColor: colors.accent, 
                        backgroundColor: colors.accentLight 
                      },
                    ]}
                    onPress={() => setSelectedClass(cls.id)}
                  >
                    <Text style={[styles.className, { color: colors.text }]}>{cls.name}</Text>
                    <Text style={[styles.classInfo, { color: colors.textMuted }]}>
                      {cls.grade_level || 'All Ages'} • {cls.student_count} students
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Schedule Toggle */}
            <TouchableOpacity
              style={[
                styles.scheduleToggle,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                isScheduled && { borderColor: colors.accent, backgroundColor: colors.accentLight },
              ]}
              onPress={() => setIsScheduled(!isScheduled)}
            >
              <View style={[
                styles.checkbox,
                { borderColor: isScheduled ? colors.accent : colors.border },
                isScheduled && { backgroundColor: colors.accent },
              ]}>
                {isScheduled && <Ionicons name="calendar" size={12} color="#ffffff" />}
              </View>
              <View style={styles.scheduleToggleText}>
                <Text style={[styles.scheduleToggleTitle, { color: colors.text }]}>Schedule for Later</Text>
                <Text style={[styles.scheduleToggleSubtitle, { color: colors.textMuted }]}>
                  Set a specific date and time
                </Text>
              </View>
            </TouchableOpacity>

            {/* Schedule Fields */}
            {isScheduled && (
              <View style={styles.scheduleFields}>
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleCol}>
                    <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Date</Text>
                    <TextInput
                      value={scheduledDate}
                      onChangeText={setScheduledDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textDimmed}
                      style={[styles.smallInput, { 
                        backgroundColor: colors.inputBg, 
                        color: colors.text,
                        borderColor: colors.inputBorder 
                      }]}
                    />
                  </View>
                  <View style={styles.scheduleCol}>
                    <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Time</Text>
                    <TextInput
                      value={scheduledTime}
                      onChangeText={setScheduledTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textDimmed}
                      style={[styles.smallInput, { 
                        backgroundColor: colors.inputBg, 
                        color: colors.text,
                        borderColor: colors.inputBorder 
                      }]}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.reminderToggle, { backgroundColor: colors.inputBg }]}
                  onPress={() => setSendReminders(!sendReminders)}
                >
                  <View style={[
                    styles.smallCheckbox,
                    { borderColor: sendReminders ? colors.accent : colors.border },
                    sendReminders && { backgroundColor: colors.accent },
                  ]}>
                    {sendReminders && <Ionicons name="notifications" size={10} color="#ffffff" />}
                  </View>
                  <Text style={[styles.reminderText, { color: colors.text }]}>
                    Send reminders to parents
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Duration Selector */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Lesson Duration</Text>
              <View style={styles.durationGrid}>
                {durationOptions.map((option) => {
                  const isSelected = customDuration === option.value || 
                    (customDuration === 0 && option.value === maxDurationMinutes);
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.durationButton,
                        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                        isSelected && { 
                          borderColor: colors.accent, 
                          backgroundColor: colors.accentLight 
                        },
                      ]}
                      onPress={() => setCustomDuration(option.value)}
                    >
                      <Text style={[
                        styles.durationButtonText,
                        { color: isSelected ? colors.accent : colors.textMuted },
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.durationHint, { color: colors.textDimmed }]}>
                Your {tierBadge} plan allows up to {tierLabel}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }]}
              onPress={onSubmit}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name={isScheduled ? "calendar" : "play-circle"} size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>
                    {isScheduled ? 'Schedule Lesson' : 'Start Live Lesson'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 28,
    backgroundColor: '#7c3aed',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 20,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 15,
  },
  classGrid: {
    gap: 10,
  },
  classCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  className: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 13,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleToggleText: {
    flex: 1,
  },
  scheduleToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  scheduleToggleSubtitle: {
    fontSize: 12,
  },
  scheduleFields: {
    marginBottom: 16,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  scheduleCol: {
    flex: 1,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  smallInput: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    fontSize: 14,
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  smallCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderText: {
    fontSize: 13,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    minWidth: 65,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationHint: {
    fontSize: 11,
    marginTop: 6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
