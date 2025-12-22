/**
 * Voice Call Daily.co Hook
 * 
 * Manages Daily.co SDK integration:
 * - Room creation via Edge Function
 * - Joining/leaving calls
 * - Event handling (joined, left, participant changes, errors)
 * - Call signaling via Supabase
 */

import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { assertSupabase } from '@/lib/supabase';
import { callKeepManager } from '@/lib/calls/callkeep-manager';
import type { CallState } from '../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Lazy Supabase getter
const getSupabase = () => assertSupabase();

// Daily.co SDK - conditionally imported
let Daily: any = null;
try {
  Daily = require('@daily-co/react-native-daily-js').default;
} catch (error) {
  console.warn('[VoiceCallDaily] Daily.co SDK not available:', error);
}

export interface VoiceCallDailyOptions {
  isOpen: boolean;
  meetingUrl?: string;
  userName?: string;
  isOwner: boolean;
  calleeId?: string;
  isSpeakerEnabled: boolean;
  dailyRef: React.MutableRefObject<any>;
  callIdRef: React.MutableRefObject<string | null>;
  setCallState: (state: CallState) => void;
  setError: (error: string | null) => void;
  setParticipantCount: (count: number) => void;
  setIsAudioEnabled: (enabled: boolean) => void;
  setIsSpeakerEnabled: (enabled: boolean) => void;
  setCallDuration: (duration: number) => void;
  stopAudio: () => void;
  onClose: () => void;
}

export interface VoiceCallDailyReturn {
  toggleAudio: () => Promise<void>;
  endCall: () => Promise<void>;
  cleanupCall: () => void;
  isDailyAvailable: boolean;
}

export function useVoiceCallDaily({
  isOpen,
  meetingUrl,
  userName,
  isOwner,
  calleeId,
  isSpeakerEnabled,
  dailyRef,
  callIdRef,
  setCallState,
  setError,
  setParticipantCount,
  setIsAudioEnabled,
  setIsSpeakerEnabled,
  setCallDuration,
  stopAudio,
  onClose,
}: VoiceCallDailyOptions): VoiceCallDailyReturn {
  
  // Cleanup call resources
  const cleanupCall = useCallback(() => {
    console.log('[VoiceCallDaily] Cleaning up call resources');
    
    if (dailyRef.current) {
      try {
        dailyRef.current.leave();
        dailyRef.current.destroy();
        console.log('[VoiceCallDaily] Daily call object cleaned up');
      } catch (err) {
        console.warn('[VoiceCallDaily] Cleanup error:', err);
      }
      dailyRef.current = null;
    }
    
    stopAudio();
  }, [dailyRef, stopAudio]);

  // Listen for call status changes (other party hung up)
  useEffect(() => {
    if (!callIdRef.current) return;

    const currentCallId = callIdRef.current;

    const channel = getSupabase()
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
          console.log('[VoiceCallDaily] Status changed:', newStatus);
          if (['ended', 'rejected', 'missed'].includes(newStatus)) {
            cleanupCall();
            setCallState('ended');
            onClose();
          }
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [callIdRef, cleanupCall, setCallState, onClose]);

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
        setIsSpeakerEnabled(false);
        console.log('[VoiceCallDaily] Initializing call with earpiece default');

        // Get valid session token
        console.log('[VoiceCallDaily] Getting session...');
        let { data: sessionData, error: sessionError } = await getSupabase().auth.getSession();
        let accessToken = sessionData.session?.access_token;
        
        // Refresh for fresh token
        console.log('[VoiceCallDaily] Refreshing session...');
        const { data: refreshData, error: refreshError } = await getSupabase().auth.refreshSession();
        
        if (refreshData?.session?.access_token) {
          accessToken = refreshData.session.access_token;
          sessionData = refreshData;
          console.log('[VoiceCallDaily] Session refreshed successfully');
        } else if (!accessToken) {
          console.warn('[VoiceCallDaily] No valid session:', refreshError || sessionError);
          throw new Error('Please sign in to make calls.');
        }

        const user = sessionData.session?.user;
        if (!user) {
          throw new Error('Please sign in to make calls.');
        }

        if (isCleanedUp) return;

        cleanupCall();

        let roomUrl = meetingUrl;

        if (isOwner && !roomUrl) {
          // Create room via API
          console.log('[VoiceCallDaily] Creating room via Edge Function...');
          
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
            let errorMsg = 'Failed to create room';
            try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
              errorMsg = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
            }
            throw new Error(errorMsg);
          }

          const { room } = await response.json();
          roomUrl = room.url;
          console.log('[VoiceCallDaily] Room created:', roomUrl);

          // Create call signaling record
          if (calleeId) {
            const newCallId = uuidv4();
            callIdRef.current = newCallId;

            const { data: callerProfile } = await getSupabase()
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single();

            const callerName = callerProfile
              ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() || 'Someone'
              : 'Someone';

            const { error: callError } = await getSupabase().from('active_calls').insert({
              call_id: newCallId,
              caller_id: user.id,
              callee_id: calleeId,
              call_type: 'voice',
              status: 'ringing',
              caller_name: callerName,
              meeting_url: roomUrl,
            });

            if (callError) {
              console.error('[VoiceCallDaily] Failed to insert active_call:', callError);
              throw callError;
            }

            // Register with CallKeep
            await callKeepManager.startCall(newCallId, userName || 'Unknown', false).catch((err) => {
              console.warn('[VoiceCallDaily] Failed to start CallKeep call:', err);
            });

            // Send signal
            await getSupabase().from('call_signals').insert({
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

        // Create Daily call object
        console.log('[VoiceCallDaily] Creating Daily call object...');
        const daily = Daily.createCallObject({
          audioSource: true,
          videoSource: false,
        });

        dailyRef.current = daily;

        const updateParticipantCount = () => {
          if (dailyRef.current) {
            const participants = dailyRef.current.participants();
            setParticipantCount(Object.keys(participants).length);
          }
        };

        // Event listeners
        daily.on('joined-meeting', async () => {
          console.log('[VoiceCallDaily] Joined meeting');
          
          // CRITICAL: Ensure we subscribe to all tracks automatically
          try {
            await daily.setSubscribeToTracksAutomatically(true);
            console.log('[VoiceCallDaily] Set auto-subscribe to tracks');
          } catch (err) {
            console.warn('[VoiceCallDaily] Failed to set auto-subscribe:', err);
          }
          
          // CRITICAL: Explicitly enable receiving audio from all participants
          try {
            await daily.updateReceiveSettings({ '*': { audio: true, video: false } });
            console.log('[VoiceCallDaily] Updated receive settings for audio');
          } catch (err) {
            console.warn('[VoiceCallDaily] Failed to update receive settings:', err);
          }
          
          // Enable local audio using React Native compatible method
          try {
            await daily.setLocalAudio(true);
            setIsAudioEnabled(true);
            console.log('[VoiceCallDaily] Local audio enabled on join');
          } catch (micError) {
            console.warn('[VoiceCallDaily] Failed to enable microphone on join:', micError);
          }
          
          if (!isOwner || !calleeId) {
            setCallState('connected');
          }
          updateParticipantCount();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        });

        daily.on('left-meeting', () => {
          console.log('[VoiceCallDaily] Left meeting');
          setCallState('ended');
          stopAudio();
        });

        daily.on('participant-joined', (event: any) => {
          const participant = event?.participant;
          const isLocalParticipant = participant?.local === true;
          console.log('[VoiceCallDaily] Participant joined:', { isLocal: isLocalParticipant });

          updateParticipantCount();

          if (isLocalParticipant) return;

          console.log('[VoiceCallDaily] Remote participant joined - connected');
          setCallState('connected');

          if (callIdRef.current) {
            callKeepManager.reportConnected(callIdRef.current).catch(() => {});
          }

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        });

        daily.on('participant-left', () => {
          console.log('[VoiceCallDaily] Participant left');
          updateParticipantCount();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        });

        daily.on('error', (event: any) => {
          const errorMsg = event?.errorMsg || event?.error || 'Unknown error';
          
          let userFriendlyError = errorMsg;
          if (errorMsg.includes('network') || errorMsg.includes('connection')) {
            userFriendlyError = 'Connection failed. Please check your internet connection.';
          } else if (errorMsg.includes('permission') || errorMsg.includes('microphone')) {
            userFriendlyError = 'Microphone permission denied. Please enable it in settings.';
          } else if (errorMsg.includes('timeout')) {
            userFriendlyError = 'Connection timeout. Please try again.';
          } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
            userFriendlyError = 'Call room not found. The call may have ended.';
          }
          
          setError(userFriendlyError);
          setCallState('failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        });

        // Track remote audio - critical for hearing the other party
        daily.on('track-started', async (event: any) => {
          const { participant, track } = event || {};
          
          console.log('[VoiceCallDaily] Track started:', {
            kind: track?.kind,
            isLocal: participant?.local,
            participantId: participant?.user_id,
          });
          
          // Only care about remote audio tracks
          if (participant?.local || track?.kind !== 'audio') {
            return;
          }
          
          console.log('[VoiceCallDaily] Remote audio track started - ensuring playback');
          
          // Immediately try to update receive settings to ensure audio is received
          try {
            if (dailyRef.current) {
              await dailyRef.current.updateReceiveSettings({
                [participant.session_id]: { audio: true },
                '*': { audio: true, video: false },
              });
              console.log('[VoiceCallDaily] Updated receive settings for participant:', participant.session_id);
            }
          } catch (err) {
            console.warn('[VoiceCallDaily] Failed to update receive settings:', err);
          }
          
          // Verify all remote participants have playable audio after a short delay
          setTimeout(() => {
            if (!dailyRef.current) return;
            
            const participants = dailyRef.current.participants();
            const remoteParticipants = Object.values(participants || {}).filter(
              (p: any) => !p.local
            );
            
            remoteParticipants.forEach(async (p: any) => {
              const audioState = p.tracks?.audio?.state;
              const audioBlocked = p.tracks?.audio?.blocked;
              const audioOff = p.tracks?.audio?.off;
              
              console.log('[VoiceCallDaily] Remote participant audio state:', {
                participantId: p.user_id,
                sessionId: p.session_id,
                audioState,
                audioBlocked,
                audioOff,
                isSpeakerEnabled,
              });
              
              // If audio is blocked or not playable, try to unblock
              if (audioBlocked || (audioState && audioState !== 'playable' && audioState !== 'sendable')) {
                console.warn('[VoiceCallDaily] Remote audio not playable - attempting to unblock');
                try {
                  await dailyRef.current.updateReceiveSettings({
                    [p.session_id]: { audio: true },
                  });
                  console.log('[VoiceCallDaily] Unblocked audio for:', p.session_id);
                } catch (err) {
                  console.warn('[VoiceCallDaily] Failed to unblock audio:', err);
                }
              }
            });
          }, 300);
        });

        // Android permissions
        if (Platform.OS === 'android') {
          try {
            const { PermissionsAndroid } = require('react-native');
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Microphone Permission',
                message: 'This app needs access to your microphone for voice calls.',
                buttonPositive: 'OK',
              }
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              throw new Error('Microphone permission denied');
            }
          } catch (permError) {
            throw new Error('Microphone permission denied. Please enable it in settings.');
          }
        }

        // Join the call
        console.log('[VoiceCallDaily] Joining room:', roomUrl);
        await daily.join({ url: roomUrl });

        // Enable microphone after joining using setLocalAudio (React Native compatible)
        try {
          // First ensure input devices are set up
          await daily.setInputDevicesAsync({ audioSource: true });
          // Then enable local audio - this is the React Native compatible method
          await daily.setLocalAudio(true);
          setIsAudioEnabled(true);
          console.log('[VoiceCallDaily] Microphone enabled successfully');
        } catch (micError) {
          console.warn('[VoiceCallDaily] Failed to enable microphone:', micError);
          // Try alternative method
          try {
            await daily.setLocalAudio(true);
            setIsAudioEnabled(true);
            console.log('[VoiceCallDaily] Microphone enabled via fallback');
          } catch (fallbackError) {
            console.warn('[VoiceCallDaily] Fallback mic enable also failed:', fallbackError);
          }
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to start call';
        
        let userFriendlyError = errorMsg;
        if (errorMsg.includes('network') || errorMsg.includes('failed to fetch')) {
          userFriendlyError = 'No internet connection. Please check your network and try again.';
        } else if (errorMsg.includes('timeout')) {
          userFriendlyError = 'Connection timeout. The other person may be offline.';
        } else if (errorMsg.includes('No room URL')) {
          userFriendlyError = 'Failed to create call room. Please try again.';
        }
        
        setError(userFriendlyError);
        setCallState('failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    };

    initializeCall();

    return () => {
      isCleanedUp = true;
      cleanupCall();
    };
  }, [isOpen, meetingUrl, userName, isOwner, calleeId]);

  // Toggle microphone - use setLocalAudio for reliable mute/unmute
  const toggleAudio = useCallback(async () => {
    if (!dailyRef.current) return;
    
    try {
      // Get current mute state from localAudio()
      const currentlyEnabled = dailyRef.current.localAudio();
      const newState = !currentlyEnabled;
      
      // Use setLocalAudio instead of updateSendSettings for better reliability
      await dailyRef.current.setLocalAudio(newState);
      setIsAudioEnabled(newState);
      console.log('[VoiceCallDaily] Audio toggled:', { was: currentlyEnabled, now: newState });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (err) {
      console.warn('[VoiceCallDaily] Toggle audio error:', err);
    }
  }, [dailyRef, setIsAudioEnabled]);

  // End call
  const endCall = useCallback(async () => {
    console.log('[VoiceCallDaily] Ending call');

    if (callIdRef.current) {
      await getSupabase()
        .from('active_calls')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('call_id', callIdRef.current);
    }

    cleanupCall();
    setCallState('ended');
    onClose();
  }, [callIdRef, cleanupCall, setCallState, onClose]);

  return {
    toggleAudio,
    endCall,
    cleanupCall,
    isDailyAvailable: !!Daily,
  };
}
