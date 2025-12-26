/**
 * InlineVoiceRecorder - WhatsApp-style Voice Recording
 *
 * Features:
 * - Long press to record, release to send
 * - Slide up to lock recording mode
 * - Slide left to cancel
 * - No layout shift - uses absolute overlay
 * - Uses expo-audio for modern recording API
 *
 * @module components/messaging/InlineVoiceRecorder
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Modal,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VoiceRecordingResult {
  uri: string;
  duration: number;
  mimeType: string;
}

export interface InlineVoiceRecorderRef {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceRecordingResult | null>;
  cancelRecording: () => Promise<void>;
  isRecording: boolean;
}

interface InlineVoiceRecorderProps {
  onRecordingComplete: (result: VoiceRecordingResult) => void;
  onRecordingStart?: () => void;
  onRecordingCancel?: () => void;
  disabled?: boolean;
  size?: number;
  showLabel?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'locked';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Gesture thresholds
const SLIDE_TO_CANCEL_THRESHOLD = -80;
const SLIDE_TO_LOCK_THRESHOLD = -60; // Slide up (negative Y)

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const InlineVoiceRecorder = forwardRef<InlineVoiceRecorderRef, InlineVoiceRecorderProps>(
  (
    {
      onRecordingComplete,
      onRecordingStart,
      onRecordingCancel,
      disabled = false,
      size = 44,
      showLabel = false,
    },
    ref
  ) => {
    const { colors, isDark } = useTheme();
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [slideOffset, setSlideOffset] = useState({ x: 0, y: 0 });
    const [showCancelHint, setShowCancelHint] = useState(false);
    const [showLockHint, setShowLockHint] = useState(false);

    // Animation refs
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const slideXAnim = useRef(new Animated.Value(0)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    // Recording start time for duration tracking
    const startTimeRef = useRef<number>(0);

    // ─── expo-audio recorder hook ────────────────────────────────────────────
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder);

    // ─── Permission Check on Mount ───────────────────────────────────────────
    useEffect(() => {
      const checkPermissions = async () => {
        try {
          const { granted } = await getRecordingPermissionsAsync();
          setHasPermission(granted);
        } catch (error) {
          console.error('[InlineVoiceRecorder] Permission check error:', error);
          setHasPermission(false);
        }
      };
      checkPermissions();
    }, []);

    // ─── Pulse Animation ─────────────────────────────────────────────────────
    useEffect(() => {
      if (recordingState !== 'idle') {
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.3,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        );
        pulse.start();
        return () => pulse.stop();
      } else {
        pulseAnim.setValue(1);
      }
    }, [recordingState, pulseAnim]);

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const formatDuration = useCallback((seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Get duration from recorder state (in milliseconds -> seconds)
    const displayDuration = Math.floor((recorderState?.durationMillis || 0) / 1000);

    // ─── Start Recording ─────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
      // Check/request permissions
      if (!hasPermission) {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          console.warn('[InlineVoiceRecorder] Permission denied');
          return;
        }
        setHasPermission(true);
      }

      try {
        // Configure audio mode for recording
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        // Prepare and start recording
        await recorder.prepareToRecordAsync();
        recorder.record();

        startTimeRef.current = Date.now();
        setRecordingState('recording');

        // Show overlay animation
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();

        // Haptic feedback
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
          Vibration.vibrate(50);
        }

        onRecordingStart?.();
      } catch (error) {
        console.error('[InlineVoiceRecorder] Start recording error:', error);
        setRecordingState('idle');
      }
    }, [hasPermission, recorder, onRecordingStart, overlayOpacity]);

    // ─── Stop Recording ──────────────────────────────────────────────────────
    const stopRecording = useCallback(async (): Promise<VoiceRecordingResult | null> => {
      if (!recorderState?.isRecording) return null;

      try {
        await recorder.stop();

        // Reset audio mode
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        const uri = recorder.uri;
        const durationMs = recorderState?.durationMillis || (Date.now() - startTimeRef.current);

        // Hide overlay
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();

        setRecordingState('idle');
        setSlideOffset({ x: 0, y: 0 });
        slideXAnim.setValue(0);

        if (uri && durationMs > 500) {
          const result: VoiceRecordingResult = {
            uri,
            duration: Math.round(durationMs / 1000),
            mimeType: Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a',
          };
          return result;
        }

        return null;
      } catch (error) {
        console.error('[InlineVoiceRecorder] Stop recording error:', error);
        setRecordingState('idle');
        return null;
      }
    }, [recorder, recorderState, overlayOpacity, slideXAnim]);

    // ─── Cancel Recording ────────────────────────────────────────────────────
    const cancelRecording = useCallback(async () => {
      if (!recorderState?.isRecording && recordingState === 'idle') return;

      try {
        await recorder.stop();

        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        // Haptic feedback for cancel
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          Vibration.vibrate(100);
        }

        // Hide overlay
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();

        setRecordingState('idle');
        setSlideOffset({ x: 0, y: 0 });
        slideXAnim.setValue(0);

        onRecordingCancel?.();
      } catch (error) {
        console.error('[InlineVoiceRecorder] Cancel recording error:', error);
        setRecordingState('idle');
      }
    }, [recorder, recorderState, recordingState, onRecordingCancel, overlayOpacity, slideXAnim]);

    // ─── Expose Methods via Ref ──────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      startRecording,
      stopRecording,
      cancelRecording,
      isRecording: recordingState !== 'idle',
    }));

    // ─── Pan Responder for Gestures ──────────────────────────────────────────
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          // Start recording immediately on touch
          if (recordingState === 'idle' && !disabled) {
            startRecording();
          }
        },

        onPanResponderMove: (_, gestureState) => {
          if (recordingState === 'idle') return;

          const { dx, dy } = gestureState;
          setSlideOffset({ x: dx, y: dy });

          // Animate slide
          slideXAnim.setValue(Math.max(dx, SLIDE_TO_CANCEL_THRESHOLD));

          // Show hints
          setShowCancelHint(dx < SLIDE_TO_CANCEL_THRESHOLD / 2);
          setShowLockHint(dy < SLIDE_TO_LOCK_THRESHOLD / 2);

          // Lock on slide up
          if (dy < SLIDE_TO_LOCK_THRESHOLD && recordingState === 'recording') {
            setRecordingState('locked');
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch {
              Vibration.vibrate(100);
            }
          }
        },

        onPanResponderRelease: async (_, gestureState) => {
          const { dx } = gestureState;

          if (recordingState === 'idle') return;

          // Cancel if slid left enough
          if (dx < SLIDE_TO_CANCEL_THRESHOLD) {
            await cancelRecording();
            return;
          }

          // If locked, don't auto-send on release
          if (recordingState === 'locked') {
            setSlideOffset({ x: 0, y: 0 });
            slideXAnim.setValue(0);
            setShowCancelHint(false);
            setShowLockHint(false);
            return;
          }

          // Send the recording
          const result = await stopRecording();
          if (result) {
            onRecordingComplete(result);
          }
        },

        onPanResponderTerminate: async () => {
          // Cancel if gesture is interrupted
          if (recordingState === 'recording') {
            await cancelRecording();
          }
        },
      })
    ).current;

    // ─── Locked Mode Handlers ────────────────────────────────────────────────
    const handleLockedSend = async () => {
      const result = await stopRecording();
      if (result) {
        onRecordingComplete(result);
      }
    };

    const handleLockedCancel = async () => {
      await cancelRecording();
    };

    const isActive = recordingState !== 'idle';

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
      <View style={styles.container}>
        {/* Mic Button - Always visible in same position */}
        <View {...(recordingState === 'idle' ? panResponder.panHandlers : {})}>
          <Pressable
            style={[
              styles.micButton,
              {
                width: size,
                height: size,
                backgroundColor: disabled
                  ? colors.surfaceVariant
                  : isActive
                    ? colors.error
                    : colors.primary,
              },
            ]}
            disabled={disabled || isActive}
          >
            <Ionicons
              name={isActive ? 'radio' : 'mic'}
              size={size * 0.5}
              color={disabled ? colors.textSecondary : '#fff'}
            />
          </Pressable>
        </View>

        {showLabel && recordingState === 'idle' && (
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Hold to record
          </Text>
        )}

        {/* Recording Overlay Modal */}
        <Modal
          visible={isActive}
          transparent
          animationType="none"
          statusBarTranslucent
        >
          <Animated.View
            style={[
              styles.overlay,
              {
                backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.85)',
                opacity: overlayOpacity,
              },
            ]}
            {...(recordingState === 'recording' ? panResponder.panHandlers : {})}
          >
            <View style={styles.overlayContent}>
              {/* Lock indicator */}
              {recordingState === 'locked' ? (
                <View style={[styles.lockBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="lock-closed" size={20} color="#fff" />
                  <Text style={styles.lockText}>Locked</Text>
                </View>
              ) : (
                <View style={styles.slideHints}>
                  <Animated.View
                    style={[
                      styles.slideHint,
                      {
                        opacity: showLockHint ? 1 : 0.5,
                        transform: [{ translateY: showLockHint ? -5 : 0 }],
                      },
                    ]}
                  >
                    <Ionicons name="lock-closed" size={24} color="#fff" />
                    <Text style={styles.hintText}>Slide up to lock</Text>
                  </Animated.View>
                </View>
              )}

              {/* Recording indicator */}
              <Animated.View
                style={[
                  styles.recordingCircle,
                  {
                    backgroundColor: colors.error,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <Ionicons name="mic" size={48} color="#fff" />
              </Animated.View>

              {/* Duration */}
              <Text style={styles.duration}>{formatDuration(displayDuration)}</Text>

              {/* Cancel hint or slide indicator */}
              {recordingState === 'locked' ? (
                <View style={styles.lockedActions}>
                  <Pressable
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleLockedCancel}
                  >
                    <Ionicons name="trash" size={28} color="#fff" />
                    <Text style={styles.actionText}>Delete</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={handleLockedSend}
                  >
                    <Ionicons name="send" size={28} color="#fff" />
                    <Text style={styles.actionText}>Send</Text>
                  </Pressable>
                </View>
              ) : (
                <Animated.View
                  style={[
                    styles.cancelSlider,
                    {
                      transform: [{ translateX: slideXAnim }],
                      opacity: showCancelHint ? 1 : 0.7,
                    },
                  ]}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={showCancelHint ? colors.error : '#fff'}
                  />
                  <Text
                    style={[
                      styles.cancelText,
                      { color: showCancelHint ? colors.error : '#fff' },
                    ]}
                  >
                    {showCancelHint ? 'Release to cancel' : 'Slide left to cancel'}
                  </Text>
                </Animated.View>
              )}

              {/* Release hint */}
              {recordingState === 'recording' && (
                <Text style={styles.releaseHint}>Release to send</Text>
              )}
            </View>
          </Animated.View>
        </Modal>
      </View>
    );
  }
);

InlineVoiceRecorder.displayName = 'InlineVoiceRecorder';

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  slideHints: {
    marginBottom: 40,
  },
  slideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 40,
  },
  lockText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    marginTop: 24,
    fontVariant: ['tabular-nums'],
  },
  cancelSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    gap: 8,
  },
  cancelText: {
    fontSize: 14,
  },
  releaseHint: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.6,
    marginTop: 16,
  },
  lockedActions: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 40,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
});

export default InlineVoiceRecorder;
