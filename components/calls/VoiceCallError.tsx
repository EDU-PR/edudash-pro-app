/**
 * Voice Call Error Display Component
 * 
 * Shows error messages in a styled container.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceCallErrorProps {
  error: string | null;
}

export function VoiceCallError({ error }: VoiceCallErrorProps) {
  if (!error) return null;

  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={20} color="#ef4444" />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
});

export default VoiceCallError;
