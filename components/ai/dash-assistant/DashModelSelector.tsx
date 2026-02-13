/**
 * DashModelSelector Component
 * 
 * AI model selection interface for Dash AI Assistant.
 * Extracted from DashAssistant for WARP.md compliance.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Animated, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
  const hasModels = models.length > 0;
  const selectedModelInfo = useMemo(() => {
    if (!hasModels) return null;
    return models.find(model => model.id === selectedModel) || models[0];
  }, [hasModels, models, selectedModel]);
  const defaultCollapsed = useMemo(() => Dimensions.get('window').width < 380, []);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [toastLabel, setToastLabel] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem(MODEL_SELECTOR_KEY, next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  const showSelectionToast = useCallback((label: string) => {
    setToastLabel(label);
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(520),
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setToastLabel('');
      }
    });
  }, [toastAnim]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  }, []);

  if (!hasModels || !selectedModelInfo) return null;

  return (
    <View style={[styles.modelSelector, { borderColor: theme.border, backgroundColor: theme.surface, position: 'relative' }]}>
      {toastLabel ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 12,
            top: 10,
            opacity: toastAnim,
            transform: [
              {
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-6, 0],
                }),
              },
            ],
            backgroundColor: theme.primary + '22',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: theme.primary,
            maxWidth: 180,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={12} color={theme.primary} />
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}
            >
              Selected {toastLabel}
            </Text>
          </View>
        </Animated.View>
      ) : null}
      <View style={[styles.modelSelectorHeader, { marginBottom: collapsed ? 0 : 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.modelSelectorTitle, { color: theme.text }]}>Model Engine</Text>
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
                onPress={() => {
                  setSelectedModel(model.id);
                  triggerHaptic();
                  showSelectionToast(model.displayName);
                  if (!collapsed) {
                    if (collapseTimerRef.current) {
                      clearTimeout(collapseTimerRef.current);
                    }
                    collapseTimerRef.current = setTimeout(() => {
                      setCollapsed(true);
                      AsyncStorage.setItem(MODEL_SELECTOR_KEY, 'true').catch(() => {});
                    }, 380);
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={isActive ? 'radio-button-on' : 'radio-button-off'}
                    size={12}
                    color={isActive ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.modelChipTitle, { color: isActive ? theme.primary : theme.text }]}>
                    {model.displayName}
                  </Text>
                </View>
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
