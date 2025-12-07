/**
 * Voice Call Interface (React Native)
 * 
 * Audio-only call interface using Daily.co React Native SDK.
 * Provides controls for mute, speaker, and end call.
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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import type { CallState } from './types';

// Note: Daily.co React Native SDK is conditionally imported
// This allows the app to build even without the native module
let Daily: any = null;
try {
  Daily = require('@daily-co/react-native-daily-js').default;
} catch (error) {
  console.warn('[VoiceCall] Daily.co SDK not available:', error);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoiceCallInterfaceProps {
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

export function VoiceCallInterface({
  isOpen,
  onClose,
  roomName,
  userName = 'User',
  isOwner = false,
  calleeId,
  callId,
  meetingUrl,
  onCallStateChange,
}: VoiceCallInterfaceProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

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
    if (callState === 'connected' && participantCount > 1) {
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
  }, [callState, participantCount]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Listen for call status changes (other party hung up)
  useEffect(() => {
    if (!callIdRef.current || callState === 'ended') return;

    const currentCallId = callIdRef.current;

    const channel = supabase
      .channel(`voice-status-${currentCallId}`)
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
          console.log('[VoiceCall] Status changed:', newStatus);
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
        console.warn('[VoiceCall] Cleanup error:', err);
      }
      dailyRef.current = null;
    }
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
          console.log('[VoiceCall] Session missing or expired, attempting refresh...');
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

        // Cleanup existing instance
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
                name: `voice-${Date.now()}`,
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
            const newCallId = `${user.id}-${Date.now()}`;
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
              call_type: 'voice',
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
                call_type: 'voice',
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

        // Get meeting token (accessToken was validated above)
        const tokenResponse = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/daily-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              roomName: roomUrl.split('/').pop(),
              userName,
              isOwner,
            }),
          }
        );

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error || 'Failed to get token');
        }

        const { token } = await tokenResponse.json();

        if (isCleanedUp) return;

        // Create Daily call object
        const daily = Daily.createCallObject({
          audioSource: true,
          videoSource: false,
        });

        dailyRef.current = daily;

        // Event listeners
        daily.on('joined-meeting', () => {
          console.log('[VoiceCall] Joined meeting');
          setCallState('connected');
          updateParticipantCount();
        });

        daily.on('left-meeting', () => {
          console.log('[VoiceCall] Left meeting');
          setCallState('ended');
        });

        daily.on('participant-joined', () => {
          console.log('[VoiceCall] Participant joined');
          updateParticipantCount();
        });

        daily.on('participant-left', () => {
          console.log('[VoiceCall] Participant left');
          updateParticipantCount();
        });

        daily.on('error', (event: any) => {
          console.error('[VoiceCall] Error:', event);
          setError(event?.errorMsg || 'Call error');
          setCallState('failed');
        });

        // Join the call
        await daily.join({
          url: roomUrl,
          token,
        });

        function updateParticipantCount() {
          if (dailyRef.current) {
            const participants = dailyRef.current.participants();
            setParticipantCount(Object.keys(participants).length);
          }
        }
      } catch (err) {
        console.error('[VoiceCall] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to start call');
        setCallState('failed');
      }
    };

    initializeCall();

    return () => {
      isCleanedUp = true;
      cleanupCall();
    };
  }, [isOpen, meetingUrl, userName, isOwner, calleeId, cleanupCall]);

  // Toggle microphone
  const toggleAudio = useCallback(async () => {
    if (!dailyRef.current) return;
    try {
      await dailyRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    } catch (err) {
      console.error('[VoiceCall] Toggle audio error:', err);
    }
  }, [isAudioEnabled]);

  // Toggle speaker (limited support on mobile)
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(!isSpeakerEnabled);
    // Note: Speaker toggle requires additional native module support
  }, [isSpeakerEnabled]);

  // End call
  const handleEndCall = useCallback(async () => {
    console.log('[VoiceCall] Ending call');

    // Update call status
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
  }, []);

  // Maximize call
  const handleMaximize = useCallback(() => {
    setIsMinimized(false);
  }, []);

  if (!isOpen) return null;

  // Minimized view
  if (isMinimized) {
    return (
      <TouchableOpacity
        style={styles.minimizedContainer}
        onPress={handleMaximize}
        activeOpacity={0.9}
      >
        <View style={styles.minimizedContent}>
          <Ionicons name="call" size={20} color="#ffffff" />
          <Text style={styles.minimizedText}>{formatDuration(callDuration)}</Text>
          <TouchableOpacity onPress={handleEndCall}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Full view
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={90} style={styles.blurView} tint="dark">
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleMinimize} style={styles.minimizeButton}>
              <Ionicons name="chevron-down" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Voice Call</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Call Info */}
          <View style={styles.callInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#ffffff" />
            </View>
            <Text style={styles.callerName}>{userName}</Text>
            <Text style={styles.callStatus}>
              {callState === 'connecting' && 'Connecting...'}
              {callState === 'ringing' && 'Ringing...'}
              {callState === 'connected' && formatDuration(callDuration)}
              {callState === 'failed' && (error || 'Call failed')}
              {callState === 'ended' && 'Call ended'}
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {/* Mute */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                !isAudioEnabled && styles.controlButtonActive,
              ]}
              onPress={toggleAudio}
            >
              <Ionicons
                name={isAudioEnabled ? 'mic' : 'mic-off'}
                size={28}
                color="#ffffff"
              />
              <Text style={styles.controlLabel}>
                {isAudioEnabled ? 'Mute' : 'Unmute'}
              </Text>
            </TouchableOpacity>

            {/* Speaker */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                isSpeakerEnabled && styles.controlButtonActive,
              ]}
              onPress={toggleSpeaker}
            >
              <Ionicons
                name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'}
                size={28}
                color="#ffffff"
              />
              <Text style={styles.controlLabel}>Speaker</Text>
            </TouchableOpacity>

            {/* End Call */}
            <TouchableOpacity
              style={[styles.controlButton, styles.endCallButton]}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={28} color="#ffffff" />
              <Text style={styles.controlLabel}>End</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  minimizeButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  callInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#00f5ff',
  },
  callerName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  callStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    marginLeft: 8,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.3)',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
  },
  controlLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  minimizedContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 9998,
    borderRadius: 12,
    overflow: 'hidden',
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  minimizedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
});

export default VoiceCallInterface;
