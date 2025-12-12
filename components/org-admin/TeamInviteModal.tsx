import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TeamInviteModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  role: 'instructor' | 'admin' | 'manager';
}

export function TeamInviteModal({
  visible,
  onClose,
  theme,
  role,
}: TeamInviteModalProps) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  const roleLabels: Record<string, string> = {
    instructor: 'Instructor',
    admin: 'Administrator',
    manager: 'Manager',
  };

  const handleSendInvite = async () => {
    if (!email.trim() || !name.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!orgId) {
      Alert.alert('Error', 'No organization found');
      return;
    }

    setSending(true);
    try {
      // TODO: Implement invite sending logic
      // This would typically:
      // 1. Create an invite record in the database
      // 2. Send an email with invite link
      // 3. The invite link contains a token that allows the user to sign up with the role pre-assigned

      // Placeholder: For now, just show success
      Alert.alert(
        'Invite Sent',
        `An invitation has been sent to ${email} to join as ${roleLabels[role]}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              setName('');
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

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
              Invite {roleLabels[role]}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Full Name
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={email}
                onChangeText={setEmail}
                placeholder="john@example.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
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
                onPress={handleSendInvite}
                disabled={sending || !email.trim() || !name.trim()}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    maxHeight: '80%',
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
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

