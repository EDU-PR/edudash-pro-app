/**
 * Status display components for Add Member screen
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';
import { RetryStatus } from './types';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// ============================================================================
// Error Display Component
// ============================================================================

interface ErrorDisplayProps {
  errorMessage: string | null;
  onDismiss: () => void;
}

export function ErrorDisplay({ errorMessage, onDismiss }: ErrorDisplayProps) {
  if (!errorMessage) return null;

  return (
    <View style={[styles.errorContainer, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
      <View style={styles.errorContent}>
        <Ionicons name="alert-circle" size={20} color="#EF4444" />
        <View style={styles.errorTextContainer}>
          <Text style={[styles.errorTitle, { color: '#991B1B' }]}>Registration Error</Text>
          <Text style={[styles.errorMessage, { color: '#DC2626' }]}>{errorMessage}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={20} color="#991B1B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// Retry Status Display Component
// ============================================================================

interface RetryStatusDisplayProps {
  retryStatus: RetryStatus | null;
  showWhenNoError?: boolean;
  errorMessage?: string | null;
}

export function RetryStatusDisplay({ 
  retryStatus, 
  showWhenNoError = true,
  errorMessage 
}: RetryStatusDisplayProps) {
  if (!retryStatus) return null;
  if (!showWhenNoError && errorMessage) return null;

  return (
    <View style={[styles.retryContainer, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}>
      <EduDashSpinner size="small" color="#3B82F6" />
      <Text style={[styles.retryText, { color: '#1E40AF' }]}>
        {retryStatus.retry > 0 
          ? `Retrying... (Attempt ${retryStatus.retry + 1}/${retryStatus.maxRetries})`
          : `Creating account... (Attempt ${retryStatus.retry + 1}/${retryStatus.maxRetries})`
        }
      </Text>
    </View>
  );
}
