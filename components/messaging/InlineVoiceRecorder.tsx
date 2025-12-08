/**
 * InlineVoiceRecorder Component
 * Clean WhatsApp-style voice recording with simple, elegant UI
 * 
 * Features:
 * - Press and hold mic button to record
 * - Slide left to cancel
 * - Slide up to lock (hands-free recording)
 * - Preview before sending
 * 
 * Uses expo-audio ~0.4.9 with useAudioRecorder hook
 * 
 * Key Implementation Notes:
 * 1. prepareToRecordAsync() called ONCE on mount
 * 2. stop() returns { uri, durationMillis }
 * 3. isRecordingRef set IMMEDIATELY before async work
 * 4. All intervals cleared on unmount
 * 5. Android-specific encoding preset
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  PanResponder,
  Vibration,
  Platform,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANCEL_THRESHOLD = -100;
const LOCK_THRESHOLD = -60;
const MIN_RECORDING_DURATION = 500;

// Use HIGH_QUALITY preset with metering
const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

interface InlineVoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel: () => void;
  onRecordingStart: () => void;
  isRecording: boolean;
}

export const InlineVoiceRecorder: React.FC<InlineVoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  onRecordingStart,
  isRecording,
}) => {
  // Recording state
  const [isLocked, setIsLocked] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPrepared, setIsPrepared] = useState(false);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  
  // expo-audio recorder hook
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  
  // Audio player for preview (only used when previewUri is set)
  const audioPlayer = useAudioPlayer(previewUri || undefined);
  
  // Refs
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLockedRef = useRef(false);
  const isRecordingRef = useRef(false); // Our own tracking (set IMMEDIATELY)
  
  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const lockAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Sync lock ref
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  // Prepare recorder ONCE on mount
  useEffect(() => {
    let mounted = true;
    
    const prepare = async () => {
      try {
        // Request permissions
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          console.log('[VoiceRecorder] Permission denied');
          return;
        }
        
        if (!mounted) return;
        
        // Prepare recorder once
        await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
        
        if (mounted) {
          setIsPrepared(true);
          console.log('[VoiceRecorder] Recorder prepared on mount');
        }
      } catch (e) {
        console.log('[VoiceRecorder] Prepare error:', e);
      }
    };
    
    prepare();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, []);

  // Track player status for preview
  useEffect(() => {
    if (!audioPlayer || !showPreview) return;
    
    const checkStatus = setInterval(() => {
      if (audioPlayer.playing) {
        setPlaybackPosition(audioPlayer.currentTime * 1000);
      }
      if (audioPlayer.currentTime >= audioPlayer.duration && audioPlayer.duration > 0) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }, 100);
    
    return () => clearInterval(checkStatus);
  }, [audioPlayer, showPreview]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      const wave = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
      pulse.start();
      wave.start();
      return () => {
        pulse.stop();
        wave.stop();
      };
    }
  }, [isRecording, pulseAnim, waveAnim]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    // Guard: already recording
    if (isRecordingRef.current) {
      console.log('[VoiceRecorder] Already recording, ignoring');
      return;
    }
    
    // Mark as recording IMMEDIATELY (before async work)
    isRecordingRef.current = true;
    
    try {
      // Check permissions
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        console.warn('[VoiceRecorder] Permission denied');
        isRecordingRef.current = false;
        return;
      }
      
      // If not prepared yet, prepare now (fallback)
      if (!isPrepared) {
        console.log('[VoiceRecorder] Late prepare...');
        try {
          await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
          setIsPrepared(true);
        } catch (e) {
          console.log('[VoiceRecorder] Prepare failed:', e);
          isRecordingRef.current = false;
          return;
        }
      }
      
      // Start recording
      try {
        await audioRecorder.record();
        console.log('[VoiceRecorder] Recording started!');
      } catch (e) {
        console.log('[VoiceRecorder] record() failed:', e);
        isRecordingRef.current = false;
        return;
      }
      
      recordingStartTime.current = Date.now();
      setRecordingDuration(0);
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);
      
      Vibration.vibrate(30);
      onRecordingStart();
      
    } catch (error) {
      console.error('[VoiceRecorder] startRecording error:', error);
      isRecordingRef.current = false;
    }
  }, [isPrepared, audioRecorder, onRecordingStart]);

  const stopRecording = useCallback(async (cancelled: boolean = false, showPreviewModal: boolean = false) => {
    // Guard: not recording
    if (!isRecordingRef.current) {
      console.log('[VoiceRecorder] Stop called but not recording');
      return;
    }
    
    // Mark as not recording IMMEDIATELY
    isRecordingRef.current = false;
    
    // Clear timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    try {
      // Stop recording
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      console.log('[VoiceRecorder] Stopped, URI:', uri);
      
      if (!uri) {
        console.log('[VoiceRecorder] No URI returned');
        onRecordingCancel();
        return;
      }
      
      const duration = Date.now() - recordingStartTime.current;
      
      if (cancelled || duration < MIN_RECORDING_DURATION) {
        console.log('[VoiceRecorder] Cancelled or too short');
        Vibration.vibrate(30);
        onRecordingCancel();
      } else if (showPreviewModal) {
        console.log('[VoiceRecorder] Showing preview');
        setPreviewUri(uri);
        setPreviewDuration(duration);
        setShowPreview(true);
      } else {
        console.log('[VoiceRecorder] Sending directly');
        Vibration.vibrate([0, 30, 50, 30]);
        onRecordingComplete(uri, duration);
      }
      
    } catch (error) {
      console.error('[VoiceRecorder] stopRecording error:', error);
      onRecordingCancel();
    }
    
    // Reset UI state
    setIsLocked(false);
    slideAnim.setValue(0);
    lockAnim.setValue(0);
    
    // Re-prepare for next recording
    try {
      await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
      console.log('[VoiceRecorder] Re-prepared for next recording');
    } catch (e) {
      console.log('[VoiceRecorder] Re-prepare failed:', e);
      setIsPrepared(false);
    }
  }, [audioRecorder, onRecordingComplete, onRecordingCancel, slideAnim, lockAnim]);

  // Preview handlers
  const handlePreviewPlay = useCallback(async () => {
    if (!previewUri || !audioPlayer) return;
    
    try {
      if (isPlaying) {
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        if (playbackPosition >= previewDuration - 100) {
          audioPlayer.seekTo(0);
          setPlaybackPosition(0);
        }
        audioPlayer.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('[VoiceRecorder] Playback error:', error);
    }
  }, [previewUri, audioPlayer, isPlaying, playbackPosition, previewDuration]);

  const handlePreviewSend = useCallback(async () => {
    if (audioPlayer) {
      audioPlayer.pause();
    }
    setShowPreview(false);
    setIsPlaying(false);
    setPlaybackPosition(0);
    
    if (previewUri) {
      onRecordingComplete(previewUri, previewDuration);
    }
    setPreviewUri(null);
  }, [audioPlayer, previewUri, previewDuration, onRecordingComplete]);

  const handlePreviewDiscard = useCallback(async () => {
    if (audioPlayer) {
      audioPlayer.pause();
    }
    setShowPreview(false);
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPreviewUri(null);
    onRecordingCancel();
  }, [audioPlayer, onRecordingCancel]);

  // PanResponder for press-hold-slide gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        console.log('[VoiceRecorder] PanResponder granted');
        startRecording();
      },
      onPanResponderMove: (_, gestureState) => {
        if (isLockedRef.current) return;
        
        // Slide left to cancel
        if (gestureState.dx < 0) {
          const offset = Math.max(gestureState.dx, CANCEL_THRESHOLD * 1.5);
          slideAnim.setValue(offset);
        }
        
        // Slide up to lock
        if (gestureState.dy < 0) {
          const upOffset = Math.abs(Math.max(gestureState.dy, LOCK_THRESHOLD * 2));
          lockAnim.setValue(upOffset);
          
          if (gestureState.dy < LOCK_THRESHOLD && !isLockedRef.current) {
            setIsLocked(true);
            isLockedRef.current = true;
            Vibration.vibrate(50);
            console.log('[VoiceRecorder] Locked');
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        console.log('[VoiceRecorder] Released', { dx: gestureState.dx, locked: isLockedRef.current });
        if (isLockedRef.current) return;
        
        if (gestureState.dx < CANCEL_THRESHOLD) {
          stopRecording(true);
        } else {
          stopRecording(false, true); // Show preview
        }
      },
      onPanResponderTerminate: () => {
        console.log('[VoiceRecorder] Terminated');
        if (!isLockedRef.current) {
          stopRecording(true);
        }
      },
    })
  ).current;

  // Locked mode handlers
  const handleLockedSend = useCallback(() => stopRecording(false, false), [stopRecording]);
  const handleLockedCancel = useCallback(() => stopRecording(true), [stopRecording]);

  // Preview Modal
  const renderPreviewModal = () => (
    <Modal
      visible={showPreview}
      transparent
      animationType="fade"
      onRequestClose={handlePreviewDiscard}
    >
      <View style={styles.previewOverlay}>
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Voice Message</Text>
          <Text style={styles.previewDuration}>{formatDuration(previewDuration)}</Text>
          
          <TouchableOpacity style={styles.playButton} onPress={handlePreviewPlay}>
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={36} 
              color="#fff"
              style={isPlaying ? {} : { marginLeft: 4 }}
            />
          </TouchableOpacity>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${previewDuration > 0 ? (playbackPosition / previewDuration) * 100 : 0}%` }
                ]} 
              />
            </View>
          </View>
          
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.discardBtn} onPress={handlePreviewDiscard}>
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sendBtn} onPress={handlePreviewSend}>
              <Ionicons name="send" size={24} color="#fff" />
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Not recording - show mic button
  if (!isRecording) {
    return (
      <>
        <View {...panResponder.panHandlers} style={styles.micButton}>
          <LinearGradient colors={['#14b8a6', '#0d9488']} style={styles.micGradient}>
            <Ionicons name="mic" size={24} color="#fff" />
          </LinearGradient>
        </View>
        {renderPreviewModal()}
      </>
    );
  }

  // Recording UI
  return (
    <>
      <View style={styles.recordingContainer}>
        {isLocked ? (
          <View style={styles.lockedRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleLockedCancel}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
            
            <View style={styles.timerSection}>
              <View style={styles.recordingIndicator}>
                <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
              </View>
              <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
              <Animated.View style={[styles.waveform, { opacity: waveAnim }]} />
            </View>
            
            <TouchableOpacity style={styles.sendButton} onPress={handleLockedSend}>
              <LinearGradient colors={['#14b8a6', '#0d9488']} style={styles.sendGradient}>
                <Ionicons name="send" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View 
            style={[styles.slidingRow, { transform: [{ translateX: slideAnim }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.cancelSection}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
              <Text style={styles.cancelText}>Slide to cancel</Text>
              <Text style={styles.lockHintText}>(or lift up to lock)</Text>
            </View>
            
            <View style={styles.timerSection}>
              <Text style={styles.timerTextSmall}>{formatDuration(recordingDuration)}</Text>
              <Animated.View style={[styles.waveformSmall, { opacity: waveAnim }]} />
            </View>
            
            <Animated.View style={[
              styles.lockIndicator,
              { 
                opacity: lockAnim.interpolate({ inputRange: [0, 40], outputRange: [0.5, 0] }),
                transform: [{ translateY: lockAnim.interpolate({ inputRange: [0, 60], outputRange: [0, -15] }) }]
              }
            ]}>
              <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
            </Animated.View>
            
            <Animated.View style={[styles.activeMic, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={['#14b8a6', '#0d9488']} style={styles.micGradient}>
                <Ionicons name="mic" size={24} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        )}
      </View>
      {renderPreviewModal()}
    </>
  );
};

const styles = StyleSheet.create({
  micButton: {
    width: 48,
    height: 48,
  },
  micGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingContainer: {
    flex: 1,
    height: 48,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 4,
  },
  slidingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cancelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelText: {
    color: '#6b7280',
    fontSize: 13,
  },
  lockHintText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  recordingIndicator: {
    marginRight: 4,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  timerText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  timerTextSmall: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#6b7280',
  },
  waveform: {
    width: 60,
    height: 16,
    backgroundColor: '#d1d5db',
    borderRadius: 8,
  },
  waveformSmall: {
    width: 40,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  lockIndicator: {
    padding: 4,
  },
  activeMic: {
    width: 48,
    height: 48,
  },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 48,
    height: 48,
  },
  sendGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  previewCard: {
    width: SCREEN_WIDTH - 64,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  previewDuration: {
    fontSize: 32,
    fontWeight: '300',
    color: '#14b8a6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 24,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 28,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#14b8a6',
    borderRadius: 2,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  discardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  discardText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  sendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#14b8a6',
  },
  sendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default InlineVoiceRecorder;
