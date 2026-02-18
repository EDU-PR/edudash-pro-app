/**
 * Reusable model selector chip row for AI screens.
 * Shows display name + cost dots; supports optional persist callback per feature.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';

const COST_DOTS = (cost: number): string =>
  cost <= 1 ? '●' : cost <= 5 ? '●●' : '●●●';

export interface ModelSelectorChipsProps {
  availableModels: AIModelInfo[];
  selectedModel: AIModelId | string;
  onSelect: (modelId: AIModelId | string) => void;
  /** When provided, persist preference when user selects a model (e.g. setPreferredModel(id, feature)) */
  feature?: string;
  onPersist?: (modelId: AIModelId | string, feature: string) => void | Promise<void>;
  /** Section title above chips (e.g. "AI Model"). Omit or empty for chip row only. */
  title?: string;
  /** Only show when tier is not free or when availableModels.length > 1 */
  showWhenFree?: boolean;
  /** When false, do not render the section header (icon + title). Default true. */
  showSectionTitle?: boolean;
  /** Collapse model options behind a compact selected-model row. */
  collapsible?: boolean;
  /** Initial collapsed state when `collapsible` is enabled. */
  defaultCollapsed?: boolean;
  /** Auto-collapse options after selecting a model. */
  autoCollapseOnSelect?: boolean;
}

export function ModelSelectorChips({
  availableModels,
  selectedModel,
  onSelect,
  feature,
  onPersist,
  title = 'AI Model',
  showWhenFree = true,
  showSectionTitle = true,
  collapsible = false,
  defaultCollapsed = false,
  autoCollapseOnSelect = false,
}: ModelSelectorChipsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const titleText = title ?? t('common.ai_model_label');
  const [collapsed, setCollapsed] = React.useState(collapsible ? defaultCollapsed : false);

  React.useEffect(() => {
    if (!collapsible) {
      setCollapsed(false);
      return;
    }
    setCollapsed(defaultCollapsed);
  }, [collapsible, defaultCollapsed]);

  if (availableModels.length === 0) return null;
  if (!showWhenFree && availableModels.length <= 1) return null;

  const selectedInfo =
    availableModels.find((model) => model.id === selectedModel) || availableModels[0];

  const handlePress = async (modelId: AIModelId | string) => {
    onSelect(modelId);
    if (feature && onPersist) {
      try {
        await onPersist(modelId, feature);
      } catch {
        // Silent
      }
    }
    if (collapsible && autoCollapseOnSelect) {
      setCollapsed(true);
    }
  };

  return (
    <View style={[styles.wrap, showSectionTitle ? {} : { paddingTop: 0 }, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      {showSectionTitle && (
        <View style={styles.sectionHeader}>
          <Ionicons name="hardware-chip-outline" size={16} color={theme.accent} />
          {titleText ? <Text style={[styles.sectionTitle, { color: theme.text }]}>{titleText}</Text> : null}
        </View>
      )}
      {collapsible && selectedInfo ? (
        <TouchableOpacity
          style={[styles.summaryRow, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
          onPress={() => setCollapsed((prev) => !prev)}
          accessibilityLabel={collapsed ? 'Expand model selector' : 'Collapse model selector'}
        >
          <View style={styles.summaryLeft}>
            <View style={[styles.summaryDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.summaryTitle, { color: theme.text }]} numberOfLines={1}>
              {selectedInfo.displayName || selectedInfo.name}
            </Text>
            <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
              {COST_DOTS(selectedInfo.relativeCost)}
            </Text>
          </View>
          <View style={[styles.summaryBadge, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.summaryBadgeText, { color: theme.textSecondary }]}>
              {collapsed ? 'Change' : 'Close'}
            </Text>
            <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color={theme.textSecondary} />
          </View>
        </TouchableOpacity>
      ) : null}
      {(!collapsible || !collapsed) && (
        <View style={styles.chipRow}>
          {availableModels.map((m) => {
            const active = selectedModel === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => handlePress(m.id)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { backgroundColor: 'transparent', borderColor: theme.border },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: active ? '#FFF' : theme.text }]}
                  numberOfLines={1}
                >
                  {m.displayName || m.name}
                </Text>
                <Text
                  style={[
                    styles.chipMeta,
                    { color: active ? 'rgba(255,255,255,0.7)' : theme.textTertiary },
                  ]}
                >
                  {COST_DOTS(m.relativeCost)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  summaryMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipMeta: {
    fontSize: 10,
  },
});
