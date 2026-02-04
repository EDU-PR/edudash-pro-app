/**
 * DashModelSelector Component
 * 
 * AI model selection interface for Dash AI Assistant.
 * Extracted from DashAssistant for WARP.md compliance.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AIModelInfo } from '@/lib/ai/models';

type Theme = ReturnType<typeof useTheme>['theme'];

interface DashModelSelectorProps {
  models: AIModelInfo[];
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  estimatedRemaining: number | null;
  styles: any;
  theme: Theme;
}

export const DashModelSelector: React.FC<DashModelSelectorProps> = ({
  models,
  selectedModel,
  setSelectedModel,
  estimatedRemaining,
  styles,
  theme,
}) => {
  if (models.length === 0) return null;

  const selectedModelInfo = models.find(model => model.id === selectedModel) || models[0];

  return (
    <View style={[styles.modelSelector, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={styles.modelSelectorHeader}>
        <Text style={[styles.modelSelectorTitle, { color: theme.text }]}>Model</Text>
        {selectedModelInfo && (
          <Text style={[styles.modelSelectorHint, { color: theme.textSecondary }]}>
            {selectedModelInfo.displayName} • {estimatedRemaining === null ? 'Unlimited' : `~${estimatedRemaining} chats left`}
          </Text>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelSelectorRow}>
        {models.map((model) => {
          const isActive = model.id === selectedModel;
          return (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelChip,
                { borderColor: theme.border, backgroundColor: theme.surfaceVariant },
                isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '22' },
              ]}
              onPress={() => setSelectedModel(model.id)}
            >
              <Text style={[styles.modelChipTitle, { color: isActive ? theme.primary : theme.text }]}>
                {model.displayName}
              </Text>
              <Text style={[styles.modelChipSub, { color: theme.textSecondary }]}>
                {model.relativeCost}x usage
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};
