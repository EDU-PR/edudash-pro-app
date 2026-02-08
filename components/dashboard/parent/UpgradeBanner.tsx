/**
 * UpgradeBanner — Compact upgrade CTA for free-tier parents
 * 
 * Shows when the user has locked actions that require a subscription
 * upgrade. Includes sparkle icon, upgrade text, and CTA button.
 * 
 * ≤80 lines — WARP-compliant presentational component.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';

interface UpgradeBannerProps {
  title: string;
  tier: string | null;
  visible: boolean;
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ title, tier, visible }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.cardBackground, borderColor: theme.primary + '20' }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name="sparkles" size={16} color="#FFD700" />
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => {
            track('parent.dashboard.upgrade_cta_clicked', { source: 'free_tier_banner', tier });
            router.push('/pricing');
          }}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {t('common.upgrade', { defaultValue: 'Upgrade' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  textBlock: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
  },
  buttonText: { fontSize: 13, fontWeight: '600' },
});

export default UpgradeBanner;
