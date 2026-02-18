/**
 * VoiceRecorder Component — WhatsApp-style hold-to-record
 *
 * - Hold mic button to start recording
 * - Release to send immediately
 * - Slide left to cancel
 * - Slide up to lock (keeps recording, shows stop/send buttons)
 * - Real-time waveform + duration
 *
 * CRITICAL: PanResponder wraps the ENTIRE component across all states.
 * Previous bug: PanResponder was only on the idle mic button, so when
 * recording started and the component re-rendered to the recording bar,
 * the PanResponder was lost and gestures froze.
 *
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
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  CYAN_PRIMARY,
  PURPLE_PRIMARY,
  ERROR_RED,
  GRADIENT_PURPLE_INDIGO,
} from './theme';

// Dynamic import for expo-audio
let useAudioRecorder: any;
let useAudioRecorderState: any;
let useAudioPlayer: any;
let useAudioPlayerStatus: any;
let createAudioPlayer: any;
let RecordingPresets: any;
let setAudioModeAsync: any;
let requestRecordingPermissionsAsync: any;
let getRecordingPermissionsAsync: any;
let audioAvailable = false;

try {
  const expoAudio = require('expo-audio');
  useAudioRecorder = expoAudio.useAudioRecorder;
  useAudioRecorderState = expoAudio.useAudioRecorderState;
  useAudioPlayer = expoAudio.useAudioPlayer;
  useAudioPlayerStatus = expoAudio.useAudioPlayerStatus;
  createAudioPlayer = expoAudio.createAudioPlayer;
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
const FLING_CANCEL_VELOCITY = -0.8; // fast fling left cancels

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

// Preview state: recording done, user can play back before sending
type RecorderPhase = 'idle' | 'recording' | 'locked' | 'preview';

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
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [inCancelZone, setInCancelZone] = useState(false);
  const [inLockZone, setInLockZone] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>(
    new Array(WAVEFORM_BAR_COUNT).fill(0.2),
  );
  // Preview state: stored URI + duration after recording stops in locked mode
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);

  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const phaseRef = useRef<RecorderPhase>('idle');
  const hasPermissionsRef = useRef(false);
  const recordingStartTime = useRef(0);
  const latestDurationRef = useRef(0);
  // Preview audio player ref
  const previewPlayerRef = useRef<any>(null);

  // Haptic zone tracking refs (prevent repeated haptics)
  const wasCancelZone = useRef(false);
  const wasLockZone = useRef(false);

  // Derived booleans for backward compat
  const isRecording = phase === 'recording' || phase === 'locked';
  const isLocked = phase === 'locked';

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const lockSlideY = useRef(new Animated.Value(0)).current;

  const waveformAnims = useMemo(
    () => new Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.2)),
    [],
  );

  // Sync phase to refs for PanResponder (reads synchronously)
  useEffect(() => {
    phaseRef.current = phase;
    isLockedRef.current = phase === 'locked';
  }, [phase]);

  // Notify parent of recording state (active during recording + locked + preview)
  useEffect(() => {
    onRecordingStateChange?.(phase !== 'idle');
  }, [phase, onRecordingStateChange]);

  // Pulse animation when recording
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (phase === 'recording' || phase === 'locked') {
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
  }, [phase, pulseAnim]);

  // Update duration + waveform from recorder state
  useEffect(() => {
    if (recorderState?.isRecording) {
      const dur = recorderState.durationMillis || 0;
      setRecordingDuration(dur);
      latestDurationRef.current = dur;
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

  // Request permissions on mount (do NOT set allowsRecording — blocks playback)
  useEffect(() => {
    (async () => {
      try {
        const { granted } = await getRecordingPermissionsAsync();
        if (granted) {
          hasPermissionsRef.current = true;
        }
      } catch {}
    })();
  }, []);

  // Cleanup preview player on unmount
  useEffect(() => {
    return () => {
      if (previewPlayerRef.current) {
        try { previewPlayerRef.current.pause(); } catch {}
        try { previewPlayerRef.current.remove(); } catch {}
        previewPlayerRef.current = null;
      }
    };
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
      // Only enable recording mode when actually starting to record
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartTime.current = Date.now();
      setPhase('recording');
      setRecordingDuration(0);
      setWaveformData(new Array(WAVEFORM_BAR_COUNT).fill(0.2));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      isRecordingRef.current = false;
      setPhase('idle');
      onRecordingCancel?.();
    }
  }, [disabled, recorder, onRecordingCancel]);

  /** Stop recording. If toPreview=true, enters preview mode instead of sending/cancelling. */
  const stopRecording = useCallback(async (shouldSend: boolean, toPreview = false) => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    const duration = latestDurationRef.current || (Date.now() - recordingStartTime.current);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (!uri || duration < MIN_RECORDING_DURATION) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        onRecordingCancel?.();
        resetState();
        return;
      }

      if (toPreview) {
        // Enter preview mode — user can play back before deciding
        setPreviewUri(uri);
        setPreviewDuration(duration);
        setPhase('preview');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }

      if (!shouldSend) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        onRecordingCancel?.();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onRecordingComplete(uri, duration);
      }
    } catch {
      onRecordingCancel?.();
    }
    resetState();
  }, [recorder, onRecordingComplete, onRecordingCancel]);

  /** Send from preview mode */
  const sendPreview = useCallback(() => {
    if (!previewUri) return;
    // Stop preview playback
    if (previewPlayerRef.current) {
      try { previewPlayerRef.current.pause(); } catch {}
      try { previewPlayerRef.current.remove(); } catch {}
      previewPlayerRef.current = null;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onRecordingComplete(previewUri, previewDuration);
    resetState();
  }, [previewUri, previewDuration, onRecordingComplete]);

  /** Discard from preview mode */
  const discardPreview = useCallback(() => {
    if (previewPlayerRef.current) {
      try { previewPlayerRef.current.pause(); } catch {}
      try { previewPlayerRef.current.remove(); } catch {}
      previewPlayerRef.current = null;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onRecordingCancel?.();
    resetState();
  }, [onRecordingCancel]);

  /** Toggle preview playback */
  const togglePreviewPlay = useCallback(async () => {
    if (!previewUri || !createAudioPlayer) return;
    try {
      if (previewPlayerRef.current) {
        if (isPreviewPlaying) {
          previewPlayerRef.current.pause();
          setIsPreviewPlaying(false);
        } else {
          previewPlayerRef.current.seekTo(0);
          previewPlayerRef.current.play();
          setIsPreviewPlaying(true);
        }
        return;
      }
      // Create new player
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: previewUri });
      player.volume = 1.0;
      previewPlayerRef.current = player;
      player.play();
      setIsPreviewPlaying(true);
      // Auto-stop when finished (check periodically)
      const checkInterval = setInterval(() => {
        if (!previewPlayerRef.current?.playing && isPreviewPlaying) {
          setIsPreviewPlaying(false);
          clearInterval(checkInterval);
        }
      }, 200);
      // Cleanup interval after max duration + buffer
      setTimeout(() => clearInterval(checkInterval), previewDuration + 2000);
    } catch (err) {
      console.warn('[VoiceRecorder] Preview playback error:', err);
      setIsPreviewPlaying(false);
    }
  }, [previewUri, previewDuration, isPreviewPlaying]);

  const resetState = () => {
    setPhase('idle');
    isLockedRef.current = false;
    phaseRef.current = 'idle';
    setInCancelZone(false);
    setInLockZone(false);
    setRecordingDuration(0);
    setPreviewUri(null);
    setPreviewDuration(0);
    setIsPreviewPlaying(false);
    wasCancelZone.current = false;
    wasLockZone.current = false;
    slideX.setValue(0);
    lockSlideY.setValue(0);
    waveformAnims.forEach((a) => a.setValue(0.2));
    if (previewPlayerRef.current) {
      try { previewPlayerRef.current.pause(); } catch {}
      try { previewPlayerRef.current.remove(); } catch {}
      previewPlayerRef.current = null;
    }
  };

  // PanResponder wraps ENTIRE component — critical for gesture continuity.
  // When locked/preview, PanResponder yields so TouchableOpacity buttons work.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !disabled && phaseRef.current !== 'locked' && phaseRef.current !== 'preview',
        onMoveShouldSetPanResponder: () =>
          isRecordingRef.current && phaseRef.current === 'recording',
        onPanResponderGrant: () => {
          if (phaseRef.current !== 'idle') return;
          startRecording();
        },
        onPanResponderMove: (_e, gs) => {
          if (!isRecordingRef.current || phaseRef.current !== 'recording') return;
          // Slide left → cancel
          const dx = Math.min(0, gs.dx);
          slideX.setValue(dx);
          const nowInCancel = dx < CANCEL_SLIDE_X;
          if (nowInCancel && !wasCancelZone.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          } else if (!nowInCancel && wasCancelZone.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
          wasCancelZone.current = nowInCancel;
          setInCancelZone(nowInCancel);
          // Slide up → lock
          const dy = Math.min(0, gs.dy);
          lockSlideY.setValue(dy);
          const nowInLock = dy < LOCK_SLIDE_Y;
          if (nowInLock && !wasLockZone.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          } else if (!nowInLock && wasLockZone.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
          wasLockZone.current = nowInLock;
          setInLockZone(nowInLock);
        },
        onPanResponderRelease: (_e, gs) => {
          if (!isRecordingRef.current || phaseRef.current !== 'recording') return;
          // Fast fling left cancels regardless of position
          if (gs.dx < CANCEL_SLIDE_X || gs.vx < FLING_CANCEL_VELOCITY) {
            stopRecording(false);
          } else if (gs.dy < LOCK_SLIDE_Y) {
            setPhase('locked');
            isLockedRef.current = true;
            slideX.setValue(0);
            lockSlideY.setValue(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } else {
            stopRecording(true);
          }
        },
        onPanResponderTerminate: () => {
          if (isRecordingRef.current && phaseRef.current === 'recording') {
            stopRecording(false);
          }
        },
      }),
    [disabled, startRecording, stopRecording, slideX, lockSlideY],
  );

  // ─── Waveform bars (shared across recording + locked states) ───
  const waveformBars = waveformAnims.map((anim, i) => (
    <Animated.View
      key={i}
      style={[
        styles.waveBar,
        { height: Animated.multiply(anim, 24), backgroundColor: CYAN_PRIMARY },
      ]}
    />
  ));

  // Determine root style
  const isActive = phase !== 'idle';

  return (
    <View
      style={isActive ? styles.recordingBar : styles.container}
      {...panResponder.panHandlers}
      collapsable={false}
    >
      {/* ─── IDLE: mic button ─── */}
      {phase === 'idle' && (
        <LinearGradient
          colors={GRADIENT_PURPLE_INDIGO as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.micButton}
        >
          <Ionicons name="mic" size={20} color="#ffffff" />
        </LinearGradient>
      )}

      {/* ─── LOCKED: recording bar with Stop (→ preview) / Trash ─── */}
      {phase === 'locked' && (
        <>
          <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.waveformContainer}>{waveformBars}</View>
          <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          <TouchableOpacity
            style={styles.lockAction}
            onPress={() => stopRecording(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.trashCircle}>
              <Ionicons name="trash-outline" size={20} color={ERROR_RED} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.lockAction}
            onPress={() => stopRecording(false, true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.stopCircle}>
              <Ionicons name="stop" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* ─── PREVIEW: play back before sending ─── */}
      {phase === 'preview' && (
        <>
          <TouchableOpacity
            style={styles.lockAction}
            onPress={togglePreviewPlay}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.playCircle}>
              <Ionicons
                name={isPreviewPlaying ? 'pause' : 'play'}
                size={18}
                color="#ffffff"
              />
            </View>
          </TouchableOpacity>
          <View style={styles.previewWaveform}>
            {waveformData.map((v, i) => (
              <View
                key={i}
                style={[styles.waveBar, { height: v * 24, backgroundColor: CYAN_PRIMARY, opacity: 0.7 }]}
              />
            ))}
          </View>
          <Text style={styles.durationText}>{formatDuration(previewDuration)}</Text>
          <TouchableOpacity
            style={styles.lockAction}
            onPress={discardPreview}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.trashCircle}>
              <Ionicons name="trash-outline" size={20} color={ERROR_RED} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.lockAction}
            onPress={sendPreview}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LinearGradient
              colors={GRADIENT_PURPLE_INDIGO as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendCircle}
            >
              <Ionicons name="send" size={16} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ─── RECORDING: hold gesture active ─── */}
      {phase === 'recording' && (
        <>
          <Animated.View
            style={[
              styles.recordingSlider,
              { transform: [{ translateX: slideX }] },
            ]}
          >
            <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.waveformContainer}>{waveformBars}</View>
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
        </>
      )}
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  stopCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CYAN_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 28,
    gap: 2,
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
