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
 * Uses expo-av Audio.Recording API
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
  Dimensions,
  Pressable,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CYAN_PRIMARY,
  PURPLE_PRIMARY,
  WAVEFORM_PLAYED,
  WAVEFORM_UNPLAYED,
  ERROR_RED,
  GRADIENT_PURPLE_INDIGO,
} from './theme';

const MIN_RECORDING_DURATION = 500;
const WAVEFORM_BAR_COUNT = 35;
const CANCEL_THRESHOLD = 80; // Slide up 80px to cancel
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void; // Callback to notify parent
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
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
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
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
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

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
          const permission = await Audio.requestPermissionsAsync();
          if (permission.status === 'granted') {
            hasPermissionsRef.current = true;
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
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

  const startRecording = async () => {
    if (isRecordingRef.current || recordingRef.current || disabled) return;
    
    isRecordingRef.current = true;
    
    try {
      // Check permissions
      if (!hasPermissionsRef.current) {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        isRecordingRef.current = false;
        return;
        }
        hasPermissionsRef.current = true;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // Start recording immediately
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
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
        },
        50
      );
      
      recordingRef.current = recording;
      recordingStartTime.current = Date.now();
      waveformDataRef.current = [];
      setIsRecording(true);
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
      
      Vibration.vibrate(50);
      
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);
      
    } catch (error) {
      if (__DEV__) {
        console.error('[VoiceRecorder] Start error:', error);
      }
      isRecordingRef.current = false;
      recordingRef.current = null;
      setIsRecording(false);
      // Reset state on error
      resetState();
    }
  };

  const stopRecording = async (shouldSend: boolean = true) => {
    if (!isRecordingRef.current || !recordingRef.current) return;
    
    isRecordingRef.current = false;
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    const duration = Date.now() - recordingStartTime.current;
    
    try {
      const recording = recordingRef.current;
      recordingRef.current = null;
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      
      if (!uri || duration < MIN_RECORDING_DURATION) {
        Vibration.vibrate(30);
        onRecordingCancel?.();
        resetState();
      } else if (!shouldSend) {
        // Cancelled - discard recording
        Vibration.vibrate([0, 50, 100]);
        onRecordingCancel?.();
        resetState();
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
      recordingRef.current = null;
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

  // Preview handlers
  const handlePreviewPlayPause = async () => {
    if (!previewUri) return;
    
    try {
      if (isPlayingPreview && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlayingPreview(false);
      } else {
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: previewUri },
            { shouldPlay: true },
            (status) => {
              if (status.isLoaded) {
                if (status.durationMillis && status.positionMillis !== undefined) {
                  setPreviewProgress(status.positionMillis / status.durationMillis);
                }
                if (status.didJustFinish) {
                  setIsPlayingPreview(false);
                  setPreviewProgress(0);
                }
              }
            }
          );
          soundRef.current = sound;
        } else {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && status.positionMillis >= (status.durationMillis || 0) - 100) {
            await soundRef.current.setPositionAsync(0);
            setPreviewProgress(0);
          }
          await soundRef.current.playAsync();
        }
        setIsPlayingPreview(true);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[VoiceRecorder] Playback error:', error);
      }
      // Reset playback state on error
      setIsPlayingPreview(false);
      setPreviewProgress(0);
    }
  };

  const handleSendPreview = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    
    if (previewUri) {
      onRecordingComplete(previewUri, previewDuration);
    }
    resetState();
  };

  const handleDiscardPreview = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
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
          
          // Stop recording and send or cancel based on position
          const shouldSend = !inCancelZone;
          stopRecording(shouldSend);
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

  // If recording, show enhanced recording modal UI with slide-to-cancel
  if (isRecording) {
    return (
      <View style={styles.recordingModalOverlay}>
        <Animated.View 
          style={[
            styles.recordingModal,
            inCancelZone && styles.recordingModalCancel,
            { transform: [{ translateY: slideY }] }
          ]}
          {...panResponder.panHandlers}
        >
          {/* Header */}
          <View style={styles.recordingModalHeader}>
            <Animated.View style={[styles.recordingIndicatorLarge, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.recordingDotLarge} />
            </Animated.View>
            <Text style={styles.recordingModalTitle}>
              {inCancelZone ? 'Release to Cancel' : 'Recording'}
            </Text>
          </View>
          
          {/* Waveform */}
          <View style={styles.waveformContainerLarge}>
            {waveformAnims.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBarLarge,
                  {
                    height: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 60],
                    }),
                    backgroundColor: inCancelZone ? ERROR_RED : PURPLE_PRIMARY,
                  },
                ]}
              />
            ))}
          </View>
          
          {/* Duration */}
          <Text style={styles.durationTextLarge}>{formatDuration(recordingDuration)}</Text>
          
          {/* Hint */}
          <Text style={[styles.hintText, inCancelZone && styles.hintTextCancel]}>
            {inCancelZone ? '👆 Release to cancel recording' : '⬆️ Slide up to cancel'}
          </Text>
        </Animated.View>
      </View>
    );
  }

  // If preview, show inline preview UI
  if (showPreview) {
    return (
      <View style={styles.inlinePreviewContainer}>
        <TouchableOpacity 
          onPress={handlePreviewPlayPause}
          style={styles.playButton}
          activeOpacity={0.8}
        >
          <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.playButtonInner}>
            <Ionicons 
              name={isPlayingPreview ? 'pause' : 'play'} 
              size={16} 
              color="#fff" 
            />
                </LinearGradient>
              </TouchableOpacity>
        
        <View style={styles.previewWaveformContainer}>
                {previewWaveformBars.map((height, index) => (
            <View 
              key={index} 
              style={[
                styles.previewBar, 
                { 
                  height: height * 24, 
                  backgroundColor: index < playedBars ? WAVEFORM_PLAYED : WAVEFORM_UNPLAYED,
                },
              ]} 
            />
                ))}
              </View>
        
              <Text style={styles.previewDuration}>{formatDuration(previewDuration)}</Text>
        
        <TouchableOpacity 
          onPress={handleDiscardPreview}
          style={styles.discardButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={ERROR_RED} />
              </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleSendPreview}
          style={styles.sendButton}
          activeOpacity={0.8}
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

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(139, 92, 246, 0.15)', // Purple tint when recording
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)', // Purple border
    gap: 8,
  },
  cancelZoneActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // Red tint when in cancel zone
    borderColor: 'rgba(239, 68, 68, 0.5)',
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
  // Enhanced recording modal styles
  recordingModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
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
  // Inline preview UI
  inlinePreviewContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 8,
  },
  playButton: {
    width: 28,
    height: 28,
  },
  playButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWaveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    gap: 2.5,
    paddingHorizontal: 4,
  },
  previewBar: {
    width: 2.5,
    borderRadius: 1.25,
    minHeight: 3,
  },
  previewDuration: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 40,
    textAlign: 'center',
  },
  discardButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 32,
    height: 32,
  },
  sendButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceRecorder;
