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

export const DashUsageBanner: React.FC<DashUsageBannerProps> = React.memo(function DashUsageBanner({
  tierStatus,
  usageLabel,
  styles,
  theme,
}) {
  if (!tierStatus) return null;
  const shouldShowProgress = tierStatus.quotaLimit > 0 && tierStatus.quotaPercentage >= 60;
  const progressColor = tierStatus.quotaPercentage >= 90 ? theme.error : theme.primary;

  return (
    <View style={[styles.usageBanner, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
      <Text numberOfLines={1} style={[styles.usageBannerText, { color: theme.textSecondary }]}>
        {usageLabel}
      </Text>
      {shouldShowProgress && (
        <View style={[styles.usageProgress, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.usageProgressFill,
              { backgroundColor: progressColor, width: `${Math.min(tierStatus.quotaPercentage, 100)}%` },
            ]}
          />
        </View>
      )}
    </View>
  );
});
