import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AdminWorkflowItem } from '@/lib/dashboard/admin/types';

interface AdminEscalationPanelProps {
  items: AdminWorkflowItem[];
  onOpenItem: (item: AdminWorkflowItem) => void;
}

export function AdminEscalationPanel({ items, onOpenItem }: AdminEscalationPanelProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Escalation Panel</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>
      <Text style={styles.subtitle}>Screened items awaiting principal decisions</Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
          <Text style={styles.emptyText}>No escalations pending right now.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.slice(0, 4).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.row}
              onPress={() => onOpenItem(item)}
              activeOpacity={0.8}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
                <Text style={styles.rowMeta}>
                  Screening: {item.screening_status.replace(/_/g, ' ')}
                </Text>
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
      marginHorizontal: 16,
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    count: {
      color: '#7C3AED',
      fontSize: 15,
      fontWeight: '800',
    },
    subtitle: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    empty: {
      marginTop: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 10,
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
      marginTop: 10,
      gap: 8,
    },
    row: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.card,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowBody: {
      flex: 1,
      paddingRight: 8,
    },
    rowTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 2,
    },
    rowSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    rowMeta: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
