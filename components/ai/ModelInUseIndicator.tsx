/**
 * Compact "model in use" indicator for AI screens.
 * Shows display name and optional cost hint (e.g. "Using: Dash Smart ●●").
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getDefaultModels, type AIModelId } from '@/lib/ai/models';

const COST_DOTS = (cost: number): string =>
  cost <= 1 ? '●' : cost <= 5 ? '●●' : '●●●';

export interface ModelInUseIndicatorProps {
  modelId: AIModelId | string;
  showCostDots?: boolean;
  label?: string;
  compact?: boolean;
}

export function ModelInUseIndicator({
  modelId,
  showCostDots = true,
  label = 'Using',
  compact = false,
}: ModelInUseIndicatorProps): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const models = getDefaultModels();
  const model = models.find((m) => m.id === modelId);
  const displayName = model?.displayName ?? model?.name ?? String(modelId);
  const costDots = showCostDots && model ? COST_DOTS(model.relativeCost) : null;
  const labelText = label ?? t('common.ai_model_in_use');

  if (compact) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
        <Ionicons name="hardware-chip-outline" size={12} color={theme.primary} />
        <Text style={[styles.compactText, { color: theme.textSecondary }]} numberOfLines={1}>
          {displayName}
          {costDots ? ` ${costDots}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <Ionicons name="hardware-chip-outline" size={14} color={theme.primary} />
      <Text style={[styles.label, { color: theme.textSecondary }]}>{labelText}:</Text>
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
        {displayName}
      </Text>
      {costDots ? (
        <Text style={[styles.dots, { color: theme.textTertiary }]}>{costDots}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderLeftWidth: 2,
    borderRadius: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  compactText: {
    fontSize: 11,
    maxWidth: 120,
  },
  dots: {
    fontSize: 10,
  },
});
