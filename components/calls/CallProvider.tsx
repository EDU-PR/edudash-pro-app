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
import { AppState, AppStateStatus, Platform, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
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
  
  // Track presence for online/offline detection
  const { isUserOnline, getLastSeenText } = usePresence(currentUserId);

  // Get current user
  useEffect(() => {
    if (!callsEnabled) return;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user?.id || null);
      }
    );

    return () => subscription.unsubscribe();
  }, [callsEnabled]);

  // Track app state for background handling
  useEffect(() => {
    if (!callsEnabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('[CallProvider] App state changed:', appState, '->', nextAppState);
      setAppState(nextAppState);
    });

    return () => subscription.remove();
  }, [appState, callsEnabled]);

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!currentUserId || !callsEnabled) return;

    console.log('[CallProvider] Setting up incoming call listener for user:', currentUserId);

    const channel = supabase
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
          console.log('[CallProvider] Incoming call received:', payload.new);
          const call = payload.new;

          if (call.status === 'ringing') {
            // Fetch full call record to ensure we have meeting_url
            let meetingUrl = call.meeting_url;

            if (!meetingUrl) {
              console.log('[CallProvider] Fetching meeting_url from DB...');
              await new Promise((resolve) => setTimeout(resolve, 300));

              const { data: fullCall } = await supabase
                .from('active_calls')
                .select('*')
                .eq('call_id', call.call_id)
                .single();

              if (fullCall?.meeting_url) {
                meetingUrl = fullCall.meeting_url;
              }
            }

            // Fetch caller name
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', call.caller_id)
              .single();

            const callerName = profile
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown';

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
        (payload: { new: ActiveCall }) => {
          const call = payload.new;
          if (
            call.status === 'ended' ||
            call.status === 'rejected' ||
            call.status === 'missed'
          ) {
            if (incomingCall?.call_id === call.call_id) {
              setIncomingCall(null);
              setCallState('ended');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, incomingCall, callsEnabled]);

  // Listen for call signals (backup for meeting_url)
  useEffect(() => {
    if (!currentUserId || !callsEnabled) return;

    const signalChannel = supabase
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
      supabase.removeChannel(signalChannel);
    };
  }, [currentUserId, callsEnabled]);

  // Start voice call
  const startVoiceCall = useCallback(
    (userId: string, userName?: string) => {
      if (!currentUserId || !callsEnabled) {
        console.warn('[CallProvider] Cannot start call - user not logged in or calls disabled');
        Alert.alert('Unable to Call', 'Please sign in and ensure calls are enabled.');
        return;
      }
      
      // Check if user is online before starting call
      const userOnline = isUserOnline(userId);
      const lastSeenText = getLastSeenText(userId);
      console.log('[CallProvider] Presence check:', {
        userId,
        userName,
        userOnline,
        lastSeenText
      });
      
      if (!userOnline) {
        console.log('[CallProvider] User offline, showing alert');
        Alert.alert(
          'Unable to Call',
          `${userName || 'This user'} is currently offline (${lastSeenText}). Please try again when they are online.`,
          [
            { 
              text: 'OK', 
              style: 'default',
              onPress: () => console.log('[CallProvider] User acknowledged offline status')
            }
          ]
        );
        return;
      }
      
      console.log('[CallProvider] User is online, starting call');
      
      setOutgoingCall({ userId, userName, callType: 'voice' });
      setIsCallInterfaceOpen(true);
      setCallState('connecting');
    },
    [currentUserId, callsEnabled, isUserOnline, getLastSeenText]
  );

  // Start video call
  const startVideoCall = useCallback(
    (userId: string, userName?: string) => {
      if (!currentUserId || !callsEnabled) {
        console.warn('[CallProvider] Cannot start call - user not logged in or calls disabled');
        Alert.alert('Unable to Call', 'Please sign in and ensure calls are enabled.');
        return;
      }
      
      // Check if user is online before starting call
      const userOnline = isUserOnline(userId);
      const lastSeenText = getLastSeenText(userId);
      console.log('[CallProvider] Video presence check:', {
        userId,
        userName,
        userOnline,
        lastSeenText
      });
      
      if (!userOnline) {
        console.log('[CallProvider] User offline, showing video call alert');
        Alert.alert(
          'Unable to Video Call',
          `${userName || 'This user'} is currently offline (${lastSeenText}). Please try again when they are online.`,
          [
            { 
              text: 'OK', 
              style: 'default',
              onPress: () => console.log('[CallProvider] User acknowledged offline status')
            }
          ]
        );
        return;
      }
      
      console.log('[CallProvider] User is online, starting video call');
      
      setOutgoingCall({ userId, userName, callType: 'video' });
      setIsCallInterfaceOpen(true);
      setCallState('connecting');
    },
    [currentUserId, callsEnabled, isUserOnline, getLastSeenText]
  );

  // Answer incoming call
  const answerCall = useCallback(() => {
    if (!incomingCall) return;
    console.log('[CallProvider] Answering call:', incomingCall.call_id);
    setAnsweringCall(incomingCall);
    setIsCallInterfaceOpen(true);
    setIncomingCall(null);
    setCallState('connecting');
  }, [incomingCall]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;
    console.log('[CallProvider] Rejecting call:', incomingCall.call_id);

    await supabase
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

    if (answeringCall?.call_id) {
      await supabase
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
        />
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
