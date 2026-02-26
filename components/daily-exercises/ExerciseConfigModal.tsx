/**
 * ExerciseConfigModal
 *
 * Full-screen modal allowing parents to configure the daily exercise routine
 * for their child: subjects, question count, difficulty, and reminders.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useSaveDailyExerciseConfig } from '@/hooks/daily-exercises';
import {
  SUBJECT_OPTIONS,
  QUESTIONS_PER_SUBJECT_OPTIONS,
  DIFFICULTY_OPTIONS,
  type SubjectConfig,
  type DifficultyLevel,
} from '@/lib/daily-exercises/types';

interface ExerciseConfigModalProps {
  visible: boolean;
  onClose: () => void;
  studentId: string | undefined;
  studentName: string | undefined;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DEFAULT_DAYS = [true, true, true, true, true, false, false];

export function ExerciseConfigModal({
  visible,
  onClose,
  studentId,
  studentName,
}: ExerciseConfigModalProps) {
  const { t } = useTranslation();
  const saveMutation = useSaveDailyExerciseConfig();

  const [subjects, setSubjects] = useState<SubjectConfig[]>(() =>
    SUBJECT_OPTIONS.map((s) => ({ ...s })),
  );
  const [questionsPerSubject, setQuestionsPerSubject] = useState(5);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('adaptive');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime] = useState('15:00');
  const [reminderDays, setReminderDays] = useState<boolean[]>([...DEFAULT_DAYS]);

  const coreSubjects = useMemo(
    () => subjects.filter((s) => s.code === 'mathematics' || s.code === 'english_hl'),
    [subjects],
  );
  const additionalSubjects = useMemo(
    () => subjects.filter((s) => s.code !== 'mathematics' && s.code !== 'english_hl'),
    [subjects],
  );

  const enabledCoreCount = coreSubjects.filter((s) => s.enabled).length;

  const toggleSubject = useCallback((code: string) => {
    setSubjects((prev) => {
      const updated = prev.map((s) => (s.code === code ? { ...s, enabled: !s.enabled } : s));
      const core = updated.filter((s) => s.code === 'mathematics' || s.code === 'english_hl');
      if (core.filter((s) => s.enabled).length === 0) return prev;
      return updated;
    });
  }, []);

  const toggleDay = useCallback((index: number) => {
    setReminderDays((prev) => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!studentId) return;
    await saveMutation.mutateAsync({
      studentId,
      subjects,
      questionsPerSubject,
      difficulty,
      reminderEnabled,
      reminderTime,
      reminderDays,
    });
    onClose();
  }, [studentId, subjects, questionsPerSubject, difficulty, reminderEnabled, reminderTime, reminderDays, saveMutation, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <LinearGradient colors={['#070B16', '#0F121E']} style={StyleSheet.absoluteFillObject} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('dailyExercise.configTitle', { defaultValue: 'Daily Practice Setup' })}
          </Text>
          <View style={styles.closeButton} />
        </View>

        {studentName && <Text style={styles.studentLabel}>Setting up for {studentName}</Text>}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Core Subjects */}
          <SectionHeader label="Core Subjects (at least one required)" />
          {coreSubjects.map((subject) => (
            <SubjectToggleRow
              key={subject.code}
              subject={subject}
              onToggle={toggleSubject}
              disabled={subject.enabled && enabledCoreCount <= 1}
            />
          ))}

          {/* Additional Subjects */}
          <SectionHeader label="Additional Subjects" />
          {additionalSubjects.map((subject) => (
            <SubjectToggleRow key={subject.code} subject={subject} onToggle={toggleSubject} />
          ))}

          {/* Questions per Subject */}
          <SectionHeader label="Questions per Subject" />
          <View style={styles.optionRow}>
            {QUESTIONS_PER_SUBJECT_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.optionPill, questionsPerSubject === n && styles.optionPillActive]}
                onPress={() => setQuestionsPerSubject(n)}
              >
                <Text style={[styles.optionPillText, questionsPerSubject === n && styles.optionPillTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty */}
          <SectionHeader label="Difficulty" />
          {DIFFICULTY_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt.value} style={styles.radioRow} onPress={() => setDifficulty(opt.value)}>
              <View style={[styles.radioOuter, difficulty === opt.value && styles.radioOuterActive]}>
                {difficulty === opt.value && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.radioLabel, difficulty === opt.value && styles.radioLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Alert Settings */}
          <SectionHeader label="Reminder Settings" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Remind my child daily</Text>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: '#374151', true: 'rgba(0,245,255,0.4)' }}
              thumbColor={reminderEnabled ? '#00F5FF' : '#6B7280'}
            />
          </View>

          {reminderEnabled && (
            <>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={18} color="#9CA3AF" />
                <Text style={styles.timeText}>{reminderTime}</Text>
              </View>

              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, idx) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.dayChip, reminderDays[idx] && styles.dayChipActive]}
                    onPress={() => toggleDay(idx)}
                  >
                    <Text style={[styles.dayChipText, reminderDays[idx] && styles.dayChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveButton, saveMutation.isPending && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saveMutation.isPending}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#00C6CF', '#0070E0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveButtonText}>
                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function SubjectToggleRow({
  subject,
  onToggle,
  disabled,
}: {
  subject: SubjectConfig;
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{subject.label}</Text>
      <Switch
        value={subject.enabled}
        onValueChange={() => !disabled && onToggle(subject.code)}
        disabled={disabled}
        trackColor={{ false: '#374151', true: 'rgba(0,245,255,0.4)' }}
        thumbColor={subject.enabled ? '#00F5FF' : '#6B7280'}
      />
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B16' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeButton: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  studentLabel: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingTop: 8 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00F5FF',
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  toggleLabel: { fontSize: 15, color: '#E2E8F0' },
  optionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  optionPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionPillActive: { borderColor: '#00F5FF', backgroundColor: 'rgba(0,245,255,0.15)' },
  optionPillText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  optionPillTextActive: { color: '#00F5FF' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: '#00F5FF' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00F5FF' },
  radioLabel: { fontSize: 15, color: '#9CA3AF' },
  radioLabelActive: { color: '#E2E8F0' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  timeText: { fontSize: 15, color: '#E2E8F0' },
  dayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dayChipActive: { borderColor: '#00F5FF', backgroundColor: 'rgba(0,245,255,0.15)' },
  dayChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  dayChipTextActive: { color: '#00F5FF' },
  saveButton: { marginTop: 32, borderRadius: 14, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.5 },
  saveGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
