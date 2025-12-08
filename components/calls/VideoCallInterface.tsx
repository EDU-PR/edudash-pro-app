/**
 * Video Call Interface (React Native)
 * 
 * Full video call interface using Daily.co React Native SDK.
 * Includes camera preview, controls, and participant video display.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

interface VideoCallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  userName?: string;
  isOwner?: boolean;
  calleeId?: string;
  callId?: string;
  meetingUrl?: string;
  onCallStateChange?: (state: CallState) => void;
}

export function VideoCallInterface({
  isOpen,
  onClose,
  roomName,
  userName = 'User',
  isOwner = false,
  calleeId,
  callId,
  meetingUrl,
  onCallStateChange,
}: VideoCallInterfaceProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<DailyParticipant[]>([]);

  const dailyRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(callId || null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected' && remoteParticipants.length > 0) {
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
  }, [callState, remoteParticipants.length]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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

        // Get valid session token first - refresh if needed
        let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let accessToken = sessionData.session?.access_token;
        
        // If no session or token looks expired, try to refresh
        if (!accessToken || sessionError) {
          console.log('[VideoCall] Session missing or expired, attempting refresh...');
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
            const newCallId = uuidv4(); // Generate proper UUID
            callIdRef.current = newCallId;

            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single();

            const callerName = callerProfile
              ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() ||
                'Someone'
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

        // Create Daily call object with video (no token needed for non-private rooms)
        console.log('[VideoCall] Creating Daily call object...');
        const daily = Daily.createCallObject({
          audioSource: true,
          videoSource: true,
        });

        dailyRef.current = daily;

        // Event listeners
        daily.on('joined-meeting', () => {
          console.log('[VideoCall] Joined meeting');
          setCallState('connected');
          updateParticipants();
        });

        daily.on('left-meeting', () => {
          console.log('[VideoCall] Left meeting');
          setCallState('ended');
        });

        daily.on('participant-joined', () => {
          console.log('[VideoCall] Participant joined');
          updateParticipants();
        });

        daily.on('participant-left', () => {
          console.log('[VideoCall] Participant left');
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

        // Join the call (no token needed for rooms created with enable_knocking: false)
        console.log('[VideoCall] Joining room:', roomUrl);
        await daily.join({
          url: roomUrl,
        });
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

  // Toggle microphone
  const toggleAudio = useCallback(async () => {
    if (!dailyRef.current) return;
    try {
      await dailyRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
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
    } catch (err) {
      console.error('[VideoCall] Flip camera error:', err);
    }
  }, [isFrontCamera]);

  // End call
  const handleEndCall = useCallback(async () => {
    console.log('[VideoCall] Ending call');

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

  if (!isOpen) return null;

  const mainParticipant = remoteParticipants[0] || localParticipant;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Main Video View */}
      <View style={styles.mainVideoContainer}>
        {mainParticipant && DailyMediaView ? (
          <DailyMediaView
            videoTrack={mainParticipant.tracks?.video?.state === 'playable' ? mainParticipant : null}
            audioTrack={null}
            style={styles.mainVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.noVideoPlaceholder}>
            <Ionicons name="person" size={80} color="rgba(255,255,255,0.3)" />
            <Text style={styles.noVideoText}>
              {callState === 'connecting' ? 'Connecting...' : 'No video'}
            </Text>
          </View>
        )}
      </View>

      {/* Local Video Preview (Picture-in-Picture) */}
      {localParticipant && isVideoEnabled && DailyMediaView && (
        <View style={styles.localVideoContainer}>
          <DailyMediaView
            videoTrack={localParticipant}
            audioTrack={null}
            style={styles.localVideo}
            objectFit="cover"
            mirror={isFrontCamera}
          />
        </View>
      )}

      {/* Call Info Overlay */}
      <View style={styles.topOverlay}>
        <View style={styles.callInfo}>
          <Text style={styles.callerName}>{userName}</Text>
          <Text style={styles.callDuration}>
            {callState === 'connected'
              ? formatDuration(callDuration)
              : callState === 'ringing'
              ? 'Ringing...'
              : callState === 'connecting'
              ? 'Connecting...'
              : 'Call ended'}
          </Text>
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controls}>
          {/* Flip Camera */}
          <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Toggle Video */}
          <TouchableOpacity
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
            onPress={toggleVideo}
          >
            <Ionicons
              name={isVideoEnabled ? 'videocam' : 'videocam-off'}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* Toggle Audio */}
          <TouchableOpacity
            style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
            onPress={toggleAudio}
          >
            <Ionicons
              name={isAudioEnabled ? 'mic' : 'mic-off'}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* End Call */}
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
          >
            <Ionicons name="call" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: '#0a0a0f',
    zIndex: 9999,
  },
  mainVideoContainer: {
    flex: 1,
  },
  mainVideo: {
    flex: 1,
  },
  noVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  noVideoText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    marginTop: 16,
  },
  localVideoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#00f5ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  localVideo: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'linear-gradient(rgba(0,0,0,0.6), transparent)',
  },
  callInfo: {
    alignItems: 'flex-start',
  },
  callerName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  callDuration: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  errorContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 120,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});

export default VideoCallInterface;
