/**
 * Native Call Provider
 * 
 * Manages voice and video calls using Daily.co React Native SDK.
 * Feature-flagged: Only active when video_calls_enabled or voice_calls_enabled is true.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AppState, AppStateStatus, Platform, Alert, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { assertSupabase } from '@/lib/supabase';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { callKeepManager } from '@/lib/calls/callkeep-manager';
import { getPendingCall, cancelIncomingCallNotification, type IncomingCallData } from '@/lib/calls/CallHeadlessTask';
import { toast } from '@/components/ui/ToastProvider';

// Lazy getter to avoid accessing supabase at module load time
const getSupabase = () => assertSupabase();

import { VoiceCallInterface } from './VoiceCallInterface';
import { WhatsAppStyleVideoCall } from './WhatsAppStyleVideoCall';
import { WhatsAppStyleIncomingCall } from './WhatsAppStyleIncomingCall';
import { usePresence } from '@/hooks/usePresence';
import type {
  ActiveCall,
  CallContextType,
  CallSignal,
  CallSignalPayload,
  CallState,
  OutgoingCallParams,
} from './types';
import type { PresenceStatus } from '@/hooks/usePresence';

// Feature flag check
const isCallsEnabled = () => {
  const flags = getFeatureFlagsSync();
  return flags.video_calls_enabled || flags.voice_calls_enabled;
};

const CallContext = createContext<CallContextType | null>(null);

/**
 * Safe version of useCall that returns null instead of throwing when context is missing.
 * Use this in components where calls are optional.
 */
export function useCallSafe(): CallContextType | null {
  return useContext(CallContext);
}

/**
 * Standard useCall hook - throws if used outside CallProvider.
 * Prefer useCallSafe() for optional call functionality.
 */
export function useCall(): CallContextType {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

/**
 * Disabled context value - provides no-op functions when calls are disabled.
 * This ensures useCall() never returns null, preventing crashes.
 */
const DISABLED_CONTEXT: CallContextType = {
  startVoiceCall: () => console.warn('[CallProvider] Calls are disabled'),
  startVideoCall: () => console.warn('[CallProvider] Calls are disabled'),
  answerCall: () => {},
  rejectCall: async () => {},
  endCall: async () => {},
  incomingCall: null,
  outgoingCall: null,
  isCallActive: false,
  isInActiveCall: false,
  callState: 'idle',
  returnToCall: () => {},
  // Presence - always return offline when calls are disabled
  isUserOnline: () => false,
  getLastSeenText: () => 'Offline',
  refreshPresence: async () => {},
};

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallParams | null>(null);
  const [isCallInterfaceOpen, setIsCallInterfaceOpen] = useState(false);
  const [answeringCall, setAnsweringCall] = useState<ActiveCall | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Check if calls feature is enabled
  const callsEnabled = isCallsEnabled();
  
  // Track presence for online/offline detection.
  // The hook itself is always called (to satisfy React's rules-of-hooks),
  // but we only use the presence data when the calls feature is enabled.
  const presence = usePresence(currentUserId);
  const isUserOnline = callsEnabled ? presence.isUserOnline : () => false;
  const getLastSeenText = callsEnabled ? presence.getLastSeenText : () => '';
  const refreshPresence = callsEnabled ? presence.refreshPresence : async () => {};

  // Setup CallKeep and get current user
  useEffect(() => {
    if (!callsEnabled) return;

    // Initialize CallKeep for native call UI (lock screen support)
    const setupCallKeep = async () => {
      const success = await callKeepManager.setup({
        appName: 'EduDash Pro',
        supportsVideo: true,
        imageName: 'AppIcon',
        ringtoneSound: 'ringtone.mp3',
      });
      
      if (success) {
        console.log('[CallProvider] CallKeep initialized successfully');
      } else {
        // CallKeep not available in development/Expo Go - this is expected
        if (typeof __DEV__ === 'undefined' || !__DEV__) {
          console.warn('[CallProvider] CallKeep initialization failed - calls may not work on locked screen');
        }
      }
    };
    
    setupCallKeep();

    const getUser = async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user?.id || null);
      }
    );

    return () => {
      subscription.unsubscribe();
      callKeepManager.cleanup();
    };
  }, [callsEnabled]);

  // Track app state for background handling
  useEffect(() => {
    if (!callsEnabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('[CallProvider] App state changed:', appState, '->', nextAppState);
      setAppState(nextAppState);
      
      // When app comes to foreground, check for pending calls from HeadlessJS
      if (nextAppState === 'active') {
        checkPendingCall();
      }
    });

    return () => subscription.remove();
  }, [appState, callsEnabled]);
  
  // Check for pending calls saved by HeadlessJS task
  const checkPendingCall = useCallback(async () => {
    try {
      const pendingCall = await getPendingCall();
      if (pendingCall) {
        console.log('[CallProvider] Found pending call from HeadlessJS:', pendingCall.call_id);
        
        // Set as incoming call
        setIncomingCall({
          id: pendingCall.call_id,
          call_id: pendingCall.call_id,
          caller_id: pendingCall.caller_id,
          callee_id: currentUserId || '',
          call_type: pendingCall.call_type,
          status: 'ringing',
          caller_name: pendingCall.caller_name,
          meeting_url: pendingCall.meeting_url,
          started_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[CallProvider] Error checking pending call:', error);
    }
  }, [currentUserId]);
  
  // Listen for CallKeep events (answer/end from native UI)
  useEffect(() => {
    if (!callsEnabled) return;
    
    // Handle answer from native call UI (lock screen)
    const handleAnswerCall = async (callUUID: string) => {
      console.log('[CallProvider] CallKeep answer event:', callUUID);
      
      // Find the matching incoming call
      if (incomingCall?.call_id === callUUID) {
        console.log('[CallProvider] Answering call from native UI');
        await answerCall();
      } else {
        // Try to find call in database
        const { data: call } = await getSupabase()
          .from('active_calls')
          .select('*')
          .eq('call_id', callUUID)
          .single();
        
        if (call) {
          console.log('[CallProvider] Found call in DB, answering:', call.call_id);
          setIncomingCall(call);
          // Small delay to let state update
          setTimeout(async () => {
            setAnsweringCall(call);
            setIsCallInterfaceOpen(true);
            setIncomingCall(null);
            setCallState('connecting');
            await callKeepManager.reportConnected(call.call_id);
          }, 100);
        }
      }
    };
    
    // Handle end from native call UI (lock screen)
    const handleEndCall = async (callUUID: string) => {
      console.log('[CallProvider] CallKeep end event:', callUUID);
      
      // End the call if it matches current incoming/answering call
      if (incomingCall?.call_id === callUUID) {
        await rejectCall();
      } else if (answeringCall?.call_id === callUUID) {
        await endCall();
      }
    };
    
    // Handle mute from native call UI
    const handleMuteCall = (callUUID: string, muted: boolean) => {
      console.log('[CallProvider] CallKeep mute event:', callUUID, muted);
      // This will be handled by VoiceCallInterface
    };
    
    // Subscribe to CallKeep events
    callKeepManager.on('answerCall', handleAnswerCall);
    callKeepManager.on('endCall', handleEndCall);
    callKeepManager.on('muteCall', handleMuteCall);
    
    // Check for pending calls on mount
    checkPendingCall();
    
    return () => {
      callKeepManager.off('answerCall', handleAnswerCall);
      callKeepManager.off('endCall', handleEndCall);
      callKeepManager.off('muteCall', handleMuteCall);
    };
  }, [callsEnabled, incomingCall, answeringCall, answerCall, rejectCall, endCall, checkPendingCall]);

  // Listen for notification responses (Answer/Decline from notification drawer)
  useEffect(() => {
    if (!callsEnabled) return;
    
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      
      // Only handle incoming call notifications
      if (data?.type !== 'incoming_call') return;
      
      const actionId = response.actionIdentifier;
      const callId = data.call_id as string;
      
      console.log('[CallProvider] Notification action received:', { actionId, callId });
      
      // Cancel vibration immediately
      Vibration.cancel();
      
      // Cancel the notification
      await cancelIncomingCallNotification(callId);
      await Notifications.setBadgeCountAsync(0);
      
      if (actionId === 'ANSWER' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // User tapped Answer or the notification itself
        console.log('[CallProvider] Answering call from notification:', callId);
        
        // Check if we have this as the current incoming call
        if (incomingCall?.call_id === callId) {
          answerCall();
        } else {
          // Try to fetch call from DB and set it up
          const { data: call } = await getSupabase()
            .from('active_calls')
            .select('*')
            .eq('call_id', callId)
            .single();
          
          if (call) {
            // Fetch caller name
            const { data: profile } = await getSupabase()
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', call.caller_id)
              .single();
            
            const callerName = profile
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
              : data.caller_name as string || 'Unknown';
            
            const activeCall: ActiveCall = {
              ...call,
              caller_name: callerName,
              meeting_url: call.meeting_url || data.meeting_url as string,
            };
            
            setAnsweringCall(activeCall);
            setIsCallInterfaceOpen(true);
            setCallState('connecting');
          }
        }
      } else if (actionId === 'DECLINE') {
        // User tapped Decline
        console.log('[CallProvider] Declining call from notification:', callId);
        
        if (incomingCall?.call_id === callId) {
          rejectCall();
        } else {
          // Update call status in DB
          await getSupabase()
            .from('active_calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('call_id', callId);
        }
      }
    });
    
    return () => subscription.remove();
  }, [callsEnabled, incomingCall, answerCall, rejectCall]);

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!currentUserId || !callsEnabled) return;

    console.log('[CallProvider] Setting up incoming call listener for user:', currentUserId);

    const channel = getSupabase()
      .channel(`incoming-calls-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'active_calls',
          filter: `callee_id=eq.${currentUserId}`,
        },
        async (payload: { new: ActiveCall }) => {
          console.log('[CallProvider] ✅ Incoming call INSERT detected:', payload.new);
          const call = payload.new;

          if (call.status === 'ringing') {
            // Fetch full call record to ensure we have meeting_url
            let meetingUrl = call.meeting_url;

            if (!meetingUrl) {
              console.log('[CallProvider] Fetching meeting_url from DB...');
              await new Promise((resolve) => setTimeout(resolve, 300));

              const { data: fullCall } = await getSupabase()
                .from('active_calls')
                .select('*')
                .eq('call_id', call.call_id)
                .single();

              if (fullCall?.meeting_url) {
                meetingUrl = fullCall.meeting_url;
              }
            }

            // Fetch caller name
            const { data: profile } = await getSupabase()
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', call.caller_id)
              .single();

            const callerName = profile
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown';

            console.log('[CallProvider] Setting incoming call state:', {
              callId: call.call_id,
              callerName,
              meetingUrl: meetingUrl ? 'present' : 'missing',
            });

            // Display on native call screen (works when device is locked)
            await callKeepManager.displayIncomingCall(
              call.call_id,
              callerName,
              call.call_type === 'video'
            );

            setIncomingCall({
              ...call,
              meeting_url: meetingUrl,
              caller_name: callerName,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
          filter: `callee_id=eq.${currentUserId}`,
        },
        async (payload: { new: ActiveCall }) => {
          console.log('[CallProvider] ✅ Incoming call UPDATE detected:', payload.new);
          const call = payload.new;
          if (
            call.status === 'ended' ||
            call.status === 'rejected' ||
            call.status === 'missed'
          ) {
            // Cancel notification and vibration when call ends for any reason
            await cancelIncomingCallNotification(call.call_id);
            await Notifications.setBadgeCountAsync(0);
            Vibration.cancel();
            
            if (incomingCall?.call_id === call.call_id) {
              setIncomingCall(null);
              setCallState('ended');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[CallProvider] Realtime subscription status:', status);
      });

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [currentUserId, incomingCall, callsEnabled]);

  // Listen for call signals (backup for meeting_url)
  useEffect(() => {
    if (!currentUserId || !callsEnabled) return;

    const signalChannel = getSupabase()
      .channel(`call-signals-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${currentUserId}`,
        },
        (payload: { new: CallSignal }) => {
          const signal = payload.new;
          if (signal.signal_type !== 'offer') return;

          const signalPayload = signal.payload as CallSignalPayload | null;
          const meetingUrl = signalPayload?.meeting_url;
          if (!meetingUrl) return;

          setIncomingCall((prev) => {
            if (prev && prev.call_id === signal.call_id) {
              if (prev.meeting_url === meetingUrl) return prev;
              console.log('[CallProvider] Updated meeting_url from signal');
              return { ...prev, meeting_url: meetingUrl };
            }

            // Create placeholder if active_calls hasn't arrived yet
            console.log('[CallProvider] Creating placeholder from signal');
            return {
              id: signal.id,
              call_id: signal.call_id,
              caller_id: signal.from_user_id,
              callee_id: signal.to_user_id,
              call_type: signalPayload?.call_type || 'voice',
              status: 'ringing',
              caller_name: signalPayload?.caller_name || 'Unknown',
              meeting_url: meetingUrl,
              started_at: signal.created_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(signalChannel);
    };
  }, [currentUserId, callsEnabled]);

  // Start voice call
  const startVoiceCall = useCallback(
    async (userId: string, userName?: string) => {
      if (!currentUserId || !callsEnabled) {
        console.warn('[CallProvider] Cannot start call - user not logged in or calls disabled');
        Alert.alert('Unable to Call', 'Please sign in and ensure calls are enabled.');
        return;
      }
      
      // Refresh presence data to get latest status
      console.log('[CallProvider] Refreshing presence before call check...');
      await refreshPresence();
      
      // Check if user is online
      const userOnline = isUserOnline(userId);
      const lastSeenText = getLastSeenText(userId);
      console.log('[CallProvider] Presence check:', {
        userId,
        userName,
        userOnline,
        lastSeenText
      });
      
      // Allow calls to offline users - they'll receive a push notification
      // Previously we blocked calls to offline users, but push notifications can wake the app
      if (!userOnline) {
        console.log('[CallProvider] User offline, will send push notification');
        toast.info(`${userName || 'User'} appears offline. They'll receive a notification.`);
      }
      
      console.log('[CallProvider] Starting call (user online:', userOnline, ')');
      
      setOutgoingCall({ userId, userName, callType: 'voice' });
      setIsCallInterfaceOpen(true);
      setCallState('connecting');
    },
    [currentUserId, callsEnabled, isUserOnline, getLastSeenText, refreshPresence]
  );

  // Start video call
  const startVideoCall = useCallback(
    async (userId: string, userName?: string) => {
      if (!currentUserId || !callsEnabled) {
        console.warn('[CallProvider] Cannot start call - user not logged in or calls disabled');
        Alert.alert('Unable to Call', 'Please sign in and ensure calls are enabled.');
        return;
      }
      
      // Refresh presence data to get latest status
      console.log('[CallProvider] Refreshing presence before video call check...');
      await refreshPresence();
      
      // Check if user is online
      const userOnline = isUserOnline(userId);
      const lastSeenText = getLastSeenText(userId);
      console.log('[CallProvider] Video presence check:', {
        userId,
        userName,
        userOnline,
        lastSeenText
      });
      
      // Allow calls to offline users - they'll receive a push notification
      if (!userOnline) {
        console.log('[CallProvider] User offline, will send push notification for video call');
        toast.info(`${userName || 'User'} appears offline. They'll receive a notification.`);
      }
      
      console.log('[CallProvider] Starting video call (user online:', userOnline, ')');
      
      setOutgoingCall({ userId, userName, callType: 'video' });
      setIsCallInterfaceOpen(true);
      setCallState('connecting');
    },
    [currentUserId, callsEnabled, isUserOnline, getLastSeenText, refreshPresence]
  );

  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    console.log('[CallProvider] ✅ Answering call:', {
      callId: incomingCall.call_id,
      meetingUrl: incomingCall.meeting_url,
      callerName: incomingCall.caller_name,
    });
    
    // Cancel notification and vibration
    await cancelIncomingCallNotification(incomingCall.call_id);
    await Notifications.setBadgeCountAsync(0);
    Vibration.cancel();
    
    // Report to CallKeep that call is being answered
    await callKeepManager.reportConnected(incomingCall.call_id);
    
    setAnsweringCall(incomingCall);
    setIsCallInterfaceOpen(true);
    setIncomingCall(null);
    setCallState('connecting');
  }, [incomingCall]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;
    console.log('[CallProvider] Rejecting call:', incomingCall.call_id);

    // Cancel notification and vibration
    await cancelIncomingCallNotification(incomingCall.call_id);
    await Notifications.setBadgeCountAsync(0);
    Vibration.cancel();

    // End call in CallKeep
    await callKeepManager.endCall(incomingCall.call_id);

    await getSupabase()
      .from('active_calls')
      .update({ status: 'rejected' })
      .eq('call_id', incomingCall.call_id);

    setIncomingCall(null);
    setCallState('idle');
  }, [incomingCall]);

  // End current call
  const endCall = useCallback(async () => {
    const callId = answeringCall?.call_id || outgoingCall?.userId;
    console.log('[CallProvider] Ending call:', callId);

    // End call in CallKeep
    if (callId) {
      await callKeepManager.endCall(callId);
    }

    if (answeringCall?.call_id) {
      await getSupabase()
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('call_id', answeringCall.call_id);
    }

    setIsCallInterfaceOpen(false);
    setOutgoingCall(null);
    setAnsweringCall(null);
    setCallState('ended');

    // Reset state after a short delay
    setTimeout(() => setCallState('idle'), 1000);
  }, [answeringCall, outgoingCall]);

  // Return to active call (for minimized calls)
  const returnToCall = useCallback(() => {
    if (answeringCall || outgoingCall) {
      setIsCallInterfaceOpen(true);
    }
  }, [answeringCall, outgoingCall]);

  // Calculate derived state
  const isCallActive = isCallInterfaceOpen || !!incomingCall;
  const isInActiveCall = isCallInterfaceOpen && (!!answeringCall || !!outgoingCall);

  const contextValue: CallContextType = {
    startVoiceCall,
    startVideoCall,
    answerCall,
    rejectCall,
    endCall,
    incomingCall,
    outgoingCall,
    isCallActive,
    isInActiveCall,
    callState,
    returnToCall,
    // Presence methods - unified single source to prevent duplicate subscriptions
    isUserOnline,
    getLastSeenText,
    refreshPresence,
  };

  // If calls are disabled, provide disabled context with no-op functions
  // This ensures useCall() always works and returns safe defaults
  if (!callsEnabled) {
    return (
      <CallContext.Provider value={DISABLED_CONTEXT}>
        {children}
      </CallContext.Provider>
    );
  }

  return (
    <CallContext.Provider value={contextValue}>
      {children}
      
      {/* WhatsApp-Style Incoming call overlay */}
      <WhatsAppStyleIncomingCall
        isVisible={!!incomingCall && !answeringCall}
        callerName={incomingCall?.caller_name || 'Unknown'}
        callerPhoto={null} // TODO: Fetch caller photo from profile
        callType={incomingCall?.call_type || 'voice'}
        onAnswer={answerCall}
        onReject={rejectCall}
        isConnecting={callState === 'connecting' || callState === 'connected'}
      />

      {/* Voice call interface for outgoing calls */}
      {outgoingCall && outgoingCall.callType === 'voice' && (
        <VoiceCallInterface
          isOpen={isCallInterfaceOpen && !answeringCall}
          onClose={endCall}
          roomName={`voice-${Date.now()}`}
          userName={outgoingCall.userName}
          isOwner={true}
          calleeId={outgoingCall.userId}
        />
      )}

      {/* WhatsApp-Style Video call interface for outgoing calls */}
      {outgoingCall && outgoingCall.callType === 'video' && (
        <WhatsAppStyleVideoCall
          isOpen={isCallInterfaceOpen && !answeringCall}
          onClose={endCall}
          roomName={`call-${Date.now()}`}
          userName={outgoingCall.userName}
          remoteUserName={outgoingCall.userName}
          isOwner={true}
          calleeId={outgoingCall.userId}
        />
      )}

      {/* Voice call interface for answering calls */}
      {answeringCall && answeringCall.call_type === 'voice' && answeringCall.meeting_url && (
        <VoiceCallInterface
          isOpen={isCallInterfaceOpen}
          onClose={endCall}
          roomName={answeringCall.meeting_url.split('/').pop() || `voice-${answeringCall.call_id}`}
          userName={answeringCall.caller_name}
          isOwner={false}
          callId={answeringCall.call_id}
          meetingUrl={answeringCall.meeting_url}
        />
      )}
      
      {answeringCall && !answeringCall.meeting_url && (
        (() => {
          console.error('[CallProvider] ❌ Answering call but NO meeting_url!', answeringCall);
          return null;
        })()
      )}

      {/* WhatsApp-Style Video call interface for answering calls */}
      {answeringCall && answeringCall.meeting_url && answeringCall.call_type === 'video' && (
        <WhatsAppStyleVideoCall
          isOpen={isCallInterfaceOpen}
          onClose={endCall}
          roomName={answeringCall.meeting_url.split('/').pop() || `call-${answeringCall.call_id}`}
          userName={answeringCall.caller_name}
          remoteUserName={answeringCall.caller_name}
          isOwner={false}
          callId={answeringCall.call_id}
          meetingUrl={answeringCall.meeting_url}
        />
      )}
    </CallContext.Provider>
  );
}

export default CallProvider;
