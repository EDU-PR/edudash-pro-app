import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';

export interface LearnerQuickAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: number;
}

export interface QuickActionsProps {
  actions: LearnerQuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <TouchableOpacity key={action.title} onPress={action.onPress} activeOpacity={0.7}>
          <Card padding={16} margin={0} elevation="small" style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={action.icon} size={28} color={theme.primary} />
              {!!action.badge && action.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.error }]}>
                  <Text style={styles.badgeText}>{action.badge > 9 ? '9+' : String(action.badge)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {action.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {action.subtitle}
            </Text>
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    card: {
      width: '47%',
      alignItems: 'center',
      minHeight: 120,
    },
    iconWrap: {
      marginBottom: 12,
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -8,
      right: -8,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    title: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
      textAlign: 'center',
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      fontWeight: '500',
    },
  });



