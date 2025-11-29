'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DailyCallInterface } from './DailyCallInterface';
import { IncomingCallOverlay } from './IncomingCallOverlay';

interface ActiveCall {
  id: string;
  call_id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
  caller_name?: string;
  meeting_url?: string;
  started_at: string;
}

interface CallContextType {
  startVoiceCall: (userId: string, userName?: string) => void;
  startVideoCall: (userId: string, userName?: string) => void;
  incomingCall: ActiveCall | null;
  isCallActive: boolean;
  isInActiveCall: boolean;
  returnToCall: () => void;
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
  const supabase = createClient();
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string } } | null) => {
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
        async (payload: { new: ActiveCall }) => {
          console.log('[CallProvider] Raw realtime payload:', JSON.stringify(payload.new, null, 2));
          const call = payload.new as ActiveCall;
          console.log('[CallProvider] Incoming call received:', {
            callId: call.call_id,
            callType: call.call_type,
            status: call.status,
            meetingUrl: call.meeting_url,
            callerId: call.caller_id,
          });
          
          if (call.status === 'ringing') {
            // Always fetch the full call record from DB to ensure we have all fields
            // Realtime payloads sometimes don't include all columns
            let meetingUrl = call.meeting_url;
            
            if (!meetingUrl) {
              console.log('[CallProvider] meeting_url not in payload, fetching from DB...');
              
              // Small delay to ensure the record is fully committed
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Fetch with retry
              for (let attempt = 0; attempt < 3; attempt++) {
                const { data: fullCall, error } = await supabase
                  .from('active_calls')
                  .select('*')
                  .eq('call_id', call.call_id)
                  .single();
                
                if (fullCall?.meeting_url) {
                  meetingUrl = fullCall.meeting_url;
                  console.log('[CallProvider] Got meeting_url from DB (attempt', attempt + 1, '):', meetingUrl);
                  break;
                }
                
                if (error) {
                  console.warn('[CallProvider] DB fetch attempt', attempt + 1, 'failed:', error.message);
                }
                
                // Wait before retry
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
              
              if (!meetingUrl) {
                console.error('[CallProvider] Failed to get meeting_url after 3 attempts');
              }
            }
            
            // Fetch caller name from profiles
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', call.caller_id)
              .single();
            
            const callerName = profile 
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown';

            setIncomingCall({ ...call, meeting_url: meetingUrl, caller_name: callerName });
            console.log('[CallProvider] Incoming call set with meeting_url:', meetingUrl);
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

  // Return to active call
  const returnToCall = useCallback(() => {
    if (outgoingCall || answeringCall) {
      setIsCallInterfaceOpen(true);
    }
  }, [outgoingCall, answeringCall]);

  const isCallActive = isCallInterfaceOpen || !!incomingCall;
  const isInActiveCall = !!(outgoingCall || answeringCall);

  // Floating indicator for incoming call when user navigates away
  const showFloatingIndicator = !!incomingCall && !answeringCall;

  return (
    <CallContext.Provider value={{ startVoiceCall, startVideoCall, incomingCall, isCallActive, isInActiveCall, returnToCall }}>
      {children}

      {/* Floating "Return to Call" button when in active call but interface is closed */}
      {isInActiveCall && !isCallInterfaceOpen && (
        <div
          onClick={returnToCall}
          style={{
            position: 'fixed',
            bottom: 100,
            left: 20,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            borderRadius: 50,
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4)',
            cursor: 'pointer',
            animation: 'pulse-call 2s ease-in-out infinite',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M15 10l-4 4l6 6l4-16l-18 7l7 2l2 7l3-6" />
            </svg>
          </div>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>
            Return to Call
          </div>
        </div>
      )}

      {/* Floating call indicator - shows when there's incoming call and user is elsewhere */}
      {showFloatingIndicator && (
        <div
          onClick={answerIncomingCall}
          style={{
            position: 'fixed',
            bottom: 100,
            right: 20,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            borderRadius: 50,
            boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
            cursor: 'pointer',
            animation: 'pulse-call 1.5s ease-in-out infinite',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <div style={{ color: 'white' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Incoming Call</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{incomingCall?.caller_name || 'Unknown'}</div>
          </div>
          <div
            style={{
              marginLeft: 8,
              padding: '6px 12px',
              background: 'white',
              color: '#16a34a',
              borderRadius: 20,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Answer
          </div>
        </div>
      )}

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
        <DailyCallInterface
          isOpen={isCallInterfaceOpen && !answeringCall}
          onClose={handleCallClose}
          callType={outgoingCall.callType}
          remoteUserId={outgoingCall.userId}
          remoteUserName={outgoingCall.userName}
        />
      )}

      {/* Call interface for answering calls */}
      {answeringCall && (
        <DailyCallInterface
          isOpen={isCallInterfaceOpen}
          onClose={handleCallClose}
          callType={answeringCall.call_type}
          remoteUserId={answeringCall.caller_id}
          remoteUserName={answeringCall.caller_name}
          isIncoming={true}
          incomingCallId={answeringCall.call_id}
          meetingUrl={answeringCall.meeting_url}
        />
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes pulse-call {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 8px 32px rgba(34, 197, 94, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 12px 40px rgba(34, 197, 94, 0.6);
          }
        }
      `}</style>
    </CallContext.Provider>
  );
}
