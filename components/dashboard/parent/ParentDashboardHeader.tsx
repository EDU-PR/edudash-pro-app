/**
 * ParentDashboardHeader — Greeting, role badge, and tier badge
 * 
 * Compact header row displaying time-of-day greeting with the parent's
 * name, their role badge, and subscription tier indicator.
 * 
 * ≤100 lines — WARP-compliant presentational component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface ParentDashboardHeaderProps {
  greeting: string;
  tier: string | null;
}

export const ParentDashboardHeader: React.FC<ParentDashboardHeaderProps> = ({
  greeting,
  tier,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const tierLower = (tier || '').toLowerCase();
  const isFreeTier = !tier || tierLower === 'free' || tierLower === '';

  const tierLabel = isFreeTier
    ? t('subscription.free', { defaultValue: 'Free' })
    : (tierLower === 'parent_starter' || tierLower === 'starter')
      ? t('subscription.starter', { defaultValue: 'Starter' })
      : (tierLower === 'parent_plus' || tierLower === 'pro' || tierLower === 'premium')
        ? t('subscription.plus', { defaultValue: 'Plus' })
        : tierLower === 'enterprise'
          ? t('subscription.enterprise', { defaultValue: 'Enterprise' })
          : t('subscription.premium', { defaultValue: 'Premium' });

  return (
    <View style={styles.container}>
      <View style={styles.greetingRow}>
        <Text style={[styles.greeting, { color: theme.text }]}>{greeting}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>
              {t('roles.parent', { defaultValue: 'Parent' })}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: isFreeTier ? theme.textSecondary + '20' : theme.success + '20' },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isFreeTier ? theme.textSecondary : theme.success },
              ]}
            >
              {tierLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  greeting: { fontSize: 20, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});

export default ParentDashboardHeader;
