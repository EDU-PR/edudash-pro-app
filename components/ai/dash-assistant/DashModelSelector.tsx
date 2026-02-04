/**
 * DashModelSelector Component
 * 
 * AI model selection interface for Dash AI Assistant.
 * Extracted from DashAssistant for WARP.md compliance.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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

const MODEL_SELECTOR_KEY = '@dash_ai_model_selector_collapsed';

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
  const defaultCollapsed = useMemo(() => Dimensions.get('window').width < 380, []);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    let mounted = true;
    const loadPref = async () => {
      try {
        const stored = await AsyncStorage.getItem(MODEL_SELECTOR_KEY);
        if (!mounted) return;
        if (stored === null) {
          setCollapsed(defaultCollapsed);
        } else {
          setCollapsed(stored === 'true');
        }
      } catch {
        if (mounted) setCollapsed(defaultCollapsed);
      }
    };
    loadPref();
    return () => {
      mounted = false;
    };
  }, [defaultCollapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem(MODEL_SELECTOR_KEY, next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  return (
    <View style={[styles.modelSelector, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={[styles.modelSelectorHeader, { marginBottom: collapsed ? 0 : 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.modelSelectorTitle, { color: theme.text }]}>Model</Text>
          {selectedModelInfo && (
            <Text style={[styles.modelSelectorHint, { color: theme.textSecondary }]}>
              {selectedModelInfo.displayName} • {estimatedRemaining === null ? 'Unlimited' : `~${estimatedRemaining} chats left`}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={toggleCollapsed}
          accessibilityLabel={collapsed ? 'Expand model selector' : 'Collapse model selector'}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surfaceVariant,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>
            {collapsed ? 'Show' : 'Hide'}
          </Text>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color={theme.text} />
        </TouchableOpacity>
      </View>
      {!collapsed && (
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
      )}
    </View>
  );
};
