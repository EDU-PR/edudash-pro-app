/**
 * Voice Call Header Component
 * 
 * Header with minimize button and title.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceCallHeaderProps {
  onMinimize: () => void;
}

export function VoiceCallHeader({ onMinimize }: VoiceCallHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onMinimize} style={styles.minimizeButton}>
        <Ionicons name="chevron-down" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Voice Call</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  minimizeButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default VoiceCallHeader;
