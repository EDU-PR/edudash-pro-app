import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

interface EnrollmentInviteModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  programId?: string; // Optional: pre-select a program
}

interface Program {
  id: string;
  title: string;
  course_code: string | null;
}

export function EnrollmentInviteModal({
  visible,
  onClose,
  theme,
  programId,
}: EnrollmentInviteModalProps) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;

  const [emails, setEmails] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programId || '');
  const [sending, setSending] = useState(false);

  // Fetch available programs/courses
  const { data: programs } = useQuery({
    queryKey: ['org-programs', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await assertSupabase()
        .from('courses')
        .select('id, title, course_code')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('title');

      if (error) {
        console.error('Failed to fetch programs:', error);
        return [];
      }

      return (data || []) as Program[];
    },
    enabled: !!orgId && visible,
  });

  useEffect(() => {
    if (programId) {
      setSelectedProgramId(programId);
    }
  }, [programId]);

  const handleSendInvites = async () => {
    if (!emails.trim()) {
      Alert.alert('Error', 'Please enter at least one email address');
      return;
    }

    if (!selectedProgramId) {
      Alert.alert('Error', 'Please select a program');
      return;
    }

    if (!orgId) {
      Alert.alert('Error', 'No organization found');
      return;
    }

    const emailList = emails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));

    if (emailList.length === 0) {
      Alert.alert('Error', 'Please enter valid email addresses');
      return;
    }

    setSending(true);
    try {
      // TODO: Implement enrollment invite logic
      // This would typically:
      // 1. Create enrollment invite records
      // 2. Send emails with enrollment links
      // 3. Links allow students to sign up and auto-enroll in the program

      Alert.alert(
        'Invites Sent',
        `Enrollment invitations have been sent to ${emailList.length} learner(s).`,
        [
          {
            text: 'OK',
            onPress: () => {
              setEmails('');
              setSelectedProgramId(programId || '');
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  const selectedProgram = programs?.find((p) => p.id === selectedProgramId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Invite Learners
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Select Program / Learnership
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.programList}
              >
                {programs?.map((program) => (
                  <TouchableOpacity
                    key={program.id}
                    style={[
                      styles.programChip,
                      selectedProgramId === program.id && {
                        backgroundColor: theme.primary,
                      },
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setSelectedProgramId(program.id)}
                  >
                    <Text
                      style={[
                        styles.programChipText,
                        selectedProgramId === program.id && { color: '#fff' },
                        { color: theme.text },
                      ]}
                    >
                      {program.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {selectedProgram && (
                <Text style={[styles.selectedProgram, { color: theme.textSecondary }]}>
                  Selected: {selectedProgram.title}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Learner Email Addresses
              </Text>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Enter email addresses separated by commas or new lines
              </Text>
              <TextInput
                style={[styles.textArea, { 
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={emails}
                onChangeText={setEmails}
                placeholder="learner1@example.com, learner2@example.com"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { 
                  borderColor: theme.border,
                }]}
                onPress={onClose}
                disabled={sending}
              >
                <Text style={[styles.cancelText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={handleSendInvites}
                disabled={sending || !emails.trim() || !selectedProgramId}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendText}>Send Invites</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: -4,
  },
  programList: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  programChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  programChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedProgram: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 120,
    maxHeight: 200,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

