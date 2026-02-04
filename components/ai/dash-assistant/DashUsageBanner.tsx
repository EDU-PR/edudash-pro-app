/**
 * DashUsageBanner Component
 * 
 * Usage quota banner with progress bar for Dash AI Assistant.
 * Extracted from DashAssistant for WARP.md compliance.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

type Theme = ReturnType<typeof useTheme>['theme'];

interface TierStatus {
  quotaLimit: number;
  quotaUsed: number;
  quotaPercentage: number;
  tierDisplayName: string;
}

interface DashUsageBannerProps {
  tierStatus: TierStatus | null;
  usageLabel: string;
  styles: any;
  theme: Theme;
}

export const DashUsageBanner: React.FC<DashUsageBannerProps> = ({
  tierStatus,
  usageLabel,
  styles,
  theme,
}) => {
  if (!tierStatus) return null;

  return (
    <View style={[styles.usageBanner, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
      <Text style={[styles.usageBannerText, { color: theme.textSecondary }]}>
        {usageLabel}
      </Text>
      {tierStatus.quotaLimit > 0 && (
        <View style={[styles.usageProgress, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.usageProgressFill,
              { backgroundColor: theme.primary, width: `${Math.min(tierStatus.quotaPercentage, 100)}%` },
            ]}
          />
        </View>
      )}
    </View>
  );
};
