/**
 * AddStudentNoteModal Component
 * 
 * Modal for teachers to quickly add notes about students.
 * Can send highlights, concerns, achievements, or reminders to parents.
 * 
 * Features:
 * - Note type selection with visual indicators
 * - Student picker for class
 * - Optional acknowledgment requirement
 * - Quick templates for common notes
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '../../../lib/supabase';
// Update the import path below to match your actual ThemeContext location.
// For example, if ThemeContext is in 'contexts/ThemeContext.tsx' at project root:
import { useTheme } from '../../../contexts/ThemeContext';
// Or adjust as needed based on your file structure.
import { useAuth } from '../../../contexts/AuthContext';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface AddStudentNoteModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  classId?: string;
  preschoolId?: string;
  preselectedStudentId?: string;
}

type NoteType = 'highlight' | 'concern' | 'achievement' | 'reminder' | 'general';

const NOTE_TYPES: { type: NoteType; icon: string; color: string; label: string; description: string }[] = [
  { type: 'highlight', icon: 'sunny', color: '#F59E0B', label: 'Daily Highlight', description: 'Share something positive from today' },
  { type: 'achievement', icon: 'trophy', color: '#10B981', label: 'Achievement', description: 'Celebrate a milestone or success' },
  { type: 'reminder', icon: 'notifications', color: '#6366F1', label: 'Reminder', description: 'Remind parent about something' },
  { type: 'concern', icon: 'alert-circle', color: '#EF4444', label: 'Concern', description: 'Share something that needs attention' },
  { type: 'general', icon: 'chatbubble', color: '#3B82F6', label: 'General Note', description: 'Any other message' },
];

const QUICK_TEMPLATES: { type: NoteType; title: string; content: string }[] = [
  { type: 'highlight', title: 'Great Day!', content: '{child} had a wonderful day today! They were engaged and happy during all activities.' },
  { type: 'highlight', title: 'Made a Friend', content: '{child} made a new friend today and showed excellent social skills.' },
  { type: 'achievement', title: 'New Skill', content: '{child} mastered a new skill today! They can now...' },
  { type: 'achievement', title: 'Behavior Star', content: '{child} was our behavior star today! They helped others and followed all the rules.' },
  { type: 'reminder', title: 'Upcoming Event', content: 'Reminder: Please remember to...' },
  { type: 'reminder', title: 'Items Needed', content: 'Please send the following items for {child}:' },
  { type: 'concern', title: 'Minor Issue', content: '{child} had a small issue today. They seemed a bit...' },
];

export function AddStudentNoteModal({
  visible,
  onClose,
  onSuccess,
  classId,
  preschoolId,
  preselectedStudentId,
}: AddStudentNoteModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(preselectedStudentId || null);
  const [noteType, setNoteType] = useState<NoteType>('highlight');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [requiresAck, setRequiresAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (visible && classId) {
      loadStudents();
    }
    if (preselectedStudentId) {
      setSelectedStudentId(preselectedStudentId);
    }
  }, [visible, classId, preselectedStudentId]);

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('first_name');

      if (!error && data) {
        setStudents(data);
        if (data.length === 1) {
          setSelectedStudentId(data[0].id);
        }
      }
    } catch (err) {
      console.error('[AddStudentNote] Error loading students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    const student = students.find(s => s.id === selectedStudentId);
    const childName = student ? student.first_name : 'your child';
    
    setNoteType(template.type);
    setTitle(template.title);
    setContent(template.content.replace('{child}', childName));
    setShowTemplates(false);
  };

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      Alert.alert('Error', 'Please select a student');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter a note');
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();
      const { error } = await supabase.from('teacher_student_notes').insert({
        student_id: selectedStudentId,
        teacher_id: user?.id,
        preschool_id: preschoolId,
        class_id: classId,
        note_type: noteType,
        title: title.trim(),
        content: content.trim(),
        is_visible_to_parents: true,
        requires_acknowledgment: requiresAck,
      });

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Note sent to parent!');
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('[AddStudentNote] Error:', err);
      Alert.alert('Error', err.message || 'Failed to send note');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedStudentId(preselectedStudentId || null);
    setNoteType('highlight');
    setTitle('');
    setContent('');
    setRequiresAck(false);
  };

  const selectedNoteType = NOTE_TYPES.find(n => n.type === noteType)!;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Send Note to Parent</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !selectedStudentId || !title.trim() || !content.trim()}
            style={[
              styles.sendButton,
              { backgroundColor: theme.primary },
              (loading || !selectedStudentId || !title.trim() || !content.trim()) && styles.sendButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Student Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Student</Text>
            {loadingStudents ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.studentList}>
                {students.map(student => (
                  <TouchableOpacity
                    key={student.id}
                    style={[
                      styles.studentChip,
                      { borderColor: theme.border },
                      selectedStudentId === student.id && { 
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      },
                    ]}
                    onPress={() => setSelectedStudentId(student.id)}
                  >
                    <Text
                      style={[
                        styles.studentChipText,
                        { color: selectedStudentId === student.id ? '#FFF' : theme.text },
                      ]}
                    >
                      {student.first_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Note Type Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Note Type</Text>
            <View style={styles.noteTypesGrid}>
              {NOTE_TYPES.map(nt => (
                <TouchableOpacity
                  key={nt.type}
                  style={[
                    styles.noteTypeCard,
                    { borderColor: noteType === nt.type ? nt.color : theme.border },
                    noteType === nt.type && { backgroundColor: `${nt.color}15` },
                  ]}
                  onPress={() => setNoteType(nt.type)}
                >
                  <View style={[styles.noteTypeIcon, { backgroundColor: `${nt.color}20` }]}>
                    <Ionicons name={nt.icon as any} size={20} color={nt.color} />
                  </View>
                  <Text style={[styles.noteTypeLabel, { color: theme.text }]}>{nt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quick Templates */}
          <TouchableOpacity
            style={[styles.templatesButton, { borderColor: theme.border }]}
            onPress={() => setShowTemplates(!showTemplates)}
          >
            <Ionicons name="flash" size={18} color={theme.primary} />
            <Text style={[styles.templatesButtonText, { color: theme.primary }]}>
              {showTemplates ? 'Hide Templates' : 'Use Quick Template'}
            </Text>
            <Ionicons
              name={showTemplates ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.primary}
            />
          </TouchableOpacity>

          {showTemplates && (
            <View style={styles.templatesContainer}>
              {QUICK_TEMPLATES.filter(t => t.type === noteType || noteType === 'general').map((template, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.templateItem, { backgroundColor: theme.card }]}
                  onPress={() => handleSelectTemplate(template)}
                >
                  <Text style={[styles.templateTitle, { color: theme.text }]}>{template.title}</Text>
                  <Text style={[styles.templatePreview, { color: theme.textSecondary }]} numberOfLines={1}>
                    {template.content}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Title Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Title</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Great Day Today!"
              placeholderTextColor={theme.textTertiary}
              maxLength={100}
            />
          </View>

          {/* Content Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Message</Text>
            <TextInput
              style={[styles.textArea, { color: theme.text, borderColor: theme.border }]}
              value={content}
              onChangeText={setContent}
              placeholder="Write your message to the parent..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: theme.textTertiary }]}>
              {content.length}/500
            </Text>
          </View>

          {/* Requires Acknowledgment Toggle */}
          {(noteType === 'concern' || noteType === 'reminder') && (
            <TouchableOpacity
              style={[styles.ackToggle, { borderColor: theme.border }]}
              onPress={() => setRequiresAck(!requiresAck)}
            >
              <View style={styles.ackToggleContent}>
                <Ionicons
                  name={requiresAck ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={requiresAck ? theme.primary : theme.textSecondary}
                />
                <View style={styles.ackToggleText}>
                  <Text style={[styles.ackToggleLabel, { color: theme.text }]}>
                    Require Acknowledgment
                  </Text>
                  <Text style={[styles.ackToggleDesc, { color: theme.textSecondary }]}>
                    Parent must confirm they've read this note
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Note Type Info */}
          <View style={[styles.noteTypeInfo, { backgroundColor: `${selectedNoteType.color}10` }]}>
            <Ionicons name={selectedNoteType.icon as any} size={16} color={selectedNoteType.color} />
            <Text style={[styles.noteTypeInfoText, { color: selectedNoteType.color }]}>
              {selectedNoteType.description}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    closeButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
    },
    sendButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: '#FFF',
      fontWeight: '600',
      fontSize: 15,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    studentList: {
      flexDirection: 'row',
    },
    studentChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: 8,
    },
    studentChipText: {
      fontSize: 14,
      fontWeight: '500',
    },
    noteTypesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    noteTypeCard: {
      width: '30%',
      padding: 10,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
    },
    noteTypeIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    noteTypeLabel: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    templatesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 12,
      gap: 8,
    },
    templatesButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    templatesContainer: {
      marginBottom: 16,
    },
    templateItem: {
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
    },
    templateTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    templatePreview: {
      fontSize: 13,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      minHeight: 100,
    },
    charCount: {
      fontSize: 12,
      textAlign: 'right',
      marginTop: 4,
    },
    ackToggle: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    ackToggleContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    ackToggleText: {
      marginLeft: 10,
      flex: 1,
    },
    ackToggleLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    ackToggleDesc: {
      fontSize: 13,
      marginTop: 2,
    },
    noteTypeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      gap: 8,
      marginBottom: 30,
    },
    noteTypeInfoText: {
      fontSize: 13,
      fontWeight: '500',
    },
  });

export default AddStudentNoteModal;
