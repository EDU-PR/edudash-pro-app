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

interface CallSignalPayload {
  meeting_url?: string;
  call_type?: 'voice' | 'video';
  caller_name?: string;
}

interface CallSignal {
  id: string;
  call_id: string;
  from_user_id: string;
  to_user_id: string;
  signal_type: string;
  payload: CallSignalPayload | null;
  created_at: string;
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
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Fetch with exponential backoff retry (5 attempts with increasing delays)
              let lastError: { message?: string } | null = null;
              const maxAttempts = 5;
              const baseDelay = 500; // Start with 500ms delay
              
              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Try fetching from active_calls first
                const { data: fullCall, error } = await supabase
                  .from('active_calls')
                  .select('*')
                  .eq('call_id', call.call_id)
                  .single();
                
                if (fullCall?.meeting_url) {
                  meetingUrl = fullCall.meeting_url;
                  console.log('[CallProvider] Got meeting_url from active_calls (attempt', attempt + 1, '):', meetingUrl);
                  break;
                }
                
                if (error) {
                  lastError = error;
                  console.warn('[CallProvider] DB fetch attempt', attempt + 1, 'failed:', error.message);
                }
                
                // Fallback: Try fetching from call_signals table as backup
                if (!meetingUrl) {
                  const { data: signalData } = await supabase
                    .from('call_signals')
                    .select('payload')
                    .eq('call_id', call.call_id)
                    .eq('signal_type', 'call-offer')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (signalData?.payload?.meeting_url) {
                    meetingUrl = signalData.payload.meeting_url as string;
                    console.log('[CallProvider] Got meeting_url from call_signals fallback:', meetingUrl);
                    break;
                  }
                }
                
                // Exponential backoff: wait longer between each retry
                if (attempt < maxAttempts - 1) {
                  const delay = baseDelay * Math.pow(1.5, attempt); // 500ms, 750ms, 1125ms, 1687ms
                  console.log(`[CallProvider] Waiting ${Math.round(delay)}ms before retry...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
              
              if (!meetingUrl) {
                console.error('[CallProvider] Failed to get meeting_url after', maxAttempts, 'attempts', lastError?.message);
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

  // Listen for call signal payloads (e.g., meeting_url)
  useEffect(() => {
    if (!currentUserId) return;

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
          if (signal.signal_type !== 'call-offer') return;

          const meetingUrl = signal.payload?.meeting_url;
          if (!meetingUrl) return;

          setIncomingCall((prev) => {
            if (prev && prev.call_id === signal.call_id) {
              if (prev.meeting_url === meetingUrl) return prev;
              console.log('[CallProvider] Hydrated meeting_url from call-offer signal');
              return { ...prev, meeting_url: meetingUrl };
            }

            // If active_calls payload hasn't arrived yet, create a placeholder entry
            console.log('[CallProvider] Creating placeholder incoming call from call-offer signal');
            return {
              id: signal.id,
              call_id: signal.call_id,
              caller_id: signal.from_user_id,
              callee_id: signal.to_user_id,
              call_type: (signal.payload?.call_type as 'voice' | 'video') || 'voice',
              status: 'ringing',
              caller_name: signal.payload?.caller_name || 'Unknown',
              meeting_url: meetingUrl,
              started_at: signal.created_at,
            } as ActiveCall;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(signalChannel);
    };
  }, [currentUserId, supabase]);

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

  // Helper function to fetch meeting URL when it's missing
  const fetchMeetingUrl = useCallback(async (callId: string): Promise<string | undefined> => {
    const maxAttempts = 5;
    const baseDelay = 500;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try fetching from active_calls first
      const { data: callData } = await supabase
        .from('active_calls')
        .select('meeting_url')
        .eq('call_id', callId)
        .single();
      
      if (callData?.meeting_url) {
        console.log('[CallProvider] fetchMeetingUrl: Got URL from active_calls (attempt', attempt + 1, ')');
        return callData.meeting_url;
      }
      
      // Fallback: Try fetching from call_signals table
      const { data: signalData } = await supabase
        .from('call_signals')
        .select('payload')
        .eq('call_id', callId)
        .eq('signal_type', 'call-offer')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (signalData?.payload?.meeting_url) {
        console.log('[CallProvider] fetchMeetingUrl: Got URL from call_signals (attempt', attempt + 1, ')');
        return signalData.payload.meeting_url as string;
      }
      
      // Exponential backoff
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(1.5, attempt);
        console.log(`[CallProvider] fetchMeetingUrl: Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error('[CallProvider] fetchMeetingUrl: Failed after', maxAttempts, 'attempts');
    return undefined;
  }, [supabase]);

  // State to track if we're connecting to a call
  const [isConnecting, setIsConnecting] = useState(false);

  // Answer incoming call
  const answerIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    
    let callToAnswer = { ...incomingCall };
    
    // If meeting_url is missing, try to fetch it
    if (!callToAnswer.meeting_url) {
      console.log('[CallProvider] Meeting URL missing, fetching before answering...');
      setIsConnecting(true);
      
      const url = await fetchMeetingUrl(callToAnswer.call_id);
      
      if (url) {
        callToAnswer = { ...callToAnswer, meeting_url: url };
        console.log('[CallProvider] Successfully fetched meeting URL before answering');
      } else {
        console.error('[CallProvider] Could not fetch meeting URL, proceeding anyway');
      }
      
      setIsConnecting(false);
    }
    
    setAnsweringCall(callToAnswer);
    setIncomingCall(null);
    setIsCallInterfaceOpen(true);
  }, [incomingCall, fetchMeetingUrl]);

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
        isConnecting={isConnecting}
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
