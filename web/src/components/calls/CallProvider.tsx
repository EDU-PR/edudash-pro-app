'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CallInterface } from './CallInterface';
import { IncomingCallOverlay } from './IncomingCallOverlay';

interface ActiveCall {
  id: string;
  call_id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
  caller_name?: string;
  started_at: string;
}

interface CallContextType {
  startVoiceCall: (userId: string, userName?: string) => void;
  startVideoCall: (userId: string, userName?: string) => void;
  incomingCall: ActiveCall | null;
  isCallActive: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const supabase = createClientComponentClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [isCallInterfaceOpen, setIsCallInterfaceOpen] = useState(false);
  const [outgoingCall, setOutgoingCall] = useState<{
    userId: string;
    userName?: string;
    callType: 'voice' | 'video';
  } | null>(null);
  const [answeringCall, setAnsweringCall] = useState<ActiveCall | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Listen for incoming calls
  useEffect(() => {
    if (!currentUserId) return;

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
        async (payload) => {
          const call = payload.new as ActiveCall;
          if (call.status === 'ringing') {
            // Fetch caller name from profiles
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', call.caller_id)
              .single();
            
            const callerName = profile 
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown';

            setIncomingCall({ ...call, caller_name: callerName });
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
        (payload) => {
          const call = payload.new as ActiveCall;
          if (call.status === 'ended' || call.status === 'rejected' || call.status === 'missed') {
            if (incomingCall?.call_id === call.call_id) {
              setIncomingCall(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase, incomingCall]);

  // Start voice call
  const startVoiceCall = useCallback((userId: string, userName?: string) => {
    setOutgoingCall({ userId, userName, callType: 'voice' });
    setIsCallInterfaceOpen(true);
  }, []);

  // Start video call  
  const startVideoCall = useCallback((userId: string, userName?: string) => {
    setOutgoingCall({ userId, userName, callType: 'video' });
    setIsCallInterfaceOpen(true);
  }, []);

  // Answer incoming call
  const answerIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    
    setAnsweringCall(incomingCall);
    setIncomingCall(null);
    setIsCallInterfaceOpen(true);
  }, [incomingCall]);

  // Reject incoming call
  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall || !currentUserId) return;

    await supabase
      .from('active_calls')
      .update({ status: 'rejected', ended_at: new Date().toISOString() })
      .eq('call_id', incomingCall.call_id);

    // Send rejection signal
    await supabase.from('call_signals').insert({
      call_id: incomingCall.call_id,
      from_user_id: currentUserId,
      to_user_id: incomingCall.caller_id,
      signal_type: 'call-rejected',
      payload: { reason: 'rejected' },
    });

    setIncomingCall(null);
  }, [incomingCall, currentUserId, supabase]);

  // Close call interface
  const handleCallClose = useCallback(() => {
    setIsCallInterfaceOpen(false);
    setOutgoingCall(null);
    setAnsweringCall(null);
  }, []);

  const isCallActive = isCallInterfaceOpen || !!incomingCall;

  return (
    <CallContext.Provider value={{ startVoiceCall, startVideoCall, incomingCall, isCallActive }}>
      {children}

      {/* Incoming call overlay */}
      <IncomingCallOverlay
        isVisible={!!incomingCall && !answeringCall}
        callerName={incomingCall?.caller_name}
        callType={incomingCall?.call_type || 'voice'}
        onAnswer={answerIncomingCall}
        onReject={rejectIncomingCall}
      />

      {/* Call interface for outgoing calls */}
      {outgoingCall && (
        <CallInterface
          isOpen={isCallInterfaceOpen && !answeringCall}
          onClose={handleCallClose}
          callType={outgoingCall.callType}
          remoteUserId={outgoingCall.userId}
          remoteUserName={outgoingCall.userName}
        />
      )}

      {/* Call interface for answering calls */}
      {answeringCall && (
        <CallInterface
          isOpen={isCallInterfaceOpen}
          onClose={handleCallClose}
          callType={answeringCall.call_type}
          remoteUserId={answeringCall.caller_id}
          remoteUserName={answeringCall.caller_name}
          isIncoming={true}
          incomingCallId={answeringCall.call_id}
        />
      )}
    </CallContext.Provider>
  );
}
