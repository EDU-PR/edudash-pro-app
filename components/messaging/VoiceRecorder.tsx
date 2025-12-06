/**
 * VoiceRecorder Component - Enhanced
 * WhatsApp-style hold-to-record voice message with real-time waveform
 * Features:
 * - Hold button to record
 * - Slide left to cancel
 * - Release to send
 * - Real-time audio waveform visualization
 * - Lock to continue recording hands-free
 * - Playback preview before sending
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { Audio, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [slideOffset, setSlideOffset] = useState(0);
  const [slideUpOffset, setSlideUpOffset] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BAR_COUNT).fill(0.15));
  const [meteringEnabled, setMeteringEnabled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Refs to track state in PanResponder (avoids stale closure issue)
  const isRecordingRef = useRef(isRecording);
  const isLockedRef = useRef(isLocked);
  const slideOffsetRef = useRef(slideOffset);
  
  // Keep refs in sync with state
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);
  useEffect(() => { slideOffsetRef.current = slideOffset; }, [slideOffset]);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(0)).current;
  const cancelOpacity = useRef(new Animated.Value(1)).current;
  const lockOpacity = useRef(new Animated.Value(1)).current;
  const waveformAnims = useRef(
    new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.15))
  ).current;
  
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (isRecording && meteringEnabled && recordingRef.current) {
      meteringIntervalRef.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
              const value = 0.15 + normalized * 0.7 + Math.random() * 0.1;
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
        } catch (e) {}
      }, 50);
      return () => {
        if (meteringIntervalRef.current) {
          clearInterval(meteringIntervalRef.current);
          meteringIntervalRef.current = null;
        }
      };
    }
  }, [isRecording, meteringEnabled, waveformAnims]);
  
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
      
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      
      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      
      recordingRef.current = recording;
      recordingStartTime.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
      setMeteringEnabled(true);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.15));
      Vibration.vibrate(50);
      
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);
      
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, tension: 100, friction: 8 }).start();
      Animated.parallel([
        Animated.timing(cancelOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(lockOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };
  
  const stopRecording = async (cancelled: boolean = false) => {
    if (!recordingRef.current) return;
    
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    if (meteringIntervalRef.current) { clearInterval(meteringIntervalRef.current); meteringIntervalRef.current = null; }
    
    const duration = Date.now() - recordingStartTime.current;
    setMeteringEnabled(false);
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      
      if (cancelled || duration < MIN_RECORDING_DURATION) {
        Vibration.vibrate(30);
        onRecordingCancel?.();
        resetState();
      } else {
        const uri = recordingRef.current.getURI();
        if (uri) {
          if (isLocked) {
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
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      resetState();
    }
    
    recordingRef.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  };
  
  const resetState = () => {
    setIsRecording(false);
    setIsLocked(false);
    setRecordingDuration(0);
    setSlideOffset(0);
    setSlideUpOffset(0);
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
    
    if (previewSoundRef.current) {
      previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }
  };
  
  const handlePreviewPlayPause = async () => {
    if (!previewUri) return;
    try {
      if (!previewSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: previewUri },
          { shouldPlay: true },
          (status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
              setIsPlayingPreview(false);
              setPreviewProgress(0);
            } else if (status.isPlaying && status.durationMillis) {
              setPreviewProgress(status.positionMillis / status.durationMillis);
            }
          }
        );
        previewSoundRef.current = sound;
        setIsPlayingPreview(true);
      } else {
        const status = await previewSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await previewSoundRef.current.pauseAsync();
            setIsPlayingPreview(false);
          } else {
            await previewSoundRef.current.playAsync();
            setIsPlayingPreview(true);
          }
        }
      }
    } catch (e) { console.error('Preview playback error:', e); }
  };
  
  const handleSendPreview = () => {
    if (previewUri) {
      Vibration.vibrate([0, 30, 50, 30]);
      onRecordingComplete(previewUri, previewDuration);
    }
    resetState();
  };
  
  const handleDiscardPreview = () => {
    Vibration.vibrate(30);
    onRecordingCancel?.();
    resetState();
  };
  
  // Stable stopRecording ref for use in panResponder
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => { stopRecordingRef.current = stopRecording; });
  
  // PanResponder with proper state tracking via refs
  const panResponder = useMemo(() => 
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isLockedRef.current,
      onMoveShouldSetPanResponder: () => !isLockedRef.current,
      onPanResponderGrant: () => {
        // Visual feedback when gesture starts
        Animated.parallel([
          Animated.timing(cancelOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(lockOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      },
      onPanResponderMove: (_, gestureState) => {
        // Slide left to cancel
        if (gestureState.dx < 0) {
          const offset = Math.max(gestureState.dx, CANCEL_THRESHOLD * 1.5);
          slideOffsetRef.current = offset;
          setSlideOffset(offset);
          slideAnim.setValue(offset);
          // Visual emphasis as we approach threshold
          const progress = Math.min(Math.abs(offset) / Math.abs(CANCEL_THRESHOLD), 1);
          cancelOpacity.setValue(1 + progress * 0.5);
          // Haptic feedback when crossing threshold
          if (Math.abs(offset) >= Math.abs(CANCEL_THRESHOLD) && Math.abs(slideOffsetRef.current) < Math.abs(CANCEL_THRESHOLD)) {
            Vibration.vibrate(10);
          }
        } else {
          slideAnim.setValue(0);
          setSlideOffset(0);
        }
        // Slide up to lock
        if (gestureState.dy < 0) {
          const offset = Math.max(gestureState.dy, LOCK_THRESHOLD * 1.5);
          setSlideUpOffset(offset);
          slideUpAnim.setValue(offset);
          const progress = Math.min(Math.abs(offset) / Math.abs(LOCK_THRESHOLD), 1);
          lockOpacity.setValue(1 + progress * 0.5);
        } else {
          slideUpAnim.setValue(0);
          setSlideUpOffset(0);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < CANCEL_THRESHOLD) {
          // Cancelled - slide left passed threshold
          Vibration.vibrate(30);
          stopRecordingRef.current(true);
        } else if (gestureState.dy < LOCK_THRESHOLD) {
          // Locked - slide up passed threshold  
          setIsLocked(true);
          Vibration.vibrate([0, 50, 30, 50]);
          Animated.parallel([
            Animated.timing(cancelOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(lockOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start();
        } else {
          // Released without lock/cancel - send recording
          stopRecordingRef.current(false);
        }
        setSlideOffset(0);
        setSlideUpOffset(0);
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }),
          Animated.spring(slideUpAnim, { toValue: 0, useNativeDriver: true }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        setSlideOffset(0);
        setSlideUpOffset(0);
        slideAnim.setValue(0);
        slideUpAnim.setValue(0);
      },
    })
  , [cancelOpacity, lockOpacity, slideAnim, slideUpAnim]);
  
  const handlePressIn = useCallback(() => {
    if (!disabled && !isRecording && !showPreview) startRecording();
  }, [disabled, isRecording, showPreview]);
  
  const handlePressOut = useCallback(() => {
    if (isRecording && !isLocked && slideOffset > CANCEL_THRESHOLD) stopRecording(false);
  }, [isRecording, isLocked, slideOffset]);
  
  const handleLockedStop = useCallback(() => {
    if (isRecording && isLocked) stopRecording(false);
  }, [isRecording, isLocked]);

  const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
    recordingContainer: {
      backgroundColor: 'rgba(15, 23, 42, 0.98)',
      marginHorizontal: 12,
      marginBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 20,
      borderRadius: 24,
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12 },
        android: { elevation: 12 },
      }),
    },
    waveformSection: { paddingVertical: 20, paddingHorizontal: 16 },
    waveformContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, marginBottom: 12 },
    waveformBar: { width: 3, marginHorizontal: 1, borderRadius: 1.5, backgroundColor: '#ec4899' },
    recordingInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
    recordingTime: { fontSize: 18, fontWeight: '600', color: '#fff', fontVariant: ['tabular-nums'] },
    controlBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 20, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)', minHeight: 100 },
    cancelHint: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
    cancelText: { fontSize: 13, color: '#ef4444', fontWeight: '500' },
    lockHint: { alignItems: 'center', gap: 6, flex: 1 },
    lockIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124, 58, 237, 0.2)', alignItems: 'center', justifyContent: 'center' },
    lockText: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
    micButtonContainer: { alignItems: 'center', flex: 1 },
    micButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
    lockedControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
    discardButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(239, 68, 68, 0.2)', alignItems: 'center', justifyContent: 'center' },
    sendButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    stopButton: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
    previewContainer: { backgroundColor: 'rgba(15, 23, 42, 0.98)', marginHorizontal: 12, marginBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 20, borderRadius: 24, overflow: 'hidden' },
    previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
    previewTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
    previewWaveform: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
    playButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    previewBars: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 40 },
    previewBar: { width: 3, marginHorizontal: 1, borderRadius: 1.5 },
    previewDuration: { fontSize: 14, color: '#9CA3AF', minWidth: 45, textAlign: 'right' },
    previewActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  });
  
  const previewWaveformBars = waveformData.length > 0 ? waveformData : new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => 0.2 + Math.random() * 0.5);
  const playedBars = Math.floor(previewProgress * previewWaveformBars.length);
  
  return (
    <>
      <Modal visible={isRecording} transparent animationType="fade" onRequestClose={() => stopRecording(true)}>
        <View style={styles.modalOverlay} {...(!isLocked ? panResponder.panHandlers : {})}>
          <Animated.View style={[styles.recordingContainer, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.waveformSection}>
              <View style={styles.waveformContainer}>
                {waveformAnims.map((anim, index) => (
                  <Animated.View
                    key={index}
                    style={[styles.waveformBar, {
                      height: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 50] }),
                      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                    }]}
                  />
                ))}
              </View>
              <View style={styles.recordingInfo}>
                <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
              </View>
            </View>
            
            {isLocked ? (
              <View style={styles.lockedControls}>
                <TouchableOpacity style={styles.discardButton} onPress={() => stopRecording(true)}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={handleLockedStop}>
                  <Ionicons name="stop" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.sendButton} onPress={handleLockedStop}>
                  <LinearGradient colors={['#7c3aed', '#ec4899']} style={styles.sendButton}>
                    <Ionicons name="send" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.controlBar}>
                {/* Slide left to cancel hint */}
                <Animated.View style={[styles.cancelHint, { 
                  opacity: cancelOpacity,
                  transform: [{ 
                    translateX: slideAnim.interpolate({
                      inputRange: [CANCEL_THRESHOLD * 1.5, 0],
                      outputRange: [-20, 0],
                      extrapolate: 'clamp',
                    })
                  }]
                }]}>
                  <Ionicons name="chevron-back" size={20} color="#ef4444" />
                  <Ionicons name="chevron-back" size={20} color="#ef4444" style={{ marginLeft: -12 }} />
                  <Text style={styles.cancelText}>Slide to cancel</Text>
                </Animated.View>
                
                {/* Mic button in center with gesture area */}
                <View style={styles.micButtonContainer}>
                  <Animated.View style={{ 
                    transform: [
                      { scale: scaleAnim },
                      { translateX: slideAnim },
                      { translateY: slideUpAnim }
                    ] 
                  }}>
                    <LinearGradient colors={['#7c3aed', '#ec4899']} style={styles.micButton}>
                      <Ionicons name="mic" size={28} color="#fff" />
                    </LinearGradient>
                  </Animated.View>
                </View>
                
                {/* Slide up to lock hint */}
                <Animated.View style={[styles.lockHint, { 
                  opacity: lockOpacity,
                  transform: [{
                    translateY: slideUpAnim.interpolate({
                      inputRange: [LOCK_THRESHOLD * 1.5, 0],
                      outputRange: [-15, 0],
                      extrapolate: 'clamp',
                    })
                  }]
                }]}>
                  <View style={[styles.lockIcon, {
                    backgroundColor: slideUpOffset < LOCK_THRESHOLD ? 'rgba(124, 58, 237, 0.5)' : 'rgba(124, 58, 237, 0.2)'
                  }]}>
                    <Ionicons name="lock-closed" size={18} color={slideUpOffset < LOCK_THRESHOLD ? '#fff' : '#7c3aed'} />
                  </View>
                  <Text style={styles.lockText}>Lock</Text>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
      
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
                <LinearGradient colors={['#7c3aed', '#ec4899']} style={styles.playButton}>
                  <Ionicons name={isPlayingPreview ? 'pause' : 'play'} size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <View style={styles.previewBars}>
                {previewWaveformBars.map((height, index) => (
                  <View key={index} style={[styles.previewBar, { height: height * 35, backgroundColor: index < playedBars ? '#ec4899' : 'rgba(236, 72, 153, 0.3)' }]} />
                ))}
              </View>
              <Text style={styles.previewDuration}>{formatDuration(previewDuration)}</Text>
            </View>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.discardButton} onPress={handleDiscardPreview}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendPreview}>
                <LinearGradient colors={['#7c3aed', '#ec4899']} style={[styles.sendButton, { width: 56, height: 56, borderRadius: 28 }]}>
                  <Ionicons name="send" size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled || showPreview} activeOpacity={1} style={styles.container}>
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>
    </>
  );
};

export default VoiceRecorder;
