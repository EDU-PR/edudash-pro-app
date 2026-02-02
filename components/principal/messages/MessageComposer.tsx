// Message Composer Component

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface MessageComposerProps {
  subject: string;
  message: string;
  recipientCount: number;
  recipientLabel: string;
  sending: boolean;
  onSubjectChange: (text: string) => void;
  onMessageChange: (text: string) => void;
  onSend: () => void;
}

export function MessageComposer({
  subject,
  message,
  recipientCount,
  recipientLabel,
  sending,
  onSubjectChange,
  onMessageChange,
  onSend,
}: MessageComposerProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Compose Message</Text>
      
      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={onSubjectChange}
        placeholder="Enter message subject..."
        placeholderTextColor={theme.textSecondary}
      />

      <Text style={[styles.label, { marginTop: 16 }]}>Message</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={onMessageChange}
        placeholder="Write your message to the school community..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <View style={styles.sendRow}>
        <View style={styles.sendInfo}>
          <Ionicons name="paper-plane" size={16} color={theme.textSecondary} />
          <Text style={styles.sendInfoText}>
            Will be sent to ~{recipientCount} {recipientLabel}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={sending}
        >
          {sending ? (
            <EduDashSpinner color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendButtonText}>Send</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme?.card || '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
    marginBottom: 16,
  },
  cardTitle: {
    color: theme?.text || '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    color: theme?.text || '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: theme?.surface || '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme?.border || '#374151',
    padding: 14,
    color: theme?.text || '#fff',
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
  },
  sendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#1f2937',
  },
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sendInfoText: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 13,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme?.primary || '#00f5ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: theme?.onPrimary || '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});
