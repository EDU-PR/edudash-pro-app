/**
 * VoiceRecorder Component — WhatsApp-style hold-to-record
 *
 * - Hold mic button to start recording
 * - Release to send immediately
 * - Slide left to cancel
 * - Slide up to lock (keeps recording, shows stop/send buttons)
 * - Real-time waveform + duration
 *
 * Props interface unchanged — drop-in replacement.
 * Uses expo-audio (useAudioRecorder + useAudioRecorderState).
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  Vibration,
  Platform,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CYAN_PRIMARY,
  PURPLE_PRIMARY,
  ERROR_RED,
  GRADIENT_PURPLE_INDIGO,
} from './theme';

// Dynamic import for expo-audio
let useAudioRecorder: any;
let useAudioRecorderState: any;
let RecordingPresets: any;
let setAudioModeAsync: any;
let requestRecordingPermissionsAsync: any;
let getRecordingPermissionsAsync: any;
let audioAvailable = false;

try {
  const expoAudio = require('expo-audio');
  useAudioRecorder = expoAudio.useAudioRecorder;
  useAudioRecorderState = expoAudio.useAudioRecorderState;
  RecordingPresets = expoAudio.RecordingPresets;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
  requestRecordingPermissionsAsync = expoAudio.requestRecordingPermissionsAsync;
  getRecordingPermissionsAsync = expoAudio.getRecordingPermissionsAsync;
  audioAvailable = true;
} catch {
  // expo-audio not available
}

const MIN_RECORDING_DURATION = 500;
const WAVEFORM_BAR_COUNT = 28;
const CANCEL_SLIDE_X = -100; // slide left 100px to cancel
const LOCK_SLIDE_Y = -80; // slide up 80px to lock

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

// Fallback when expo-audio is unavailable
const VoiceRecorderFallback: React.FC = () => (
  <View style={styles.container}>
    <View style={[styles.micButton, { backgroundColor: '#6B7280' }]}>
      <Ionicons name="mic-off" size={20} color="#9CA3AF" />
    </View>
  </View>
);

const VoiceRecorderImpl: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  disabled = false,
  onRecordingStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [inCancelZone, setInCancelZone] = useState(false);
  const [inLockZone, setInLockZone] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>(
    new Array(WAVEFORM_BAR_COUNT).fill(0.2),
  );

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);

  const isRecordingRef = useRef(false);
  const hasPermissionsRef = useRef(false);
  const recordingStartTime = useRef(0);
  const initialX = useRef(0);
  const initialY = useRef(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const lockSlideY = useRef(new Animated.Value(0)).current;

  const waveformAnims = useMemo(
    () => new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.2)),
    [],
  );

  // Notify parent of recording state
  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  // Pulse animation when recording
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulse.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => { pulse?.stop(); };
  }, [isRecording, pulseAnim]);

  // Update duration + waveform from recorder state
  useEffect(() => {
    if (recorderState?.isRecording) {
      setRecordingDuration(recorderState.durationMillis || 0);
      if (recorderState.metering !== undefined) {
        const normalized = Math.max(0, Math.min(1, (recorderState.metering + 60) / 60));
        const value = 0.2 + normalized * 0.6;
        setWaveformData((prev) => {
          const next = [...prev.slice(1), value];
          next.forEach((v, i) => waveformAnims[i].setValue(v));
          return next;
        });
      }
    }
  }, [recorderState, waveformAnims]);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      try {
        const { granted } = await getRecordingPermissionsAsync();
        if (granted) {
          hasPermissionsRef.current = true;
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }
      } catch {}
    })();
  }, []);

  const formatDuration = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || disabled) return;
    isRecordingRef.current = true;
    try {
      if (!hasPermissionsRef.current) {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) { isRecordingRef.current = false; return; }
        hasPermissionsRef.current = true;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartTime.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
      Vibration.vibrate(50);
    } catch {
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingCancel?.();
    }
  }, [disabled, recorder, onRecordingCancel]);

  const stopRecording = useCallback(async (shouldSend: boolean) => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    const duration = recorderState?.durationMillis || (Date.now() - recordingStartTime.current);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (!uri || duration < MIN_RECORDING_DURATION || !shouldSend) {
        Vibration.vibrate(shouldSend ? 30 : [0, 50, 100]);
        onRecordingCancel?.();
      } else {
        Vibration.vibrate([0, 30, 50, 30]);
        onRecordingComplete(uri, duration);
      }
    } catch {
      onRecordingCancel?.();
    }
    resetState();
  }, [recorder, recorderState, onRecordingComplete, onRecordingCancel]);

  const resetState = () => {
    setIsRecording(false);
    setIsLocked(false);
    setInCancelZone(false);
    setInLockZone(false);
    setRecordingDuration(0);
    slideX.setValue(0);
    lockSlideY.setValue(0);
    waveformAnims.forEach((a) => a.setValue(0.2));
  };

  // PanResponder for hold-to-record gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => isRecordingRef.current,
        onPanResponderGrant: (_e: GestureResponderEvent, _gs: PanResponderGestureState) => {
          initialX.current = 0;
          initialY.current = 0;
          startRecording();
        },
        onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
          if (!isRecordingRef.current) return;
          // Slide left → cancel
          const dx = Math.min(0, gs.dx);
          slideX.setValue(dx);
          setInCancelZone(dx < CANCEL_SLIDE_X);
          // Slide up → lock
          const dy = Math.min(0, gs.dy);
          lockSlideY.setValue(dy);
          setInLockZone(dy < LOCK_SLIDE_Y);
        },
        onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
          if (!isRecordingRef.current) return;
          if (gs.dx < CANCEL_SLIDE_X) {
            // Cancelled
            stopRecording(false);
          } else if (gs.dy < LOCK_SLIDE_Y) {
            // Locked — keep recording, show stop/send buttons
            setIsLocked(true);
            slideX.setValue(0);
            lockSlideY.setValue(0);
          } else {
            // Release → send
            stopRecording(true);
          }
        },
        onPanResponderTerminate: () => {
          if (isRecordingRef.current) stopRecording(false);
        },
      }),
    [disabled, startRecording, stopRecording, slideX, lockSlideY],
  );

  // ─── IDLE STATE ───
  if (!isRecording && !isLocked) {
    return (
      <View style={styles.container}>
        <Animated.View {...panResponder.panHandlers}>
          <LinearGradient
            colors={GRADIENT_PURPLE_INDIGO as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.micButton}
          >
            <Ionicons name="mic" size={20} color="#ffffff" />
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  // ─── LOCKED STATE (recording continues, user sees stop/send) ───
  if (isLocked) {
    return (
      <View style={styles.recordingBar}>
        {/* Red pulse dot */}
        <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
        {/* Waveform */}
        <View style={styles.waveformContainer}>
          {waveformAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                { height: Animated.multiply(anim, 24), backgroundColor: CYAN_PRIMARY },
              ]}
            />
          ))}
        </View>
        {/* Duration */}
        <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
        {/* Cancel */}
        <Animated.View style={styles.lockAction}>
          <Ionicons
            name="trash-outline"
            size={22}
            color={ERROR_RED}
            onPress={() => stopRecording(false)}
          />
        </Animated.View>
        {/* Send */}
        <Animated.View style={styles.lockAction}>
          <LinearGradient
            colors={GRADIENT_PURPLE_INDIGO as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendCircle}
          >
            <Ionicons
              name="send"
              size={18}
              color="#ffffff"
              onPress={() => stopRecording(true)}
            />
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  // ─── RECORDING STATE (hold gesture active) ───
  return (
    <View style={styles.recordingBar}>
      <Animated.View
        style={[
          styles.recordingSlider,
          { transform: [{ translateX: slideX }] },
        ]}
      >
        {/* Red pulse dot */}
        <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
        {/* Waveform */}
        <View style={styles.waveformContainer}>
          {waveformAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                { height: Animated.multiply(anim, 24), backgroundColor: CYAN_PRIMARY },
              ]}
            />
          ))}
        </View>
        {/* Duration */}
        <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
      </Animated.View>

      {/* Cancel hint */}
      <View style={styles.cancelHint}>
        <Ionicons
          name="chevron-back"
          size={14}
          color={inCancelZone ? ERROR_RED : '#64748b'}
        />
        <Text style={[styles.cancelText, inCancelZone && { color: ERROR_RED }]}>
          {inCancelZone ? 'Release to cancel' : 'Slide to cancel'}
        </Text>
      </View>

      {/* Lock hint */}
      <Animated.View
        style={[
          styles.lockHintContainer,
          { transform: [{ translateY: lockSlideY }] },
        ]}
      >
        <View style={[styles.lockHint, inLockZone && styles.lockHintActive]}>
          <Ionicons
            name={inLockZone ? 'lock-closed' : 'lock-open-outline'}
            size={16}
            color={inLockZone ? '#ffffff' : '#94a3b8'}
          />
        </View>
      </Animated.View>
    </View>
  );
};

// Exported wrapper
export const VoiceRecorder: React.FC<VoiceRecorderProps> = (props) => {
  if (!audioAvailable) return <VoiceRecorderFallback />;
  return <VoiceRecorderImpl {...props} />;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 46,
    paddingHorizontal: 4,
    gap: 8,
  },
  recordingSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ERROR_RED,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 28,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  durationText: {
    fontSize: 13,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 48,
    gap: 2,
  },
  cancelText: {
    fontSize: 12,
    color: '#64748b',
  },
  lockHintContainer: {
    position: 'absolute',
    right: 4,
    bottom: 42,
  },
  lockHint: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  lockHintActive: {
    backgroundColor: PURPLE_PRIMARY,
    borderColor: PURPLE_PRIMARY,
  },
  lockAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceRecorder;
