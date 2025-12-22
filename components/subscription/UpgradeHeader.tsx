/**
 * Upgrade header section component
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UpgradeReason } from './types';
import { withAlpha } from './utils';

interface UpgradeHeaderProps {
  reason: UpgradeReason;
  currentTier: string;
}

export function UpgradeHeader({ reason, currentTier }: UpgradeHeaderProps) {
  return (
    <>
      <View style={styles.headerSection}>
        <View style={[styles.reasonIcon, { backgroundColor: withAlpha(reason.color, 0.125) }]}>
          <Ionicons name={(reason.icon || 'trending-up') as any} size={32} color={reason.color} />
        </View>
        <Text style={styles.title}>{reason.title}</Text>
        <Text style={styles.subtitle}>{reason.subtitle}</Text>
      </View>

      {currentTier && currentTier !== 'free' && (
        <View style={styles.currentTierCard}>
          <Text style={styles.currentTierLabel}>Your current plan:</Text>
          <Text style={styles.currentTierName}>{currentTier} Plan</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  reasonIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  currentTierCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  currentTierLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  currentTierName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
