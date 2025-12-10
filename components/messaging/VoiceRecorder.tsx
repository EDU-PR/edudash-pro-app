/**
 * VoiceRecorder Component - Enhanced
 * WhatsApp-style hold-to-record voice message with real-time waveform
 * 
 * Features:
 * - Hold button to record
 * - Slide left to cancel
 * - Release to send
 * - Real-time audio waveform visualization
 * - Lock to continue recording hands-free
 * - Playback preview before sending
 * 
 * Uses expo-av Audio.Recording API (stable, no shared object issues)
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  PanResponder,
  Vibration,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CYAN_PRIMARY,
  PURPLE_PRIMARY,
  PURPLE_INDIGO,
  WAVEFORM_PLAYED,
  WAVEFORM_UNPLAYED,
  ERROR_RED,
  GRADIENT_PURPLE_INDIGO,
} from './theme';

const CANCEL_THRESHOLD = -80;
const LOCK_THRESHOLD = -60;
const MIN_RECORDING_DURATION = 500;
const WAVEFORM_BAR_COUNT = 45;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BAR_COUNT).fill(0.15));
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const waveformDataRef = useRef<number[]>([]);
  
  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(0)).current;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const lockOpacity = useRef(new Animated.Value(0)).current;
  
  // Waveform bar animations
  const waveformAnims = useMemo(
    () => new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.15)),
    []
  );
  
  // Sync refs
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

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

  // Pulse animation for active recording - use JS driver since we also use setValue()
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
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

  const startRecording = async () => {
    if (isRecordingRef.current || recordingRef.current) return;
    
    isRecordingRef.current = true;
    
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        isRecordingRef.current = false;
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // Create recording with metering
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
            const value = 0.15 + normalized * 0.7 + Math.random() * 0.1;
            
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
        100
      );
      
      recordingRef.current = recording;
      recordingStartTime.current = Date.now();
      waveformDataRef.current = [];
      setIsRecording(true);
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.15));
      
      Vibration.vibrate(50);
      
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);
      
      // Animate UI
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, tension: 100, friction: 8 }).start();
      Animated.parallel([
        Animated.timing(cancelOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(lockOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      
    } catch (error) {
      console.error('[VoiceRecorder] Start error:', error);
      isRecordingRef.current = false;
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  const stopRecording = async (cancelled: boolean = false) => {
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
      
      if (!uri || cancelled || duration < MIN_RECORDING_DURATION) {
        Vibration.vibrate(30);
        onRecordingCancel?.();
        resetState();
      } else {
        if (isLockedRef.current) {
          // Show preview
          const savedWaveform = waveformDataRef.current.length > 0 
            ? waveformDataRef.current 
            : new Array(30).fill(0).map(() => 0.3 + Math.random() * 0.5);
          setPreviewUri(uri);
          setPreviewDuration(duration);
          setShowPreview(true);
          setIsRecording(false);
          setIsLocked(false);
        } else {
          Vibration.vibrate([0, 30, 50, 30]);
          onRecordingComplete(uri, duration);
          resetState();
        }
      }
    } catch (error) {
      console.error('[VoiceRecorder] Stop error:', error);
      recordingRef.current = null;
      resetState();
    }
  };

  const resetState = () => {
    setIsRecording(false);
    setIsLocked(false);
    setRecordingDuration(0);
    setShowPreview(false);
    setPreviewUri(null);
    setPreviewDuration(0);
    setPreviewProgress(0);
    setIsPlayingPreview(false);
    
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideUpAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(cancelOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(lockOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
    
    waveformAnims.forEach(anim => anim.setValue(0.15));
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
      console.error('[VoiceRecorder] Playback error:', error);
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

  // PanResponder for gesture detection (slide left to cancel, slide up to lock)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isRecording,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return isRecording && (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10);
      },
      onPanResponderGrant: () => {
        // Reset animations
        slideAnim.setValue(0);
        slideUpAnim.setValue(0);
        cancelOpacity.setValue(0);
        lockOpacity.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        
        // Slide left to cancel
        if (dx < -30 && Math.abs(dy) < Math.abs(dx) * 0.5) {
          const slideProgress = Math.min(1, Math.abs(dx) / Math.abs(CANCEL_THRESHOLD));
          slideAnim.setValue(dx);
          cancelOpacity.setValue(slideProgress);
          
          if (slideProgress > 0.7 && !isLocked) {
            Vibration.vibrate(10, false);
          }
        } 
        // Slide up to lock
        else if (dy < -30 && Math.abs(dx) < Math.abs(dy) * 0.5) {
          const lockProgress = Math.min(1, Math.abs(dy) / Math.abs(LOCK_THRESHOLD));
          slideUpAnim.setValue(dy);
          lockOpacity.setValue(lockProgress);
          
          if (lockProgress > 0.7 && !isLocked) {
            Vibration.vibrate(50);
            setIsLocked(true);
            isLockedRef.current = true;
            
            // Show controls immediately when locked
            Animated.parallel([
              Animated.timing(cancelOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.timing(lockOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
          }
        }
        // Reset if moving away from gesture zones
        else {
          slideAnim.setValue(0);
          slideUpAnim.setValue(0);
          if (!isLocked) {
            cancelOpacity.setValue(0);
            lockOpacity.setValue(0);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        
        // Cancel if slid left enough
        if (dx < CANCEL_THRESHOLD && !isLocked) {
          Vibration.vibrate(100);
          stopRecording(true);
          return;
        }
        
        // Lock if slid up enough
        if (dy < LOCK_THRESHOLD && !isLocked) {
          setIsLocked(true);
          isLockedRef.current = true;
          Animated.parallel([
            Animated.spring(slideUpAnim, { toValue: 0, useNativeDriver: true }),
            Animated.timing(lockOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
          return;
        }
        
        // Release normally (send if not locked, do nothing if locked)
        if (!isLocked) {
          stopRecording(false);
        }
        
        // Reset animations
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }),
          Animated.spring(slideUpAnim, { toValue: 0, useNativeDriver: true }),
        ]).start();
      },
    })
  ).current;

  // Touch handlers for button press
  const handlePressIn = () => {
    if (!disabled && !isRecording && !showPreview) startRecording();
  };

  const handlePressOut = () => {
    // Only handle release if not using gestures
    if (isRecording && !isLocked) {
      stopRecording(false);
    }
  };

  // Preview waveform (generate from recording)
  const previewWaveformBars = useMemo(() => {
    if (waveformDataRef.current.length > 0) {
      const step = Math.max(1, Math.floor(waveformDataRef.current.length / 30));
      return waveformDataRef.current.filter((_, i) => i % step === 0).slice(0, 30);
    }
    return new Array(30).fill(0).map(() => 0.3 + Math.random() * 0.4);
  }, [showPreview]);

  const playedBars = Math.floor(previewWaveformBars.length * previewProgress);

  return (
    <>
      {/* Recording Modal */}
      <Modal visible={isRecording} transparent animationType="fade">
        <View style={styles.modalOverlay} {...panResponder.panHandlers}>
          <Animated.View 
            style={[
              styles.recordingContainer, 
              { 
                transform: [
                  { scale: scaleAnim },
                  { translateX: slideAnim },
                  { translateY: slideUpAnim },
                ],
              },
            ]}
          >
            {/* Gesture hints (only show when not locked) */}
            {!isLocked && (
              <>
                {/* Cancel hint - left side */}
                <Animated.View 
                  style={[
                    styles.cancelZone, 
                    { 
                      opacity: cancelOpacity.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [0.3, 0.8, 1],
                      }),
                    },
                  ]}
                >
                  <View style={styles.cancelContent}>
                    <Ionicons name="arrow-back" size={20} color={ERROR_RED} />
                    <Ionicons name="trash-outline" size={24} color={ERROR_RED} />
                    <Text style={styles.cancelText}>Slide to cancel</Text>
                  </View>
                </Animated.View>
                
                {/* Lock hint - top */}
                <Animated.View 
                  style={[
                    styles.lockZone, 
                    { 
                      opacity: lockOpacity.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [0.3, 0.8, 1],
                      }),
                    },
                  ]}
                >
                  <View style={styles.lockContent}>
                    <Ionicons name="arrow-up" size={20} color={CYAN_PRIMARY} />
                    <Ionicons name="lock-open-outline" size={24} color={CYAN_PRIMARY} />
                    <Text style={[styles.lockText, { color: CYAN_PRIMARY }]}>Slide up to lock</Text>
                  </View>
                </Animated.View>
              </>
            )}
            
            {/* Locked indicator */}
            {isLocked && (
              <Animated.View style={[styles.lockZone, { opacity: lockOpacity }]}>
                <View style={styles.lockContent}>
                  <Ionicons name="lock-closed" size={24} color={CYAN_PRIMARY} />
                  <Text style={[styles.lockText, { color: CYAN_PRIMARY }]}>Locked</Text>
                </View>
              </Animated.View>
            )}
            
            {/* Main recording UI */}
            <View style={styles.recordingContent}>
              <Animated.View style={[styles.micCircle, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.micGradient}>
                  <Ionicons name="mic" size={40} color="#fff" />
                </LinearGradient>
              </Animated.View>
              
              <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
              
              {/* Waveform */}
              <View style={styles.waveformContainer}>
                {waveformAnims.map((anim, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.waveformBar,
                      {
                        height: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [4, 40],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>
              
              {/* Locked controls */}
              {isLocked && (
                <View style={styles.lockedControls}>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={() => stopRecording(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={28} color={ERROR_RED} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => stopRecording(false)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.sendButtonLocked}>
                      <Ionicons name="send" size={28} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Instruction hint (only show briefly at start) */}
              {!isLocked && recordingDuration < 2000 && (
                <Text style={styles.instructionText}>
                  Release to send
                </Text>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
      
      {/* Preview Modal */}
      <Modal visible={showPreview} transparent animationType="slide" onRequestClose={handleDiscardPreview}>
        <View style={styles.modalOverlay}>
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Voice Message</Text>
              <TouchableOpacity onPress={handleDiscardPreview}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={styles.previewWaveform}>
              <TouchableOpacity onPress={handlePreviewPlayPause}>
                <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={styles.playButton}>
                  <Ionicons name={isPlayingPreview ? 'pause' : 'play'} size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <View style={styles.previewBars}>
                {previewWaveformBars.map((height, index) => (
                  <View key={index} style={[styles.previewBar, { height: height * 35, backgroundColor: index < playedBars ? WAVEFORM_PLAYED : WAVEFORM_UNPLAYED }]} />
                ))}
              </View>
              <Text style={styles.previewDuration}>{formatDuration(previewDuration)}</Text>
            </View>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.discardButton} onPress={handleDiscardPreview}>
                <Ionicons name="trash-outline" size={22} color={ERROR_RED} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendPreview}>
                <LinearGradient colors={GRADIENT_PURPLE_INDIGO} style={[styles.sendButton, { width: 56, height: 56, borderRadius: 28 }]}>
                  <Ionicons name="send" size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled || showPreview} activeOpacity={1} style={styles.container}>
        <Ionicons name="mic" size={24} color={CYAN_PRIMARY} />
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  cancelZone: {
    position: 'absolute',
    left: -80,
    top: '50%',
    transform: [{ translateY: -30 }],
  },
  cancelContent: {
    alignItems: 'center',
    gap: 4,
  },
  cancelText: {
    color: ERROR_RED,
    fontSize: 12,
  },
  lockZone: {
    position: 'absolute',
    top: -70,
    alignSelf: 'center',
  },
  lockContent: {
    alignItems: 'center',
    gap: 4,
  },
  lockText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  recordingContent: {
    alignItems: 'center',
    width: '100%',
  },
  micCircle: {
    marginBottom: 16,
  },
  micGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  durationText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 2,
    marginBottom: 16,
  },
  waveformBar: {
    width: 3,
    backgroundColor: PURPLE_PRIMARY,
    borderRadius: 1.5,
  },
  lockedControls: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  cancelButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonLocked: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  previewWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    gap: 2,
  },
  previewBar: {
    width: 3,
    borderRadius: 1.5,
  },
  previewDuration: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  discardButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceRecorder;
