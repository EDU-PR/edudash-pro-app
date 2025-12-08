/**
 * WhatsApp-Style Incoming Call Overlay
 * 
 * A modern incoming call screen inspired by WhatsApp with:
 * - Swipe up to answer
 * - Swipe down to decline  
 * - Smooth animations
 * - Profile photo support
 * - Animated ring effect
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import type { CallType } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

interface WhatsAppStyleIncomingCallProps {
  callerName: string;
  callerPhoto?: string | null;
  callType: CallType;
  onAnswer: () => void;
  onReject: () => void;
  isVisible: boolean;
  isConnecting?: boolean;
}

export function WhatsAppStyleIncomingCall({
  callerName,
  callerPhoto,
  callType,
  onAnswer,
  onReject,
  isVisible,
  isConnecting = false,
}: WhatsAppStyleIncomingCallProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const answerButtonY = useRef(new Animated.Value(0)).current;
  const declineButtonY = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [swipeHint, setSwipeHint] = useState('');

  // Ring pulse animation (WhatsApp style)
  useEffect(() => {
    if (!isVisible) return;

    const createRingAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const ring1 = createRingAnimation(ring1Anim, 0);
    const ring2 = createRingAnimation(ring2Anim, 600);
    const ring3 = createRingAnimation(ring3Anim, 1200);

    ring1.start();
    ring2.start();
    ring3.start();

    return () => {
      ring1.stop();
      ring2.stop();
      ring3.stop();
    };
  }, [isVisible, ring1Anim, ring2Anim, ring3Anim]);

  // Fade in/out animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, fadeAnim]);

  // Answer button swipe indicator animation
  useEffect(() => {
    if (!isVisible || isConnecting) return;

    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(answerButtonY, {
          toValue: -15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(answerButtonY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    bounce.start();
    return () => bounce.stop();
  }, [isVisible, isConnecting, answerButtonY]);

  // Vibration and ringtone
  useEffect(() => {
    if (!isVisible) {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      Vibration.cancel();
      return;
    }

    // WhatsApp-style vibration pattern
    const vibrationPattern = Platform.OS === 'android' 
      ? [0, 400, 200, 400, 1000] 
      : [400, 200, 400];
    Vibration.vibrate(vibrationPattern, true);

    const playRingtone = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        let soundFile;
        try {
          soundFile = require('@/assets/sounds/ringtone.mp3');
        } catch {
          try {
            soundFile = require('@/assets/sounds/notification.wav');
          } catch {
            return;
          }
        }
        
        const { sound } = await Audio.Sound.createAsync(
          soundFile,
          { isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch (error) {
        console.warn('[IncomingCall] Failed to play ringtone:', error);
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

  // Answer button pan responder (swipe up to answer)
  const answerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSwipeHint('Swipe up to answer');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setSwipeHint('');
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          // Answered
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.timing(slideAnim, {
            toValue: -SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onAnswer();
          });
        } else {
          // Reset
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Decline button pan responder (swipe down to decline)
  const declinePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSwipeHint('Swipe down to decline');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          declineButtonY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setSwipeHint('');
        if (gestureState.dy > SWIPE_THRESHOLD) {
          // Declined
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(declineButtonY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onReject();
          });
        } else {
          // Reset
          Animated.spring(declineButtonY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Quick tap handlers
  const handleQuickAnswer = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAnswer();
  }, [onAnswer]);

  const handleQuickDecline = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReject();
  }, [onReject]);

  if (!isVisible) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#075E54', '#128C7E', '#25D366']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Top Section - Call Type */}
        <View style={styles.topSection}>
          <View style={styles.encryptedBadge}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.encryptedText}>End-to-end encrypted</Text>
          </View>
          
          <Text style={styles.callTypeLabel}>
            EduDash {callType === 'video' ? 'Video' : 'Voice'} Call
          </Text>
        </View>

        {/* Middle Section - Caller Info */}
        <View style={styles.middleSection}>
          {/* Animated Rings */}
          <View style={styles.ringsContainer}>
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ring1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 0],
                  }),
                  transform: [
                    {
                      scale: ring1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ring2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 0],
                  }),
                  transform: [
                    {
                      scale: ring2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ring3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 0],
                  }),
                  transform: [
                    {
                      scale: ring3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2],
                      }),
                    },
                  ],
                },
              ]}
            />

            {/* Profile Photo / Avatar */}
            <View style={styles.avatarContainer}>
              {callerPhoto ? (
                <Image source={{ uri: callerPhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{getInitials(callerName)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Caller Name */}
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callerStatus}>
            {isConnecting ? 'Connecting...' : 'Incoming call'}
          </Text>
        </View>

        {/* Swipe Hint */}
        {swipeHint ? (
          <View style={styles.swipeHintContainer}>
            <Text style={styles.swipeHintText}>{swipeHint}</Text>
          </View>
        ) : null}

        {/* Bottom Section - Action Buttons */}
        {!isConnecting && (
          <View style={styles.bottomSection}>
            {/* Decline Button */}
            <Animated.View
              style={[
                styles.buttonWrapper,
                { transform: [{ translateY: declineButtonY }] },
              ]}
              {...declinePanResponder.panHandlers}
            >
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={handleQuickDecline}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>Decline</Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color="rgba(255,255,255,0.5)" 
                style={styles.swipeIcon}
              />
            </Animated.View>

            {/* Answer Button */}
            <Animated.View
              style={[
                styles.buttonWrapper,
                { 
                  transform: [
                    { translateY: Animated.add(slideAnim, answerButtonY) },
                  ] 
                },
              ]}
              {...answerPanResponder.panHandlers}
            >
              <Ionicons 
                name="chevron-up" 
                size={16} 
                color="rgba(255,255,255,0.5)" 
                style={styles.swipeIconUp}
              />
              <TouchableOpacity
                style={[styles.actionButton, styles.answerButton]}
                onPress={handleQuickAnswer}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={callType === 'video' ? 'videocam' : 'call'} 
                  size={30} 
                  color="#fff" 
                />
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>
                {callType === 'video' ? 'Accept' : 'Answer'}
              </Text>
            </Animated.View>
          </View>
        )}

        {/* Connecting Indicator */}
        {isConnecting && (
          <View style={styles.connectingContainer}>
            <View style={styles.connectingDots}>
              <Animated.View style={[styles.dot, { opacity: ring1Anim }]} />
              <Animated.View style={[styles.dot, { opacity: ring2Anim }]} />
              <Animated.View style={[styles.dot, { opacity: ring3Anim }]} />
            </View>
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}
      </LinearGradient>
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
  gradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  encryptedText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginLeft: 6,
  },
  callTypeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  middleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '600',
  },
  callerName: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  callerStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 8,
  },
  swipeHintContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeHintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  answerButton: {
    backgroundColor: '#34C759',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  swipeIcon: {
    marginTop: 4,
  },
  swipeIconUp: {
    marginBottom: 4,
  },
  connectingContainer: {
    alignItems: 'center',
    paddingBottom: 60,
  },
  connectingDots: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
  connectingText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default WhatsAppStyleIncomingCall;
