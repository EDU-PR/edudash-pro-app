/**
 * ErrorRetrySection - Error display with retry functionality
 * @module components/ai-lesson-generator/ErrorRetrySection
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ErrorRetrySectionProps } from './types';

/**
 * Get error icon and color based on error type
 */
function getErrorStyle(error: string): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
} {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return {
      icon: 'time-outline',
      color: '#F59E0B',
      backgroundColor: '#FEF3C7',
    };
  }

  if (lowerError.includes('network') || lowerError.includes('connection')) {
    return {
      icon: 'wifi-outline',
      color: '#EF4444',
      backgroundColor: '#FEE2E2',
    };
  }

  if (lowerError.includes('quota') || lowerError.includes('limit')) {
    return {
      icon: 'speedometer-outline',
      color: '#8B5CF6',
      backgroundColor: '#EDE9FE',
    };
  }

  if (lowerError.includes('unauthorized') || lowerError.includes('permission')) {
    return {
      icon: 'lock-closed-outline',
      color: '#EF4444',
      backgroundColor: '#FEE2E2',
    };
  }

  // Default error style
  return {
    icon: 'alert-circle-outline',
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
  };
}

/**
 * Error display component with retry functionality
 */
export function ErrorRetrySection({
  error,
  onRetry,
  onDismiss,
  retryCount = 0,
  maxRetries = 3,
}: ErrorRetrySectionProps) {
  if (!error) {
    return null;
  }

  const { icon, color, backgroundColor } = getErrorStyle(error);
  const canRetry = retryCount < maxRetries;
  const retriesRemaining = maxRetries - retryCount;

  return (
    <View style={[styles.container, { borderColor: color }]}>
      {/* Error icon and header */}
      <View style={[styles.iconContainer, { backgroundColor }]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>

      {/* Error title and message */}
      <View style={styles.content}>
        <Text style={[styles.title, { color }]}>Generation Failed</Text>
        <Text style={styles.errorMessage}>{error}</Text>

        {/* Retry count info */}
        {retryCount > 0 && (
          <View style={styles.retryInfo}>
            <Ionicons
              name="refresh-circle-outline"
              size={14}
              color="#6B7280"
            />
            <Text style={styles.retryInfoText}>
              {retryCount} {retryCount === 1 ? 'retry' : 'retries'} attempted
              {canRetry && ` • ${retriesRemaining} remaining`}
            </Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {canRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: color }]}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}

        {onDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Helpful tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Troubleshooting tips:</Text>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.tipText}>Check your internet connection</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.tipText}>Try a shorter or simpler topic</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.tipText}>Wait a moment and try again</Text>
        </View>
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
    borderWidth: 1,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  content: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  retryInfoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tipsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
  },
});

export default ErrorRetrySection;
