import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AdminInboxItem } from '@/lib/dashboard/admin/types';

interface AdminOperationalInboxProps {
  items: AdminInboxItem[];
  onOpenItem: (item: AdminInboxItem) => void;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function priorityColor(priority: AdminInboxItem['priority']): string {
  switch (priority) {
    case 'urgent':
      return '#EF4444';
    case 'high':
      return '#F59E0B';
    case 'low':
      return '#10B981';
    case 'normal':
    default:
      return '#3B82F6';
  }
}

export function AdminOperationalInbox({ items, onOpenItem }: AdminOperationalInboxProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Operational Inbox</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>
      <Text style={styles.subtitle}>Prioritized actions for today</Text>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={20} color="#10B981" />
          <Text style={styles.emptyText}>No pending operational items right now.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.slice(0, 6).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemRow}
              onPress={() => onOpenItem(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.priorityDot, { backgroundColor: priorityColor(item.priority) }]} />
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.itemSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
                <Text style={styles.itemMeta}>{formatRelativeTime(item.created_at)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      marginHorizontal: 16,
      marginTop: 14,
      padding: 14,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    count: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    subtitle: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    emptyState: {
      marginTop: 14,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    list: {
      marginTop: 12,
      gap: 8,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 10,
      backgroundColor: theme.card,
    },
    priorityDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginRight: 10,
    },
    itemBody: {
      flex: 1,
      paddingRight: 8,
    },
    itemTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 1,
    },
    itemSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    itemMeta: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
