/**
 * K12ParentQuickActions
 *
 * Reduced quick-action grid with the 6 most-used parent actions:
 * Homework, Messages, My Children, Payments, Attendance, Progress.
 * Ordered by parent priority.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ThemeColors } from '@/contexts/ThemeContext';
import type { K12ParentActionId } from '@/lib/navigation/k12ParentActionMap';
import { GlassCard } from '@/components/nextgen/GlassCard';
import { styles } from './K12ParentDashboard.styles';

interface K12ParentQuickActionsProps {
  onActionPress: (actionId: K12ParentActionId) => void;
  theme: ThemeColors;
  quickWinsEnabled: boolean;
}

interface QuickAction {
  id: string;
  actionId: K12ParentActionId;
  icon: string;
  label: string;
  color: string;
}

export function K12ParentQuickActions({
  onActionPress,
  theme,
  quickWinsEnabled,
}: K12ParentQuickActionsProps) {
  const { t } = useTranslation();

  const quickActions: QuickAction[] = useMemo(() => [
    { id: 'homework', actionId: 'homework', icon: 'document-text', label: t('dashboard.parent.nav.homework', { defaultValue: 'Homework' }), color: '#06B6D4' },
    { id: 'messages', actionId: 'messages', icon: 'chatbubbles', label: t('navigation.messages', { defaultValue: 'Messages' }), color: '#3B82F6' },
    { id: 'children', actionId: 'children', icon: 'people', label: t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' }), color: '#4F46E5' },
    { id: 'payments', actionId: 'payments', icon: 'card', label: t('dashboard.parent.nav.payments', { defaultValue: 'Payments' }), color: '#8B5CF6' },
    { id: 'attendance', actionId: 'attendance', icon: 'calendar-outline', label: t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' }), color: '#F59E0B' },
    { id: 'progress', actionId: 'progress', icon: 'ribbon', label: t('dashboard.progress', { defaultValue: 'Progress' }), color: '#10B981' },
  ], [t]);

  return (
    <View style={styles.section}>
      <GlassCard style={styles.sectionHeaderCard} padding={14}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>
            {t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })}
          </Text>
        </View>
        <Text style={[styles.sectionHeaderHint, { color: theme.textSecondary }]}>
          {t('dashboard.quick_actions_hint', { defaultValue: 'Shortcuts to messages, attendance, payments, and announcements.' })}
        </Text>
      </GlassCard>
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: quickWinsEnabled ? 'rgba(255,255,255,0.06)' : theme.surfaceVariant,
                borderColor: quickWinsEnabled ? 'rgba(255,255,255,0.08)' : theme.border,
                borderWidth: 1,
              },
            ]}
            onPress={() => onActionPress(action.actionId)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
              <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={24} color={action.color} />
            </View>
            <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
