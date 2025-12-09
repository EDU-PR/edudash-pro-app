/**
 * InlineVoiceRecorder Component
 * Simple tap-to-record voice recorder with preview
 * 
 * Features:
 * - Tap mic to start recording
 * - Tap stop button to finish recording
 * - Preview with play/pause before sending
 * - Discard or send options
 * 
 * Uses expo-av Audio.Recording API (stable, no shared object issues)
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  Vibration,
  Platform,
  Modal,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_RECORDING_DURATION = 500;
const WAVEFORM_BAR_COUNT = 35;

// Colors
const TEAL_PRIMARY = '#14b8a6';
const TEAL_DARK = '#0d9488';
const RED_PRIMARY = '#ef4444';
const PURPLE_PRIMARY = '#8b5cf6';
const PURPLE_DARK = '#7c3aed';

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
  isRecording: isRecordingProp, // Renamed to avoid confusion - we use internal state
}) => {
  // Internal recording state - this is the source of truth for UI
  const [internalIsRecording, setInternalIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BAR_COUNT).fill(0.15));
  const [isLongPressMode, setIsLongPressMode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false); // Show loading during permission/setup
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [previewWaveform, setPreviewWaveform] = useState<number[]>([]);
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const waveformDataRef = useRef<number[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartTime = useRef(0);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Waveform bar animations (non-native for height)
  const waveformAnims = useMemo(
    () => new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.15)),
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Pulse animation for recording/initializing
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (internalIsRecording || isInitializing) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: false }),
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
  }, [internalIsRecording, isInitializing, pulseAnim]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Start recording (internal)
  const doStartRecording = async (longPressMode: boolean) => {
    if (isRecordingRef.current || recordingRef.current || isInitializing) {
      console.log('[InlineVoiceRecorder] Already recording or initializing');
      return;
    }
    
    // Show initializing state first (don't show recording UI yet)
    setIsInitializing(true);
    setIsLongPressMode(longPressMode);
    console.log('[InlineVoiceRecorder] Starting recording...', { longPressMode });
    
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        console.warn('[InlineVoiceRecorder] Permission denied');
        setIsInitializing(false);
        setIsLongPressMode(false);
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
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
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.15));
      
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);
      
      // NOW show recording UI after everything is set up
      isRecordingRef.current = true;
      setIsInitializing(false);
      setInternalIsRecording(true);
      
      console.log('[InlineVoiceRecorder] Recording started!');
      Vibration.vibrate(30);
      onRecordingStart(); // Notify parent
      
    } catch (error) {
      console.error('[InlineVoiceRecorder] Start error:', error);
      isRecordingRef.current = false;
      setIsInitializing(false);
      setInternalIsRecording(false);
      setIsLongPressMode(false);
      recordingRef.current = null;
    }
  };

  // Stop recording - with option to show preview or send directly
  const doStopRecording = async (showPreviewModal: boolean) => {
    if (!isRecordingRef.current && !recordingRef.current) {
      console.log('[InlineVoiceRecorder] Not recording');
      return;
    }
    
    isRecordingRef.current = false;
    setInternalIsRecording(false);
    console.log('[InlineVoiceRecorder] Stopping...', { showPreviewModal });
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    const duration = Date.now() - recordingStartTime.current;
    
    try {
      const recording = recordingRef.current;
      recordingRef.current = null;
      
      if (!recording) {
        console.log('[InlineVoiceRecorder] No recording object');
        onRecordingCancel();
        return;
      }
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('[InlineVoiceRecorder] Stopped, URI:', uri);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      if (!uri || duration < MIN_RECORDING_DURATION) {
        console.log('[InlineVoiceRecorder] Too short, cancelling');
        Vibration.vibrate(30);
        onRecordingCancel();
      } else if (showPreviewModal) {
        // Show preview modal
        const savedWaveform = waveformDataRef.current.length > 0 
          ? waveformDataRef.current 
          : new Array(30).fill(0).map(() => 0.3 + Math.random() * 0.5);
        setPreviewWaveform(savedWaveform);
        setPreviewUri(uri);
        setPreviewDuration(duration);
        setShowPreview(true);
      } else {
        // Send immediately (long press mode)
        console.log('[InlineVoiceRecorder] Sending directly');
        Vibration.vibrate([0, 30, 50, 30]);
        onRecordingComplete(uri, duration);
      }
    } catch (error) {
      console.error('[InlineVoiceRecorder] Stop error:', error);
      recordingRef.current = null;
      onRecordingCancel();
    }
    
    setIsLongPressMode(false);
  };

  // Tap mic button - start recording (will show preview on stop)
  const handleTapMic = () => {
    if (!internalIsRecording && !isRecordingRef.current) {
      doStartRecording(false);
    }
  };

  // Long press started - start recording in long press mode
  const handleLongPress = () => {
    if (isRecordingRef.current) return; // Already recording
    isLongPressRef.current = true;
    Vibration.vibrate(50);
    doStartRecording(true);
  };

  // Touch handlers for mic button
  const handlePressIn = () => {
    touchStartTime.current = Date.now();
    isLongPressRef.current = false;
    
    // Start long press timer (400ms for better detection)
    longPressTimerRef.current = setTimeout(() => {
      handleLongPress();
    }, 400);
  };

  const handlePressOut = () => {
    const pressDuration = Date.now() - touchStartTime.current;
    
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    console.log('[InlineVoiceRecorder] handlePressOut', { 
      pressDuration, 
      isLongPress: isLongPressRef.current, 
      isRecording: isRecordingRef.current,
      hasRecording: !!recordingRef.current
    });
    
    // If it was a long press mode recording, stop and send immediately
    if (isLongPressRef.current) {
      // Reset long press mode state immediately so UI updates
      setIsLongPressMode(false);
      
      // Give a small delay to ensure recording has fully started
      setTimeout(() => {
        if (recordingRef.current) {
          console.log('[InlineVoiceRecorder] Long press release - sending');
          doStopRecording(false); // Send directly, no preview
        } else {
          console.log('[InlineVoiceRecorder] Long press release - no recording yet, cancelling');
          setIsInitializing(false);
          setInternalIsRecording(false);
          isRecordingRef.current = false;
          onRecordingCancel();
        }
      }, 150);
    } else if (pressDuration < 400 && !isRecordingRef.current && !recordingRef.current && !isInitializing) {
      // Short tap - start recording (will use stop button to finish)
      handleTapMic();
    }
    
    isLongPressRef.current = false;
  };

  // Stop button pressed - show preview
  const handleStopRecording = () => {
    doStopRecording(true); // Show preview modal
  };

  // Cancel recording
  const handleCancelRecording = async () => {
    if (!isRecordingRef.current && !recordingRef.current) {
      return;
    }
    
    isRecordingRef.current = false;
    setInternalIsRecording(false);
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    try {
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (error) {
      console.error('[InlineVoiceRecorder] Cancel error:', error);
    }
    
    setIsLongPressMode(false);
    Vibration.vibrate(30);
    onRecordingCancel();
  };

  // Preview playback handlers
  const handlePlayPause = async () => {
    if (!previewUri) return;
    
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: previewUri },
            { shouldPlay: true },
            (status) => {
              if (status.isLoaded) {
                if (status.durationMillis && status.positionMillis !== undefined) {
                  setPlaybackProgress(status.positionMillis / status.durationMillis);
                }
                if (status.didJustFinish) {
                  setIsPlaying(false);
                  setPlaybackProgress(0);
                }
              }
            }
          );
          soundRef.current = sound;
        } else {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && status.positionMillis >= (status.durationMillis || 0) - 100) {
            await soundRef.current.setPositionAsync(0);
            setPlaybackProgress(0);
          }
          await soundRef.current.playAsync();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('[InlineVoiceRecorder] Playback error:', error);
    }
  };

  const handleSend = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setShowPreview(false);
    setIsPlaying(false);
    setPlaybackProgress(0);
    
    if (previewUri) {
      onRecordingComplete(previewUri, previewDuration);
    }
    setPreviewUri(null);
  };

  const handleDiscard = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setShowPreview(false);
    setIsPlaying(false);
    setPlaybackProgress(0);
    setPreviewUri(null);
    onRecordingCancel();
  };

  // Render waveform bars for recording
  const renderRecordingWaveform = () => (
    <View style={styles.waveformContainer}>
      {waveformAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 28],
              }),
              backgroundColor: TEAL_PRIMARY,
            },
          ]}
        />
      ))}
    </View>
  );

  // Preview Modal
  const renderPreviewModal = () => (
    <Modal
      visible={showPreview}
      transparent
      animationType="fade"
      onRequestClose={handleDiscard}
    >
      <View style={styles.previewOverlay}>
        <View style={styles.previewCard}>
          {/* Header */}
          <View style={styles.previewHeader}>
            <View style={styles.previewIcon}>
              <Ionicons name="mic" size={28} color="#fff" />
            </View>
            <Text style={styles.previewTitle}>Voice Message</Text>
            <Text style={styles.previewSubtitle}>Ready to send</Text>
          </View>
          
          {/* Duration Display */}
          <View style={styles.durationContainer}>
            <Text style={styles.durationText}>{formatDuration(previewDuration)}</Text>
          </View>
          
          {/* Waveform with Progress */}
          <View style={styles.previewWaveformContainer}>
            <View style={styles.previewWaveformBars}>
              {previewWaveform.slice(0, 45).map((height, index) => {
                const totalBars = Math.min(previewWaveform.length, 45);
                const isPlayed = index < Math.floor(totalBars * playbackProgress);
                return (
                  <View
                    key={index}
                    style={[
                      styles.previewWaveformBar,
                      {
                        height: Math.max(4, height * 45),
                        backgroundColor: isPlayed ? TEAL_PRIMARY : '#4B5563',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
          
          {/* Large Play/Pause Button */}
          <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.8}>
            <LinearGradient
              colors={[TEAL_PRIMARY, TEAL_DARK]}
              style={styles.largePlayButton}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={44}
                color="#fff"
                style={isPlaying ? {} : { marginLeft: 5 }}
              />
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Action Buttons */}
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
              <Ionicons name="trash-outline" size={24} color={RED_PRIMARY} />
              <Text style={styles.discardText}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleSend} activeOpacity={0.8}>
              <LinearGradient
                colors={[PURPLE_PRIMARY, PURPLE_DARK]}
                style={styles.sendButton}
              >
                <Ionicons name="send" size={24} color="#fff" />
                <Text style={styles.sendText}>Send</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Idle state - show mic button
  // Tap = start recording (use stop button to finish with preview)
  // Long press = start recording (release to send immediately)
  if (!internalIsRecording) {
    return (
      <>
        <TouchableOpacity 
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
          style={styles.micButton}
          delayLongPress={300}
          disabled={isInitializing}
        >
          <LinearGradient 
            colors={isInitializing ? ['#9ca3af', '#6b7280'] : [TEAL_PRIMARY, TEAL_DARK]} 
            style={styles.micGradient}
          >
            {isInitializing ? (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Ionicons name="mic" size={24} color="#fff" />
              </Animated.View>
            ) : (
              <Ionicons name="mic" size={24} color="#fff" />
            )}
          </LinearGradient>
        </TouchableOpacity>
        {renderPreviewModal()}
      </>
    );
  }

  // Handle release during long press mode recording
  const handleRecordingPressOut = () => {
    if (isLongPressMode && recordingRef.current) {
      console.log('[InlineVoiceRecorder] Recording area release - sending');
      setIsLongPressMode(false);
      doStopRecording(false); // Send directly
    }
  };

  // Recording state - show controls
  // If long press mode, show "Release to send" hint
  // If tap mode, show stop button
  return (
    <>
      <Pressable 
        style={styles.recordingContainer}
        onPressOut={isLongPressMode ? handleRecordingPressOut : undefined}
      >
        <View style={styles.recordingRow}>
          {/* Cancel button */}
          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={handleCancelRecording}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color={RED_PRIMARY} />
          </TouchableOpacity>
          
          {/* Timer and waveform */}
          <View style={styles.recordingCenter}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
            {!isLongPressMode && renderRecordingWaveform()}
            {isLongPressMode && (
              <Text style={styles.releaseHint}>Release to send</Text>
            )}
          </View>
          
          {/* Stop button - only show in tap mode */}
          {!isLongPressMode && (
            <TouchableOpacity 
              onPress={handleStopRecording}
              activeOpacity={0.7}
              style={styles.stopBtn}
            >
              <LinearGradient colors={[TEAL_PRIMARY, TEAL_DARK]} style={styles.stopGradient}>
                <Ionicons name="stop" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* In long press mode, show pulsing mic (user is still holding) */}
          {isLongPressMode && (
            <Animated.View style={[styles.stopBtn, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={[TEAL_PRIMARY, TEAL_DARK]} style={styles.stopGradient}>
                <Ionicons name="mic" size={22} color="#fff" />
              </LinearGradient>
            </Animated.View>
          )}
        </View>
      </Pressable>
      {renderPreviewModal()}
    </>
  );
};

const styles = StyleSheet.create({
  // Mic Button (idle state)
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
    shadowColor: TEAL_PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Recording Container
  recordingContainer: {
    flex: 1,
    height: 48,
  },
  
  // Recording Row (simple layout)
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 4,
  },
  recordingCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  cancelBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    width: 48,
    height: 48,
  },
  stopGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAL_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RED_PRIMARY,
  },
  timerText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  releaseHint: {
    fontSize: 12,
    color: TEAL_PRIMARY,
    fontWeight: '500',
    marginLeft: 8,
  },
  
  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  
  // Preview Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewCard: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#1f2937',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TEAL_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
  durationContainer: {
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 24,
  },
  durationText: {
    fontSize: 32,
    fontWeight: '300',
    color: TEAL_PRIMARY,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewWaveformContainer: {
    width: '100%',
    marginBottom: 24,
  },
  previewWaveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 3,
  },
  previewWaveformBar: {
    width: 4,
    borderRadius: 2,
  },
  largePlayButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: TEAL_PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  discardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  discardText: {
    color: RED_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  sendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default InlineVoiceRecorder;
