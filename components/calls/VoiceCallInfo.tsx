/**
 * Voice Call Info Component
 * 
 * Displays caller avatar, name, and call status.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CallState } from './types';

interface VoiceCallInfoProps {
  userName: string;
  callState: CallState;
  callDuration: number;
  formatDuration: (seconds: number) => string;
  pulseAnim: Animated.Value;
}

export function VoiceCallInfo({
  userName,
  callState,
  callDuration,
  formatDuration,
  pulseAnim,
}: VoiceCallInfoProps) {
  return (
    <View style={styles.callInfo}>
      <Animated.View style={[styles.avatar, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="person" size={48} color="#ffffff" />
      </Animated.View>
      <Text style={styles.callerName}>{userName}</Text>
      <View style={styles.statusContainer}>
        {(callState === 'connecting' || callState === 'ringing') && (
          <ActivityIndicator size="small" color="#10b981" style={{ marginRight: 8 }} />
        )}
        <Text style={[
          styles.callStatus,
          callState === 'failed' && styles.callStatusError,
          callState === 'connected' && styles.callStatusConnected,
        ]}>
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'ringing' && 'Ringing...'}
          {callState === 'connected' && formatDuration(callDuration)}
          {callState === 'failed' && 'Call Failed'}
          {callState === 'ended' && 'Call Ended'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#00f5ff',
  },
  callerName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  callStatusConnected: {
    color: '#10b981',
    fontWeight: '600',
  },
  callStatusError: {
    color: '#ef4444',
    fontWeight: '600',
  },
});

export default VoiceCallInfo;
