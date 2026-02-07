import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AdminActivityItem } from '@/lib/dashboard/admin/types';

interface AdminActivityFeedProps {
  items: AdminActivityItem[];
}

function activityIcon(action: string): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case 'principal_decision':
      return 'shield-checkmark-outline';
    case 'screened':
      return 'search-outline';
    case 'request_created':
      return 'add-circle-outline';
    default:
      return 'pulse-outline';
  }
}

function timeLabel(isoDate: string): string {
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-ZA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminActivityFeed({ items }: AdminActivityFeedProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity Feed</Text>
      <Text style={styles.subtitle}>Recent workflow actions and outcomes</Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No activity yet for this organization.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={activityIcon(item.action)} size={16} color={theme.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowSummary} numberOfLines={2}>
                  {item.summary}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.by} · {timeLabel(item.timestamp)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    subtitle: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    empty: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 10,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    list: {
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 10,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: `${theme.primary}22`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      marginTop: 2,
    },
    rowBody: {
      flex: 1,
    },
    rowSummary: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      marginBottom: 3,
    },
    rowMeta: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
  });
