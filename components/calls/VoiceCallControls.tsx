/**
 * Voice Call Controls Component
 * 
 * Reusable control buttons for voice calls:
 * - Mute/Unmute microphone
 * - Speaker/Earpiece toggle  
 * - End call / Retry
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CallState } from './types';

interface VoiceCallControlsProps {
  callState: CallState;
  isAudioEnabled: boolean;
  isSpeakerEnabled: boolean;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onRetry: () => void;
}

export function VoiceCallControls({
  callState,
  isAudioEnabled,
  isSpeakerEnabled,
  participantCount,
  onToggleAudio,
  onToggleSpeaker,
  onEndCall,
  onRetry,
}: VoiceCallControlsProps) {
  const showRetryButton = callState === 'failed' || (callState === 'ended' && participantCount === 0);

  return (
    <View style={styles.controls}>
      {/* Mute */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          !isAudioEnabled && styles.controlButtonActive,
        ]}
        onPress={onToggleAudio}
      >
        <Ionicons
          name={isAudioEnabled ? 'mic' : 'mic-off'}
          size={28}
          color="#ffffff"
        />
        <Text style={styles.controlLabel}>
          {isAudioEnabled ? 'Mute' : 'Unmute'}
        </Text>
      </TouchableOpacity>

      {/* Speaker */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          isSpeakerEnabled && styles.controlButtonActive,
        ]}
        onPress={onToggleSpeaker}
      >
        <Ionicons
          name={isSpeakerEnabled ? 'volume-high' : 'ear'}
          size={28}
          color="#ffffff"
        />
        <Text style={styles.controlLabel}>
          {isSpeakerEnabled ? 'Speaker' : 'Earpiece'}
        </Text>
      </TouchableOpacity>

      {/* End Call or Call Again */}
      {showRetryButton ? (
        <TouchableOpacity
          style={[styles.controlButton, styles.retryCallButton]}
          onPress={onRetry}
        >
          <Ionicons name="call" size={28} color="#ffffff" />
          <Text style={styles.controlLabel}>Call Again</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={onEndCall}
        >
          <Ionicons name="call" size={28} color="#ffffff" />
          <Text style={styles.controlLabel}>End</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.3)',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
  },
  retryCallButton: {
    backgroundColor: '#10b981',
  },
  controlLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
});

export default VoiceCallControls;
