/**
 * ModelSelectorCard - AI model selection with tier-based options
 * @module components/ai-lesson-generator/ModelSelectorCard
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ModelSelectorCardProps } from './types';
import type { AIModelInfo } from '@/lib/ai/models';

/**
 * Get tier badge color based on tier name
 */
function getTierColor(tier: string): string {
  switch (tier.toLowerCase()) {
    case 'pro':
      return '#8B5CF6';
    case 'premium':
      return '#F59E0B';
    case 'enterprise':
      return '#10B981';
    case 'basic':
      return '#3B82F6';
    default:
      return '#6B7280';
  }
}

/**
 * Get model icon based on provider
 */
function getModelIcon(provider?: string): keyof typeof Ionicons.glyphMap {
  switch (provider?.toLowerCase()) {
    case 'anthropic':
      return 'sparkles';
    case 'openai':
      return 'logo-react';
    case 'google':
      return 'logo-google';
    default:
      return 'hardware-chip-outline';
  }
}

/**
 * Model item component
 */
interface ModelItemProps {
  model: AIModelInfo;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  isLocked?: boolean;
}

function ModelItem({
  model,
  isSelected,
  onSelect,
  disabled = false,
  isLocked = false,
}: ModelItemProps) {
  const iconName = getModelIcon(model.provider);

  return (
    <TouchableOpacity
      style={[
        styles.modelItem,
        isSelected && styles.modelItemSelected,
        isLocked && styles.modelItemLocked,
        disabled && styles.modelItemDisabled,
      ]}
      onPress={onSelect}
      disabled={disabled || isLocked}
      activeOpacity={0.7}
    >
      <View style={styles.modelInfo}>
        <View style={styles.modelHeader}>
          <Ionicons
            name={iconName}
            size={18}
            color={isSelected ? '#6366F1' : '#6B7280'}
          />
          <Text
            style={[
              styles.modelName,
              isSelected && styles.modelNameSelected,
              isLocked && styles.modelNameLocked,
            ]}
            numberOfLines={1}
          >
            {model.displayName || model.id}
          </Text>
        </View>
        {model.description && (
          <Text style={styles.modelDescription} numberOfLines={2}>
            {model.description}
          </Text>
        )}
        {model.minTier && (
          <View
            style={[
              styles.tierBadge,
              { backgroundColor: getTierColor(model.minTier) + '20' },
            ]}
          >
            <Text
              style={[
                styles.tierBadgeText,
                { color: getTierColor(model.minTier) },
              ]}
            >
              {model.minTier}
            </Text>
          </View>
        )}
      </View>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
      )}
      {isLocked && (
        <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );
}

/**
 * Card component for selecting AI model
 */
export function ModelSelectorCard({
  selectedModel,
  availableModels,
  onSelectModel,
  isLoading = false,
  disabled = false,
  userTier = 'free',
}: ModelSelectorCardProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="hardware-chip-outline" size={20} color="#6366F1" />
          <Text style={styles.title}>AI Model</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.loadingText}>Loading models...</Text>
        </View>
      </View>
    );
  }

  if (availableModels.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="hardware-chip-outline" size={20} color="#6366F1" />
          <Text style={styles.title}>AI Model</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="warning-outline" size={32} color="#F59E0B" />
          <Text style={styles.emptyText}>No models available</Text>
          <Text style={styles.emptySubtext}>
            Please check your subscription or contact support.
          </Text>
        </View>
      </View>
    );
  }

  // Check which models are locked for current tier
  const isModelLocked = (model: AIModelInfo): boolean => {
    if (!model.minTier) return false;
    const tierOrder = ['free', 'basic', 'starter', 'pro', 'premium', 'enterprise'];
    const userTierIndex = tierOrder.indexOf(userTier.toLowerCase());
    const requiredTierIndex = tierOrder.indexOf(
      model.minTier.toLowerCase()
    );
    return userTierIndex < requiredTierIndex;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="hardware-chip-outline" size={20} color="#6366F1" />
        <Text style={styles.title}>AI Model</Text>
        {selectedModel && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>
              {selectedModel.displayName || selectedModel.id}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.modelsContainer}>
        {availableModels.map((model) => (
          <ModelItem
            key={model.id}
            model={model}
            isSelected={selectedModel?.id === model.id}
            onSelect={() => onSelectModel(model)}
            disabled={disabled}
            isLocked={isModelLocked(model)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
        <Text style={styles.footerText}>
          Model selection affects quality, speed, and quota usage
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  selectedBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366F1',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modelsContainer: {
    gap: 8,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
  },
  modelItemSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  modelItemLocked: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  modelItemDisabled: {
    opacity: 0.5,
  },
  modelInfo: {
    flex: 1,
    gap: 4,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  modelNameSelected: {
    color: '#6366F1',
  },
  modelNameLocked: {
    color: '#9CA3AF',
  },
  modelDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
});

export default ModelSelectorCard;
