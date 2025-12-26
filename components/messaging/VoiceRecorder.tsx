/**
 * VoiceRecorder Component - ChatGPT-style inline recording
 * 
 * Features:
 * - Inline recording in input area (no modal)
 * - Tap to start/stop recording
 * - Real-time waveform visualization
 * - Preview with play/stop/send buttons
 * - Compact, ChatGPT-inspired design
 * 
 * Uses expo-audio for modern audio API with background support
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  Vibration,
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CYAN_PRIMARY,
  PURPLE_PRIMARY,
  WAVEFORM_PLAYED,
  WAVEFORM_UNPLAYED,
  ERROR_RED,
  GRADIENT_PURPLE_INDIGO,
} from './theme';

// Try to import expo-audio - it may not be available in all builds
let useAudioPlayer: any;
let useAudioPlayerStatus: any;
let useAudioRecorder: any;
let useAudioRecorderState: any;
let RecordingPresets: any;
let setAudioModeAsync: any;
let requestRecordingPermissionsAsync: any;
let getRecordingPermissionsAsync: any;
let audioAvailable = false;

try {
  const expoAudio = require('expo-audio');
  useAudioPlayer = expoAudio.useAudioPlayer;
  useAudioPlayerStatus = expoAudio.useAudioPlayerStatus;
  useAudioRecorder = expoAudio.useAudioRecorder;
  useAudioRecorderState = expoAudio.useAudioRecorderState;
  RecordingPresets = expoAudio.RecordingPresets;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
  requestRecordingPermissionsAsync = expoAudio.requestRecordingPermissionsAsync;
  getRecordingPermissionsAsync = expoAudio.getRecordingPermissionsAsync;
  audioAvailable = true;
} catch (e) {
  console.warn('[VoiceRecorder] expo-audio not available:', e);
}

const MIN_RECORDING_DURATION = 500;
const WAVEFORM_BAR_COUNT = 35;
const CANCEL_THRESHOLD = 80; // Slide up 80px to cancel

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void; // Callback to notify parent
}

// Fallback component when expo-audio is not available
const VoiceRecorderFallback: React.FC = () => (
  <View style={styles.container}>
    <View style={[styles.micButton, { backgroundColor: '#6B7280' }]}>
      <Ionicons name="mic-off" size={20} color="#9CA3AF" />
    </View>
  </View>
);

// Main component that requires expo-audio
const VoiceRecorderImpl: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  disabled = false,
  onRecordingStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [inCancelZone, setInCancelZone] = useState(false);
  
  // expo-audio hooks
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100); // Poll every 100ms
  
  // Preview player - only created when we have a URI
  const previewPlayer = useAudioPlayer(previewUri || undefined);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  
  // Refs
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const waveformDataRef = useRef<number[]>([]);
  const hasPermissionsRef = useRef(false);
  const initialTouchY = useRef<number>(0);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  
  // Waveform bar animations
  const waveformAnims = useMemo(
    () => new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.2)),
    []
  );
  
  // Sync refs
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  
  // Notify parent of recording state
  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      // expo-audio hooks handle cleanup automatically
    };
  }, []);

  // Sync preview playback state with player status
  useEffect(() => {
    if (previewStatus && previewUri) {
      setIsPlayingPreview(previewStatus.playing);
      if (previewStatus.duration && previewStatus.currentTime !== undefined) {
        setPreviewProgress(previewStatus.currentTime / previewStatus.duration);
      }
      if (previewStatus.didJustFinish) {
        setPreviewProgress(0);
        previewPlayer.seekTo(0);
      }
    }
  }, [previewStatus, previewUri, previewPlayer]);

  // Pulse animation for active recording
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (pulse) pulse.stop();
    };
  }, [isRecording, pulseAnim]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Request permissions early
  useEffect(() => {
    const requestPermissions = async () => {
      if (!hasPermissionsRef.current) {
        try {
          const { granted } = await getRecordingPermissionsAsync();
          if (granted) {
            hasPermissionsRef.current = true;
            await setAudioModeAsync({
              allowsRecording: true,
              playsInSilentMode: true,
            });
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('[VoiceRecorder] Permission check failed:', error);
          }
        }
      }
    };
    requestPermissions();
  }, []);

  // Update duration from recorder state
  useEffect(() => {
    if (recorderState?.isRecording) {
      setRecordingDuration(recorderState.durationMillis || 0);
      
      // Generate waveform data from metering if available
      if (recorderState.metering !== undefined) {
        const normalized = Math.max(0, Math.min(1, (recorderState.metering + 60) / 60));
        const value = 0.2 + normalized * 0.6;
        
        waveformDataRef.current.push(value);
        
        setWaveformData(prev => {
          const newData = [...prev.slice(1), value];
          newData.forEach((val, idx) => {
            waveformAnims[idx].setValue(val);
          });
          return newData;
        });
      }
    }
  }, [recorderState, waveformAnims]);

  const startRecording = async () => {
    if (isRecordingRef.current || disabled) return;
    
    isRecordingRef.current = true;
    
    try {
      // Check permissions
      if (!hasPermissionsRef.current) {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          isRecordingRef.current = false;
          return;
        }
        hasPermissionsRef.current = true;
      }
      
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      
      // Start recording using expo-audio
      await recorder.prepareToRecordAsync();
      recorder.record();
      
      recordingStartTime.current = Date.now();
      waveformDataRef.current = [];
      setIsRecording(true);
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
      
      Vibration.vibrate(50);
      
    } catch (error) {
      if (__DEV__) {
        console.error('[VoiceRecorder] Start error:', error);
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      // Reset state on error
      resetState();
    }
  };

  const stopRecording = async (shouldSend: boolean = true, showPreviewMode: boolean = false) => {
    if (!isRecordingRef.current) return;
    
    isRecordingRef.current = false;
    
    const duration = recorderState?.durationMillis || (Date.now() - recordingStartTime.current);
    
    try {
      await recorder.stop();
      const uri = recorder.uri;
      
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      
      if (!uri || duration < MIN_RECORDING_DURATION) {
        Vibration.vibrate(30);
        onRecordingCancel?.();
        resetState();
      } else if (!shouldSend) {
        // Cancelled - discard recording
        Vibration.vibrate([0, 50, 100]);
        onRecordingCancel?.();
        resetState();
      } else if (showPreviewMode) {
        // Show preview instead of sending immediately
        Vibration.vibrate([0, 30, 50]);
        setPreviewUri(uri);
        setPreviewDuration(duration);
        setShowPreview(true);
        setIsRecording(false);
      } else {
        // Send immediately
        Vibration.vibrate([0, 30, 50, 30]);
        onRecordingComplete(uri, duration);
        resetState();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[VoiceRecorder] Stop error:', error);
      }
      resetState();
      // Notify cancellation on error
      onRecordingCancel?.();
    }
  };

  const resetState = () => {
    setIsRecording(false);
    setRecordingDuration(0);
    setShowPreview(false);
    setPreviewUri(null);
    setPreviewDuration(0);
    setPreviewProgress(0);
    setIsPlayingPreview(false);
    setInCancelZone(false);
    slideY.setValue(0);
    waveformAnims.forEach(anim => anim.setValue(0.2));
  };

  // Preview handlers - using expo-audio player hook
  const handlePreviewPlayPause = async () => {
    if (!previewUri || !previewPlayer) return;
    
    try {
      if (isPlayingPreview) {
        previewPlayer.pause();
      } else {
        // Reset if at the end
        if (previewStatus?.didJustFinish || previewProgress >= 0.99) {
          await previewPlayer.seekTo(0);
        }
        previewPlayer.play();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[VoiceRecorder] Playback error:', error);
      }
      setIsPlayingPreview(false);
      setPreviewProgress(0);
    }
  };

  const handleSendPreview = () => {
    // Stop playback if playing
    if (previewPlayer && isPlayingPreview) {
      previewPlayer.pause();
    }
    
    if (previewUri) {
      onRecordingComplete(previewUri, previewDuration);
    }
    resetState();
  };

  const handleDiscardPreview = () => {
    // Stop playback if playing
    if (previewPlayer && isPlayingPreview) {
      previewPlayer.pause();
    }
    onRecordingCancel?.();
    resetState();
  };

  // Preview waveform
  const previewWaveformBars = useMemo(() => {
    if (waveformDataRef.current.length > 0) {
      const step = Math.max(1, Math.floor(waveformDataRef.current.length / 25));
      return waveformDataRef.current.filter((_, i) => i % step === 0).slice(0, 25);
    }
    return new Array(25).fill(0).map(() => 0.3 + Math.random() * 0.4);
  }, [showPreview]);

  const playedBars = Math.floor(previewWaveformBars.length * previewProgress);

  // PanResponder for slide-to-cancel gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !showPreview,
        onMoveShouldSetPanResponder: () => isRecording,
        
        onPanResponderGrant: (_, gestureState) => {
          if (disabled || isRecording || showPreview) return;
          
          // Start recording immediately on press
          initialTouchY.current = gestureState.y0;
          Vibration.vibrate(30);
          startRecording();
        },
        
        onPanResponderMove: (_, gestureState) => {
          if (!isRecording) return;
          
          const deltaY = gestureState.dy;
          
          // Update slide animation
          if (deltaY < 0) {
            slideY.setValue(deltaY);
          }
          
          // Check if in cancel zone (slid up more than threshold)
          const nowInCancelZone = deltaY < -CANCEL_THRESHOLD;
          if (nowInCancelZone !== inCancelZone) {
            setInCancelZone(nowInCancelZone);
            if (nowInCancelZone) {
              Vibration.vibrate(40);
            }
          }
        },
        
        onPanResponderRelease: () => {
          if (!isRecording) return;
          
          // Stop recording: if in cancel zone, cancel; otherwise show preview
          const shouldSend = !inCancelZone;
          stopRecording(shouldSend, shouldSend); // Show preview if not cancelling
        },
        
        onPanResponderTerminate: () => {
          // Handle if gesture is interrupted
          if (isRecording) {
            stopRecording(false); // Cancel on interrupt
          }
        },
      }),
    [disabled, isRecording, showPreview, inCancelZone]
  );

  // If recording, show inline recording UI (no modal)
  if (isRecording) {
    return (
      <View style={[styles.inlineRecordingContainer, inCancelZone && styles.cancelZoneActive]}>
        {/* Recording indicator */}
        <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.recordingDot} />
        </Animated.View>
        
        {/* Waveform */}
        <View style={styles.waveformContainer}>
          {waveformAnims.slice(0, 20).map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, 24],
                  }),
                  backgroundColor: inCancelZone ? ERROR_RED : PURPLE_PRIMARY,
                },
              ]}
            />
          ))}
        </View>
        
        {/* Duration */}
        <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
        
        {/* Cancel button */}
        <TouchableOpacity
          onPress={() => stopRecording(false)}
          style={styles.inlineCancelButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={28} color={ERROR_RED} />
        </TouchableOpacity>
        
        {/* Stop/Send button */}
        <TouchableOpacity
          onPress={() => stopRecording(true, true)}
          style={styles.inlineStopButton}
          activeOpacity={0.7}
        >
          <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.inlineStopButtonInner}>
            <Ionicons name="stop" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // If preview, show inline preview UI (no modal)
  if (showPreview) {
    return (
      <View style={styles.inlinePreviewContainer}>
        {/* Play/Pause button */}
        <TouchableOpacity
          onPress={handlePreviewPlayPause}
          style={styles.playButton}
          activeOpacity={0.7}
        >
          <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.playButtonInner}>
            <Ionicons 
              name={isPlayingPreview ? 'pause' : 'play'} 
              size={18} 
              color="#fff" 
              style={isPlayingPreview ? undefined : { marginLeft: 2 }}
            />
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Waveform */}
        <View style={styles.previewWaveformContainer}>
          {previewWaveformBars.map((height, index) => (
            <View 
              key={index} 
              style={[
                styles.previewBar, 
                { 
                  height: Math.max(4, height * 24),
                  backgroundColor: index < playedBars ? WAVEFORM_PLAYED : WAVEFORM_UNPLAYED,
                },
              ]} 
            />
          ))}
        </View>
        
        {/* Duration */}
        <Text style={styles.previewDuration}>{formatDuration(previewDuration)}</Text>
        
        {/* Discard button */}
        <TouchableOpacity
          onPress={handleDiscardPreview}
          style={styles.discardButton}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={ERROR_RED} />
        </TouchableOpacity>
        
        {/* Send button */}
        <TouchableOpacity
          onPress={handleSendPreview}
          style={styles.sendButton}
          activeOpacity={0.7}
        >
          <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.sendButtonInner}>
            <Ionicons name="send" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // Default: show mic button with press-and-hold
  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.micButton}>
        <Ionicons name="mic" size={20} color="#fff" />
      </LinearGradient>
    </View>
  );
};

// Wrapper that checks for expo-audio availability
export const VoiceRecorder: React.FC<VoiceRecorderProps> = (props) => {
  if (!audioAvailable) {
    return <VoiceRecorderFallback />;
  }
  return <VoiceRecorderImpl {...props} />;
};

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    // Match the input wrapper offset
    bottom: -12,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  containerPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  // Inline recording UI (replaces input)
  inlineRecordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    gap: 10,
    // Match the input wrapper offset
    bottom: -12,
    marginLeft: -4,
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelZoneActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    shadowColor: ERROR_RED,
  },
  recordingIndicator: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ERROR_RED,
  },
  releaseHintText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelHintText: {
    fontSize: 11,
    color: ERROR_RED,
    fontWeight: '600',
    marginLeft: 4,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    gap: 2.5,
    paddingHorizontal: 4,
  },
  waveformBar: {
    width: 2.5,
    backgroundColor: PURPLE_PRIMARY,
    borderRadius: 1.25,
    minHeight: 3,
  },
  durationText: {
    fontSize: 13,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 42,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineCancelButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineStopButton: {
    width: 36,
    height: 36,
  },
  inlineStopButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Enhanced recording modal styles (kept for backwards compatibility)
  recordingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingModalOverlayContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  recordingModal: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
    borderWidth: 2,
    borderColor: PURPLE_PRIMARY,
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  recordingModalCancel: {
    borderColor: ERROR_RED,
    shadowColor: ERROR_RED,
  },
  recordingModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordingIndicatorLarge: {
    marginBottom: 16,
  },
  recordingDotLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ERROR_RED,
  },
  recordingModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  waveformContainerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 4,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  waveformBarLarge: {
    width: 4,
    borderRadius: 2,
    minHeight: 8,
  },
  durationTextLarge: {
    fontSize: 32,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  hintText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },
  hintTextCancel: {
    color: ERROR_RED,
    fontWeight: '600',
  },
  recordingModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 24,
    marginBottom: 16,
  },
  recordingCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingCancelButtonText: {
    fontSize: 12,
    color: ERROR_RED,
    fontWeight: '600',
  },
  recordingStopButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingStopButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ERROR_RED,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ERROR_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingStopButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  previewModal: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 320,
    maxWidth: 360,
    borderWidth: 2,
    borderColor: PURPLE_PRIMARY,
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  previewModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  previewWaveformContainerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 4,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  previewBarLarge: {
    width: 4,
    borderRadius: 2,
    minHeight: 8,
  },
  previewDurationLarge: {
    fontSize: 32,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  previewModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
  },
  previewActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  previewActionButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  previewPlayButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSendButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inline preview UI - matches input wrapper styling
  inlinePreviewContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    gap: 10,
    // Match the input wrapper offset
    bottom: -12,
    marginLeft: -4,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  playButton: {
    width: 36,
    height: 36,
  },
  playButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  previewWaveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    gap: 2.5,
    paddingHorizontal: 4,
  },
  previewBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  previewDuration: {
    fontSize: 13,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 44,
    textAlign: 'center',
    fontWeight: '500',
  },
  discardButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 18,
  },
  sendButton: {
    width: 40,
    height: 40,
  },
  sendButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default VoiceRecorder;
