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
import { Platform, PermissionsAndroid } from 'react-native';
import * as Haptics from 'expo-haptics';
import { assertSupabase } from '@/lib/supabase';
import { callKeepManager } from '@/lib/calls/callkeep-manager';
import type { CallState } from '../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Lazy Supabase getter
const getSupabase = () => assertSupabase();

// Daily.co SDK - conditionally imported (worked before expo-audio changes)
let Daily: any = null;
try {
  Daily = require('@daily-co/react-native-daily-js').default;
  console.log('[VoiceCallDaily] Daily SDK loaded directly');
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

        // OPTIMIZATION: Get session and only refresh if needed
        console.log('[VoiceCallDaily] Getting session...');
        let { data: sessionData, error: sessionError } = await getSupabase().auth.getSession();
        let accessToken = sessionData.session?.access_token;
        
        // Only refresh if token is missing or invalid
        if (!accessToken || sessionError) {
          console.log('[VoiceCallDaily] Refreshing session (no valid token)...');
          const { data: refreshData, error: refreshError } = await getSupabase().auth.refreshSession();
          
          if (refreshData?.session?.access_token) {
            accessToken = refreshData.session.access_token;
            sessionData = refreshData;
            console.log('[VoiceCallDaily] Session refreshed successfully');
          } else {
            console.warn('[VoiceCallDaily] No valid session:', refreshError || sessionError);
            throw new Error('Please sign in to make calls.');
          }
        } else {
          console.log('[VoiceCallDaily] Using existing session token (skip refresh)');
        }

        const user = sessionData.session?.user;
        if (!user) {
          throw new Error('Please sign in to make calls.');
        }

        if (isCleanedUp) return;

        cleanupCall();

        let roomUrl = meetingUrl;

        if (isOwner && !roomUrl) {
          // OPTIMIZATION: Parallelize room creation and profile fetch
          console.log('[VoiceCallDaily] Creating room and fetching profile...');
          
          const [roomResponse, profileData] = await Promise.all([
            fetch(
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
            ),
            calleeId ? getSupabase()
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single() : Promise.resolve({ data: null, error: null })
          ]);

          if (!roomResponse.ok) {
            let errorMsg = 'Failed to create room';
            try {
              const errorData = await roomResponse.json();
              errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
              errorMsg = `HTTP ${roomResponse.status}: ${roomResponse.statusText || 'Unknown error'}`;
            }
            throw new Error(errorMsg);
          }

          const { room } = await roomResponse.json();
          roomUrl = room.url;
          console.log('[VoiceCallDaily] Room created:', roomUrl);

          // Create call signaling record
          if (calleeId) {
            const newCallId = uuidv4();
            callIdRef.current = newCallId;

            const callerName = profileData.data
              ? `${profileData.data.first_name || ''} ${profileData.data.last_name || ''}`.trim() || 'Someone'
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

            // CRITICAL: Send push notification to wake callee's app when backgrounded
            // This is non-blocking to not delay call setup
            fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-expo-push`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                user_ids: [calleeId],
                title: '📞 Incoming Call',
                body: `${callerName} is calling...`,
                data: {
                  type: 'incoming_call',
                  call_id: newCallId,
                  caller_id: user.id,
                  caller_name: callerName,
                  call_type: 'voice',
                  meeting_url: roomUrl,
                },
                sound: 'default',
                priority: 'high',
                channelId: 'incoming-calls',
                categoryId: 'incoming_call',
                ttl: 30, // Call times out after 30 seconds
              }),
            }).then(res => {
              if (res.ok) {
                console.log('[VoiceCallDaily] ✅ Push notification sent to callee');
              } else {
                res.text().then(text => {
                  console.warn('[VoiceCallDaily] Push notification failed:', text);
                });
              }
            }).catch(err => {
              console.warn('[VoiceCallDaily] Failed to send push notification:', err);
            });

            // OPTIMIZATION: Defer CallKeep registration (non-blocking)
            callKeepManager.startCall(newCallId, userName || 'Unknown', false)
              .catch((err) => {
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
            // Note: audioSource: true was passed in join options
            // setLocalAudio enables our audio track
            daily.setLocalAudio(true);
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

        daily.on('participant-left', (event: any) => {
          console.log('[VoiceCallDaily] Participant left:', event?.participant?.user_id);
          updateParticipantCount();
          
          // If a remote participant left and we're in a 1:1 call, end the call
          const participants = daily.participants();
          const remoteParticipants = Object.values(participants).filter((p: any) => !p.local);
          
          // End call if no remote participants remain (the other party hung up)
          if (remoteParticipants.length === 0) {
            console.log('[VoiceCallDaily] Last remote participant left - ending call');
            // Small delay to let any final events process
            setTimeout(() => {
              endCall();
            }, 500);
          }
          
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

        // Handle network quality and reconnection events
        daily.on('network-quality-change', (event: any) => {
          const { quality, threshold } = event || {};
          console.log('[VoiceCallDaily] Network quality:', quality, 'threshold:', threshold);
        });

        // Handle network connection state for background recovery
        daily.on('network-connection', async (event: any) => {
          const { type, event: eventType } = event || {};
          console.log('[VoiceCallDaily] Network connection:', type, eventType);
          
          if (eventType === 'interrupted') {
            console.log('[VoiceCallDaily] Connection interrupted - will attempt reconnect');
            // Connection is interrupted but Daily.co will attempt automatic reconnection
          } else if (eventType === 'connected') {
            console.log('[VoiceCallDaily] Connection restored');
            // Re-enable audio after reconnection with retry
            // Note: We don't have isAudioEnabledRef, so check current state from Daily.co
            if (dailyRef.current) {
              try {
                // Wait for connection to stabilize
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Check if audio was enabled before interruption
                const currentAudio = dailyRef.current.localAudio();
                if (currentAudio !== false) {
                  // Re-enable with setLocalAudio (RN compatible)
                  dailyRef.current.setLocalAudio(true);
                  console.log('[VoiceCallDaily] Re-enabled mic after reconnect');
                }
              } catch (e) {
                console.warn('[VoiceCallDaily] Failed to re-enable audio:', e);
              }
            }
          }
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

        // Note: setSubscribeToTracksAutomatically must be called AFTER join
        // We pass subscribeToTracksAutomatically: true in the join options instead
        console.log('[VoiceCallDaily] Preparing to join with auto-subscribe enabled...');

        // Join the call with explicit audio settings
        console.log('[VoiceCallDaily] Joining room:', roomUrl);
        await daily.join({ 
          url: roomUrl,
          audioSource: true,
          videoSource: false,
          // Ensure we receive all participant audio
          subscribeToTracksAutomatically: true,
        });

        // Note: InCallManager is now managed by useVoiceCallAudio hook
        // to prevent duplicate initialization and ringtone changes
        console.log('[VoiceCallDaily] Joined successfully, audio managed by useVoiceCallAudio');

        // Enable microphone with robust retry logic
        let micEnabled = false;
        
        try {
          // 1. Request microphone permissions on Android
          if (Platform.OS === 'android') {
            console.log('[VoiceCallDaily] Checking Android microphone permissions...');
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Microphone Permission',
                message: 'EduDash Pro needs microphone access for voice calls',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
            
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              console.error('[VoiceCallDaily] ❌ Microphone permission denied');
              setError('Microphone permission denied. Please enable it in settings.');
              // Continue with call but mic will be off
            } else {
              console.log('[VoiceCallDaily] ✅ Microphone permission granted');
            }
          }
          
          // 2. Wait for Daily.co to be fully ready
          await new Promise(resolve => setTimeout(resolve, 500));
            
          // 3. Verify Daily.co has loaded participants
          const participants = daily.participants();
          if (!participants || Object.keys(participants).length === 0) {
            console.warn('[VoiceCallDaily] No participants yet, waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // 4. Enable microphone with retry attempts
          // Note: setInputDevicesAsync is NOT supported in React Native Daily SDK
          // We use setLocalAudio(true) directly, which is the supported method
          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              console.log(`[VoiceCallDaily] Microphone enable attempt ${attempt}/5`);
              
              // Use setLocalAudio - the React Native compatible method
              // audioSource: true in join options already requested the mic
              daily.setLocalAudio(true);
              
              // Verify it worked
              await new Promise(resolve => setTimeout(resolve, 200));
              const localAudio = daily.localAudio();
              
              if (localAudio) {
                micEnabled = true;
                setIsAudioEnabled(true);
                console.log('[VoiceCallDaily] ✅ Microphone enabled successfully');
                break;
              } else {
                console.warn(`[VoiceCallDaily] Attempt ${attempt} failed, mic still off`);
                if (attempt < 5) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
            } catch (micError) {
              console.warn(`[VoiceCallDaily] Attempt ${attempt} error:`, micError);
              if (attempt < 5) {
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
          }
          
          if (!micEnabled) {
            console.error('[VoiceCallDaily] ❌ Failed to enable microphone after 5 attempts');
            setError('Could not enable microphone. Please check your device settings.');
          }
        } catch (audioError) {
          console.error('[VoiceCallDaily] ❌ Audio setup error:', audioError);
          setError('Audio setup failed. Please restart the app.');
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
      
      // Use setLocalAudio - React Native compatible method
      dailyRef.current.setLocalAudio(newState);
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
