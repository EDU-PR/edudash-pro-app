/**
 * Voice Call Minimized View Component
 * 
 * Compact floating bar shown when call is minimized.
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceCallMinimizedProps {
  callDuration: number;
  formatDuration: (seconds: number) => string;
  onMaximize: () => void;
  onEndCall: () => void;
}

export function VoiceCallMinimized({
  callDuration,
  formatDuration,
  onMaximize,
  onEndCall,
}: VoiceCallMinimizedProps) {
  return (
    <TouchableOpacity
      style={styles.minimizedContainer}
      onPress={onMaximize}
      activeOpacity={0.9}
    >
      <View style={styles.minimizedContent}>
        <Ionicons name="call" size={20} color="#ffffff" />
        <Text style={styles.minimizedText}>{formatDuration(callDuration)}</Text>
        <TouchableOpacity onPress={onEndCall}>
          <Ionicons name="close-circle" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  minimizedContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 9998,
    borderRadius: 12,
    overflow: 'hidden',
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  minimizedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
});

export default VoiceCallMinimized;
