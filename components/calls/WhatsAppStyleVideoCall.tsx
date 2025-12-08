/**
 * WhatsApp-Style Video Call Interface
 * 
 * A modern video call UI inspired by WhatsApp with:
 * - Floating local video preview (draggable)
 * - Minimizable call view
 * - Speaker/Bluetooth toggle
 * - Better control layout
 * - Smooth animations
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
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import type { CallState, DailyParticipant } from './types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Note: Daily.co React Native SDK is conditionally imported
let Daily: any = null;
let DailyMediaView: any = null;
try {
  const dailyModule = require('@daily-co/react-native-daily-js');
  Daily = dailyModule.default;
  DailyMediaView = dailyModule.DailyMediaView;
} catch (error) {
  console.warn('[VideoCall] Daily.co SDK not available:', error);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOCAL_VIDEO_WIDTH = 120;
const LOCAL_VIDEO_HEIGHT = 160;
const MINIMIZED_SIZE = 100;

interface WhatsAppStyleVideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  userName?: string;
  userPhoto?: string | null;
  remoteUserName?: string;
  remoteUserPhoto?: string | null;
  isOwner?: boolean;
  calleeId?: string;
  callId?: string;
  meetingUrl?: string;
  onCallStateChange?: (state: CallState) => void;
  onMinimize?: () => void;
}

export function WhatsAppStyleVideoCall({
  isOpen,
  onClose,
  roomName,
  userName = 'You',
  userPhoto,
  remoteUserName = 'Participant',
  remoteUserPhoto,
  isOwner = false,
  calleeId,
  callId,
  meetingUrl,
  onCallStateChange,
  onMinimize,
}: WhatsAppStyleVideoCallProps) {
  const insets = useSafeAreaInsets();
  
  const [callState, setCallState] = useState<CallState>('idle');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<DailyParticipant[]>([]);

  const dailyRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(callId || null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const controlsAnim = useRef(new Animated.Value(1)).current;
  
  // Ring timeout duration (30 seconds like WhatsApp)
  const RING_TIMEOUT_MS = 30000;
  const minimizedPosition = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - MINIMIZED_SIZE - 20, y: 100 })).current;
  const localVideoPosition = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - LOCAL_VIDEO_WIDTH - 16, y: insets.top + 16 })).current;

  // Local video draggable
  const localVideoPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        localVideoPosition.setOffset({
          x: (localVideoPosition.x as any)._value,
          y: (localVideoPosition.y as any)._value,
        });
        localVideoPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: localVideoPosition.x, dy: localVideoPosition.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        localVideoPosition.flattenOffset();
        // Snap to edges
        const currentX = (localVideoPosition.x as any)._value;
        const snapX = currentX < SCREEN_WIDTH / 2 ? 16 : SCREEN_WIDTH - LOCAL_VIDEO_WIDTH - 16;
        Animated.spring(localVideoPosition.x, {
          toValue: snapX,
          useNativeDriver: false,
          tension: 100,
          friction: 10,
        }).start();
      },
    })
  ).current;

  // Update callIdRef when prop changes
  useEffect(() => {
    if (callId && !callIdRef.current) {
      callIdRef.current = callId;
    }
  }, [callId]);

  // Notify parent of state changes
  useEffect(() => {
    onCallStateChange?.(callState);
  }, [callState, onCallStateChange]);

  // Fade animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, fadeAnim]);

  // Auto-hide controls
  useEffect(() => {
    if (callState === 'connected' && showControls) {
      controlsTimerRef.current = setTimeout(() => {
        Animated.timing(controlsAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);
    }

    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [callState, showControls, controlsAnim]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState]);

  // Ringing timeout - end call if not answered within 30 seconds
  useEffect(() => {
    if (callState === 'connected' && ringingTimeoutRef.current) {
      console.log('[VideoCall] Call connected, clearing ring timeout');
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
  }, [callState]);

  // Format duration as MM:SS or HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Listen for call status changes
  useEffect(() => {
    if (!callIdRef.current || callState === 'ended') return;

    const currentCallId = callIdRef.current;

    const channel = supabase
      .channel(`video-status-${currentCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
          filter: `call_id=eq.${currentCallId}`,
        },
        (payload: { new: { status: string } }) => {
          const newStatus = payload.new?.status;
          if (['ended', 'rejected', 'missed'].includes(newStatus)) {
            cleanupCall();
            setCallState('ended');
            onClose();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState, onClose]);

  // Cleanup call resources
  const cleanupCall = useCallback(() => {
    if (dailyRef.current) {
      try {
        dailyRef.current.leave();
        dailyRef.current.destroy();
      } catch (err) {
        console.warn('[VideoCall] Cleanup error:', err);
      }
      dailyRef.current = null;
    }
  }, []);

  // Ringing timeout - end call if not answered within 30 seconds
  useEffect(() => {
    if (callState === 'ringing' && isOwner) {
      console.log('[VideoCall] Starting ring timeout:', RING_TIMEOUT_MS, 'ms');
      
      ringingTimeoutRef.current = setTimeout(async () => {
        console.log('[VideoCall] Ring timeout - no answer, marking as missed');
        
        // Update call status to missed
        if (callIdRef.current) {
          await supabase
            .from('active_calls')
            .update({ status: 'missed' })
            .eq('call_id', callIdRef.current);
        }
        
        setError('No answer');
        setCallState('ended');
        
        // Haptic feedback for missed call
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Close the call UI after a brief delay
        setTimeout(() => {
          cleanupCall();
          onClose();
        }, 2000);
      }, RING_TIMEOUT_MS);
    }

    return () => {
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
    };
  }, [callState, isOwner, cleanupCall, onClose]);

  // Update participants state
  const updateParticipants = useCallback(() => {
    if (!dailyRef.current) return;

    const participants = dailyRef.current.participants();
    const local = participants.local;
    const remote = Object.values(participants).filter(
      (p: any) => !p.local
    ) as DailyParticipant[];

    setLocalParticipant(local);
    setRemoteParticipants(remote);
  }, []);

  // Initialize call
  useEffect(() => {
    if (!isOpen) return;
    if (!Daily) {
      setError('Video calls require a development build. Please rebuild the app.');
      setCallState('failed');
      return;
    }

    let isCleanedUp = false;

    const initializeCall = async () => {
      try {
        setCallState('connecting');
        setError(null);
        setCallDuration(0);

        // Get valid session token first
        let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let accessToken = sessionData.session?.access_token;
        
        if (!accessToken || sessionError) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session?.access_token) {
            throw new Error('Not authenticated. Please sign in again.');
          }
          accessToken = refreshData.session.access_token;
          sessionData = refreshData;
        }

        const user = sessionData.session?.user;
        if (!user) {
          throw new Error('Not authenticated');
        }

        if (isCleanedUp) return;

        cleanupCall();

        let roomUrl = meetingUrl;

        if (isOwner && !roomUrl) {
          // Create a new room via API
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/daily-rooms`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                name: `video-${Date.now()}`,
                isPrivate: true,
                expiryMinutes: 60,
                maxParticipants: 2,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create room');
          }

          const { room } = await response.json();
          roomUrl = room.url;

          // Create call signaling record
          if (calleeId) {
            const newCallId = uuidv4();
            callIdRef.current = newCallId;

            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single();

            const callerName = callerProfile
              ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() || 'Someone'
              : 'Someone';

            await supabase.from('active_calls').insert({
              call_id: newCallId,
              caller_id: user.id,
              callee_id: calleeId,
              call_type: 'video',
              status: 'ringing',
              caller_name: callerName,
              meeting_url: roomUrl,
            });

            await supabase.from('call_signals').insert({
              call_id: newCallId,
              from_user_id: user.id,
              to_user_id: calleeId,
              signal_type: 'offer',
              payload: {
                meeting_url: roomUrl,
                call_type: 'video',
                caller_name: callerName,
              },
            });

            setCallState('ringing');
          }
        }

        if (!roomUrl) {
          throw new Error('No room URL available');
        }

        if (isCleanedUp) return;

        // Create Daily call object
        const daily = Daily.createCallObject({
          audioSource: true,
          videoSource: true,
        });

        dailyRef.current = daily;

        // Event listeners
        daily.on('joined-meeting', () => {
          console.log('[VideoCall] Joined meeting');
          // Don't set to connected yet if we're the caller waiting for the callee
          if (!isOwner || !calleeId) {
            // If answering a call or no callee, we're connected immediately
            setCallState('connected');
          } else {
            // Caller stays in ringing until callee joins
            console.log('[VideoCall] Waiting for callee to join...');
          }
          updateParticipants();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });

        daily.on('left-meeting', () => {
          setCallState('ended');
        });

        daily.on('participant-joined', () => {
          console.log('[VideoCall] Participant joined');
          updateParticipants();
          
          // When callee joins, switch from ringing to connected
          if (isOwner && calleeId) {
            console.log('[VideoCall] Callee joined! Switching to connected state');
            setCallState('connected');
          }
          
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        });

        daily.on('participant-left', () => {
          updateParticipants();
        });

        daily.on('participant-updated', () => {
          updateParticipants();
        });

        daily.on('error', (event: any) => {
          console.error('[VideoCall] Error:', event);
          setError(event?.errorMsg || 'Call error');
          setCallState('failed');
        });

        await daily.join({ url: roomUrl });
      } catch (err) {
        console.error('[VideoCall] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to start call');
        setCallState('failed');
      }
    };

    initializeCall();

    return () => {
      isCleanedUp = true;
      cleanupCall();
    };
  }, [isOpen, meetingUrl, userName, isOwner, calleeId, cleanupCall, updateParticipants]);

  // Show controls on tap
  const handleScreenTap = useCallback(() => {
    if (!showControls) {
      setShowControls(true);
      Animated.timing(controlsAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showControls, controlsAnim]);

  // Toggle microphone
  const toggleAudio = useCallback(async () => {
    if (!dailyRef.current) return;
    try {
      await dailyRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[VideoCall] Toggle audio error:', err);
    }
  }, [isAudioEnabled]);

  // Toggle camera
  const toggleVideo = useCallback(async () => {
    if (!dailyRef.current) return;
    try {
      await dailyRef.current.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[VideoCall] Toggle video error:', err);
    }
  }, [isVideoEnabled]);

  // Flip camera
  const flipCamera = useCallback(async () => {
    if (!dailyRef.current) return;
    try {
      await dailyRef.current.cycleCamera();
      setIsFrontCamera(!isFrontCamera);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('[VideoCall] Flip camera error:', err);
    }
  }, [isFrontCamera]);

  // Toggle speaker
  const toggleSpeaker = useCallback(async () => {
    // Note: This would require native module integration
    setIsSpeakerOn(!isSpeakerOn);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isSpeakerOn]);

  // End call
  const handleEndCall = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    if (callIdRef.current) {
      await supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('call_id', callIdRef.current);
    }

    cleanupCall();
    setCallState('ended');
    onClose();
  }, [cleanupCall, onClose]);

  // Minimize call
  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
    onMinimize?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onMinimize]);

  if (!isOpen) return null;

  const mainParticipant = remoteParticipants[0] || localParticipant;
  const hasRemoteVideo = remoteParticipants[0]?.tracks?.video?.state === 'playable';
  const hasLocalVideo = localParticipant?.tracks?.video?.state === 'playable' && isVideoEnabled;

  // Minimized view (Picture-in-Picture)
  if (isMinimized) {
    return (
      <Animated.View
        style={[
          styles.minimizedContainer,
          {
            transform: minimizedPosition.getTranslateTransform(),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setIsMinimized(false)}
          style={styles.minimizedContent}
        >
          {hasRemoteVideo && DailyMediaView ? (
            <DailyMediaView
              videoTrack={remoteParticipants[0]}
              audioTrack={null}
              style={styles.minimizedVideo}
              objectFit="cover"
            />
          ) : (
            <View style={styles.minimizedPlaceholder}>
              <Ionicons name="videocam" size={24} color="#fff" />
            </View>
          )}
          <View style={styles.minimizedOverlay}>
            <Text style={styles.minimizedDuration}>{formatDuration(callDuration)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.minimizedEndButton}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={16} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleScreenTap}
        style={styles.mainVideoContainer}
      >
        {/* Main Video View */}
        {hasRemoteVideo && DailyMediaView ? (
          <DailyMediaView
            videoTrack={remoteParticipants[0]}
            audioTrack={remoteParticipants[0]}
            style={styles.mainVideo}
            objectFit="cover"
          />
        ) : hasLocalVideo && DailyMediaView ? (
          <DailyMediaView
            videoTrack={localParticipant}
            audioTrack={null}
            style={styles.mainVideo}
            objectFit="cover"
            mirror={isFrontCamera}
          />
        ) : (
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.noVideoContainer}
          >
            {remoteUserPhoto ? (
              <Image source={{ uri: remoteUserPhoto }} style={styles.noVideoAvatar} />
            ) : (
              <View style={styles.noVideoAvatarPlaceholder}>
                <Ionicons name="person" size={80} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <Text style={styles.noVideoName}>{remoteUserName}</Text>
            <Text style={styles.noVideoStatus}>
              {callState === 'connecting' ? 'Connecting...' : 
               callState === 'ringing' ? 'Ringing...' :
               remoteParticipants.length === 0 ? 'Waiting for participant...' : 'Camera off'}
            </Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {/* Local Video Preview (Draggable) */}
      {hasLocalVideo && DailyMediaView && remoteParticipants.length > 0 && (
        <Animated.View
          style={[
            styles.localVideoContainer,
            { transform: localVideoPosition.getTranslateTransform() },
          ]}
          {...localVideoPanResponder.panHandlers}
        >
          <DailyMediaView
            videoTrack={localParticipant}
            audioTrack={null}
            style={styles.localVideo}
            objectFit="cover"
            mirror={isFrontCamera}
          />
        </Animated.View>
      )}

      {/* Top Bar */}
      <Animated.View style={[styles.topBar, { opacity: controlsAnim, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topButton} onPress={handleMinimize}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.callInfo}>
          <Text style={styles.callerName}>{remoteUserName}</Text>
          <Text style={styles.callDuration}>
            {callState === 'connected' ? formatDuration(callDuration) :
             callState === 'ringing' ? 'Ringing...' :
             callState === 'connecting' ? 'Connecting...' : ''}
          </Text>
        </View>

        <TouchableOpacity style={styles.topButton} onPress={flipCamera}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { top: insets.top + 60 }]}>
          <Ionicons name="alert-circle" size={18} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Bottom Controls */}
      <Animated.View style={[styles.bottomControls, { opacity: controlsAnim, paddingBottom: insets.bottom + 16 }]}>
        {/* Secondary Controls Row */}
        <View style={styles.secondaryControls}>
          <TouchableOpacity style={styles.secondaryButton} onPress={toggleSpeaker}>
            <Ionicons 
              name={isSpeakerOn ? 'volume-high' : 'volume-mute'} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.secondaryLabel}>Speaker</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
            <Text style={styles.secondaryLabel}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Main Controls Row */}
        <View style={styles.mainControls}>
          <TouchableOpacity
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
            onPress={toggleVideo}
          >
            <Ionicons
              name={isVideoEnabled ? 'videocam' : 'videocam-off'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
            onPress={toggleAudio}
          >
            <Ionicons
              name={isAudioEnabled ? 'mic' : 'mic-off'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
          >
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </Animated.View>
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
    backgroundColor: '#000',
    zIndex: 9999,
  },
  mainVideoContainer: {
    flex: 1,
  },
  mainVideo: {
    flex: 1,
  },
  noVideoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  noVideoAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noVideoName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  noVideoStatus: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  localVideoContainer: {
    position: 'absolute',
    width: LOCAL_VIDEO_WIDTH,
    height: LOCAL_VIDEO_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  localVideo: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callInfo: {
    alignItems: 'center',
  },
  callerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  callDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  errorContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginBottom: 24,
  },
  secondaryButton: {
    alignItems: 'center',
  },
  secondaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
  },
  minimizedContainer: {
    position: 'absolute',
    width: MINIMIZED_SIZE,
    height: MINIMIZED_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  minimizedContent: {
    flex: 1,
  },
  minimizedVideo: {
    flex: 1,
  },
  minimizedPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  minimizedDuration: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  minimizedEndButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default WhatsAppStyleVideoCall;
