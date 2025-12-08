/**
 * Incoming Call Overlay
 * 
 * Full-screen overlay displayed when receiving an incoming call.
 * Shows caller name, call type, and answer/reject buttons.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { AudioModule } from 'expo-audio';
import type { CallType } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IncomingCallOverlayProps {
  callerName: string;
  callType: CallType;
  onAnswer: () => void;
  onReject: () => void;
  isVisible: boolean;
  isConnecting?: boolean;
}

export function IncomingCallOverlay({
  callerName,
  callType,
  onAnswer,
  onReject,
  isVisible,
  isConnecting = false,
}: IncomingCallOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  // Pulse animation for the avatar
  useEffect(() => {
    if (!isVisible) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [isVisible, pulseAnim]);

  // Fade in/out animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, fadeAnim]);

  // Play ringtone and vibrate
  useEffect(() => {
    if (!isVisible) {
      // Stop ringtone
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      Vibration.cancel();
      return;
    }

    // Start vibration pattern (1s vibrate, 1s pause, repeat)
    const vibrationPattern = Platform.OS === 'android' 
      ? [0, 1000, 1000] 
      : [1000, 1000];
    Vibration.vibrate(vibrationPattern, true);

    // Play ringtone
    const playRingtone = async () => {
      try {
        // Try ringtone first, fallback to notification sound
        let soundFile;
        try {
          soundFile = require('@/assets/sounds/ringtone.mp3');
        } catch {
          soundFile = require('@/assets/sounds/notification.wav');
        }
        
        const { sound } = await Audio.Sound.createAsync(
          soundFile,
          { isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch (error) {
        console.warn('[IncomingCall] Failed to play ringtone:', error);
        // Fallback: Just use vibration
      }
    };

    playRingtone();

    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      Vibration.cancel();
    };
  }, [isVisible]);

  // Handle answer
  const handleAnswer = useCallback(() => {
    // Short vibration feedback
    Vibration.vibrate(100);
    onAnswer();
  }, [onAnswer]);

  // Handle reject
  const handleReject = useCallback(() => {
    // Double short vibration feedback
    Vibration.vibrate([0, 50, 50, 50]);
    onReject();
  }, [onReject]);

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={90} style={styles.blurView} tint="dark">
        <View style={styles.content}>
          {/* Call Type Icon */}
          <View style={styles.callTypeContainer}>
            <Ionicons
              name={callType === 'video' ? 'videocam' : 'call'}
              size={24}
              color="#00f5ff"
            />
            <Text style={styles.callTypeText}>
              Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
            </Text>
          </View>

          {/* Caller Avatar */}
          <Animated.View
            style={[
              styles.avatarContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={60} color="#ffffff" />
            </View>
            <View style={styles.avatarRing} />
            <View style={styles.avatarRingOuter} />
          </Animated.View>

          {/* Caller Name */}
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callerSubtext}>
            {isConnecting ? 'Connecting...' : 'is calling you'}
          </Text>

          {/* Action Buttons */}
          {!isConnecting && (
            <View style={styles.buttonContainer}>
              {/* Reject Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={32} color="#ffffff" />
              </TouchableOpacity>

              {/* Answer Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.answerButton]}
                onPress={handleAnswer}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={callType === 'video' ? 'videocam' : 'call'}
                  size={32}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Button Labels */}
          {!isConnecting && (
            <View style={styles.labelContainer}>
              <Text style={styles.buttonLabel}>Decline</Text>
              <Text style={styles.buttonLabel}>Accept</Text>
            </View>
          )}

          {/* Connecting Indicator */}
          {isConnecting && (
            <View style={styles.connectingContainer}>
              <Ionicons name="sync" size={24} color="#00f5ff" />
              <Text style={styles.connectingText}>Connecting...</Text>
            </View>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 9999,
  },
  blurView: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  callTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  callTypeText: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  avatarContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#00f5ff',
  },
  avatarRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(0, 245, 255, 0.3)',
  },
  avatarRingOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.15)',
  },
  callerName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  callerSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    marginBottom: 60,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 60,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  answerButton: {
    backgroundColor: '#22c55e',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginTop: 16,
    width: 144 + 60,
  },
  buttonLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    width: 72,
    textAlign: 'center',
  },
  connectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
  },
  connectingText: {
    color: '#00f5ff',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default IncomingCallOverlay;
