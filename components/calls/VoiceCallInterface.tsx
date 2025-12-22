/**
 * Voice Call Interface (React Native) - Refactored
 * 
 * Audio-only call interface using Daily.co React Native SDK.
 * Provides controls for mute, speaker, and end call.
 * 
 * This is the main orchestration component that composes:
 * - useVoiceCallState: State management
 * - useVoiceCallAudio: InCallManager audio routing
 * - useVoiceCallDaily: Daily.co SDK integration
 * - useVoiceCallTimeout: Ring timeout handling
 * - VoiceCallControls: Control buttons
 * - VoiceCallInfo: Caller info display
 * - VoiceCallHeader: Header with minimize
 * - VoiceCallError: Error display
 * - VoiceCallMinimized: Minimized view
 */

import React, { useCallback } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import type { CallState } from './types';

// Hooks
import {
  useVoiceCallState,
  useVoiceCallAudio,
  useVoiceCallDaily,
  useVoiceCallTimeout,
  useCallBackgroundHandler,
} from './hooks';

// Components
import { VoiceCallControls } from './VoiceCallControls';
import { VoiceCallHeader } from './VoiceCallHeader';
import { VoiceCallInfo } from './VoiceCallInfo';
import { VoiceCallError } from './VoiceCallError';
import { VoiceCallMinimized } from './VoiceCallMinimized';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoiceCallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  userName?: string;
  isOwner?: boolean;
  calleeId?: string;
  callId?: string;
  meetingUrl?: string;
  onCallStateChange?: (state: CallState) => void;
}

export function VoiceCallInterface({
  isOpen,
  onClose,
  roomName,
  userName = 'User',
  isOwner = false,
  calleeId,
  callId,
  meetingUrl,
  onCallStateChange,
}: VoiceCallInterfaceProps) {
  // State management
  const state = useVoiceCallState({
    isOpen,
    callId,
    onCallStateChange,
  });

  // Audio routing (InCallManager)
  const audio = useVoiceCallAudio({
    callState: state.callState,
    isOwner,
    isSpeakerEnabled: state.isSpeakerEnabled,
    setIsSpeakerEnabled: state.setIsSpeakerEnabled,
  });

  // Daily.co SDK
  const daily = useVoiceCallDaily({
    isOpen,
    meetingUrl,
    userName,
    isOwner,
    calleeId,
    isSpeakerEnabled: state.isSpeakerEnabled,
    dailyRef: state.dailyRef,
    callIdRef: state.callIdRef,
    setCallState: state.setCallState,
    setError: state.setError,
    setParticipantCount: state.setParticipantCount,
    setIsAudioEnabled: state.setIsAudioEnabled,
    setIsSpeakerEnabled: state.setIsSpeakerEnabled,
    setCallDuration: state.setCallDuration,
    stopAudio: audio.stopAudio,
    onClose,
  });

  // Ring timeout
  useVoiceCallTimeout({
    callState: state.callState,
    isOwner,
    callIdRef: state.callIdRef,
    setError: state.setError,
    setCallState: state.setCallState,
    cleanupCall: daily.cleanupCall,
    onClose,
  });

  // Background handling (KeepAwake + app state management)
  useCallBackgroundHandler({
    callState: state.callState,
    isCallActive: isOpen,
    callId: state.callIdRef.current,
    onReturnFromBackground: () => {
      console.log('[VoiceCallInterface] Returned from background');
    },
  });

  // Handlers
  const handleMinimize = useCallback(() => {
    state.setIsMinimized(true);
  }, [state]);

  const handleMaximize = useCallback(() => {
    state.setIsMinimized(false);
  }, [state]);

  const handleRetry = useCallback(() => {
    state.resetState();
    onClose();
  }, [state, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  // Minimized view
  if (state.isMinimized) {
    return (
      <VoiceCallMinimized
        callDuration={state.callDuration}
        formatDuration={state.formatDuration}
        onMaximize={handleMaximize}
        onEndCall={daily.endCall}
      />
    );
  }

  // Full view
  return (
    <Animated.View style={[styles.container, { opacity: state.fadeAnim }]}>
      <BlurView intensity={90} style={styles.blurView} tint="dark">
        <View style={styles.content}>
          {/* Header */}
          <VoiceCallHeader onMinimize={handleMinimize} />

          {/* Call Info */}
          <VoiceCallInfo
            userName={userName}
            callState={state.callState}
            callDuration={state.callDuration}
            formatDuration={state.formatDuration}
            pulseAnim={state.pulseAnim}
          />

          {/* Error Message */}
          <VoiceCallError error={state.error} />

          {/* Controls */}
          <VoiceCallControls
            callState={state.callState}
            isAudioEnabled={state.isAudioEnabled}
            isSpeakerEnabled={state.isSpeakerEnabled}
            participantCount={state.participantCount}
            onToggleAudio={daily.toggleAudio}
            onToggleSpeaker={audio.toggleSpeaker}
            onEndCall={daily.endCall}
            onRetry={handleRetry}
          />
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
  },
  blurView: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
  },
});

export default VoiceCallInterface;
