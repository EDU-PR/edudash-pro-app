/**
 * InlineVoiceRecorder Component
 * WhatsApp/Telegram-style inline voice recording that replaces the composer
 * Features:
 * - Hold mic button to start recording
 * - Slide left to cancel
 * - Slide up to lock (hands-free recording)
 * - Real-time waveform visualization
 * - Tap to send when locked
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  PanResponder,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const CANCEL_THRESHOLD = -100;
const LOCK_THRESHOLD = -80;
const MIN_RECORDING_DURATION = 500;
const WAVEFORM_BAR_COUNT = 30;

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
  const [isLocked, setIsLocked] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLockedRef = useRef(isLocked);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const lockAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveformAnims = useRef(
    new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.2))
  ).current;

  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  // Metering for waveform
  useEffect(() => {
    if (isRecording && recordingRef.current) {
      meteringIntervalRef.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
              const value = 0.2 + normalized * 0.6 + Math.random() * 0.1;
              setWaveformData(prev => {
                const newData = [...prev.slice(1), value];
                newData.forEach((val, idx) => {
                  Animated.timing(waveformAnims[idx], {
                    toValue: val, duration: 50, useNativeDriver: false,
                  }).start();
                });
                return newData;
              });
            }
          }
        } catch {}
      }, 80);
      return () => {
        if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
      };
    }
  }, [isRecording, waveformAnims]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;
      
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      
      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      
      recordingRef.current = recording;
      recordingStartTime.current = Date.now();
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
      Vibration.vibrate(50);
      onRecordingStart();
      
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async (cancelled: boolean = false) => {
    if (!recordingRef.current) return;
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    
    const duration = Date.now() - recordingStartTime.current;
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      
      if (cancelled || duration < MIN_RECORDING_DURATION) {
        Vibration.vibrate(30);
        onRecordingCancel();
      } else {
        const uri = recordingRef.current.getURI();
        if (uri) {
          Vibration.vibrate([0, 30, 50, 30]);
          onRecordingComplete(uri, duration);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      onRecordingCancel();
    }
    
    recordingRef.current = null;
    setIsLocked(false);
    setSlideOffset(0);
    slideAnim.setValue(0);
    lockAnim.setValue(0);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRecording();
      },
      onPanResponderMove: (_, gestureState) => {
        if (isLockedRef.current) return;
        
        // Slide left to cancel
        if (gestureState.dx < 0) {
          const offset = Math.max(gestureState.dx, CANCEL_THRESHOLD * 1.2);
          setSlideOffset(offset);
          slideAnim.setValue(offset);
        }
        
        // Slide up to lock
        if (gestureState.dy < 0) {
          const upOffset = Math.max(gestureState.dy, LOCK_THRESHOLD * 1.5);
          lockAnim.setValue(Math.abs(upOffset));
          
          if (gestureState.dy < LOCK_THRESHOLD && !isLockedRef.current) {
            setIsLocked(true);
            isLockedRef.current = true;
            Vibration.vibrate(50);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isLockedRef.current) return; // Don't stop if locked
        
        if (gestureState.dx < CANCEL_THRESHOLD) {
          stopRecording(true);
        } else {
          stopRecording(false);
        }
      },
      onPanResponderTerminate: () => {
        if (!isLockedRef.current) {
          stopRecording(true);
        }
      },
    })
  ).current;

  const handleSendLocked = () => {
    stopRecording(false);
  };

  const handleCancelLocked = () => {
    stopRecording(true);
  };

  if (!isRecording) {
    // Just the mic button when not recording
    return (
      <TouchableOpacity
        {...panResponder.panHandlers}
        activeOpacity={0.8}
        style={styles.micButton}
      >
        <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.micButtonGradient}>
          <Ionicons name="mic" size={22} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Recording UI - replaces the entire composer row
  return (
    <View style={styles.recordingContainer}>
      {isLocked ? (
        // Locked mode - show cancel, waveform, send
        <>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelLocked}>
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
          
          <View style={styles.waveformContainer}>
            {waveformAnims.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 24],
                    }),
                  },
                ]}
              />
            ))}
          </View>
          
          <View style={styles.timerContainer}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
          </View>
          
          <TouchableOpacity style={styles.sendButton} onPress={handleSendLocked}>
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.sendButtonGradient}>
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : (
        // Not locked - show slide to cancel hint
        <Animated.View 
          style={[styles.slideContainer, { transform: [{ translateX: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.cancelHint}>
            <Ionicons name="chevron-back" size={18} color="#ef4444" />
            <Ionicons name="chevron-back" size={18} color="#ef4444" style={{ marginLeft: -10 }} />
            <Text style={styles.cancelHintText}>Slide to cancel</Text>
          </View>
          
          <View style={styles.waveformContainer}>
            {waveformAnims.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 24],
                    }),
                  },
                ]}
              />
            ))}
          </View>
          
          <View style={styles.timerContainer}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
          </View>
          
          <Animated.View style={[styles.lockHint, { opacity: lockAnim.interpolate({ inputRange: [0, 60], outputRange: [1, 0] }) }]}>
            <View style={styles.lockIcon}>
              <Ionicons name="lock-closed" size={16} color="#a78bfa" />
            </View>
          </Animated.View>
          
          <View style={styles.micButtonRecording}>
            <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.micButtonGradient}>
              <Ionicons name="mic" size={22} color="#fff" />
            </LinearGradient>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  micButton: {
    width: 44,
    height: 44,
  },
  micButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 50,
    gap: 8,
  },
  slideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelHintText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 2,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 30,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#a78bfa',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 55,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lockHint: {
    alignItems: 'center',
  },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    width: 44,
    height: 44,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
  },
  sendButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default InlineVoiceRecorder;
