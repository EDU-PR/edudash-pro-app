// Message History List Component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { MessageHistory } from './types';

interface MessageHistoryListProps {
  messages: MessageHistory[];
}

export function MessageHistoryList({ messages }: MessageHistoryListProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (messages.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Recent Messages</Text>
      {messages.map(m => (
        <View key={m.id} style={styles.historyItem}>
          <View style={styles.historyHeader}>
            <Text style={styles.historySubject}>{m.subject}</Text>
            <Text style={styles.historyDate}>
              {new Date(m.sent_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.historyMessage} numberOfLines={2}>
            {m.message}
          </Text>
          {m.class_name && (
            <View style={styles.historyBadge}>
              <Ionicons name="layers" size={12} color="#F59E0B" />
              <Text style={styles.historyBadgeText}>{m.class_name}</Text>
            </View>
          )}
        </View>
      ))}
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
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#1f2937',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historySubject: {
    color: theme?.text || '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  historyDate: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 12,
  },
  historyMessage: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  historyBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
});
