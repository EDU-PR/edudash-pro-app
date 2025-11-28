'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Minimize2,
  X,
} from 'lucide-react';

type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface CallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'voice' | 'video';
  remoteUserId?: string;
  remoteUserName?: string;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  // New props for answering incoming calls
  isIncoming?: boolean;
  incomingCallId?: string;
}

export const CallInterface = ({
  isOpen,
  onClose,
  callType: initialCallType,
  remoteUserId,
  remoteUserName,
  onCallStart,
  onCallEnd,
  isIncoming = false,
  incomingCallId,
}: CallInterfaceProps) => {
  const supabase = createClientComponentClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(incomingCallId || null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialCallType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, [supabase]);

  // Format call duration
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize local media stream
  const initializeLocalStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideoEnabled ? { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Unable to access camera/microphone. Please check permissions.');
      throw err;
    }
  }, [isVideoEnabled]);

  // Send signaling message via Supabase
  const sendSignal = useCallback(async (
    toUserId: string,
    signalType: string,
    payload: any,
    callId: string
  ) => {
    if (!currentUserId) return;
    
    await supabase.from('call_signals').insert({
      call_id: callId,
      from_user_id: currentUserId,
      to_user_id: toUserId,
      signal_type: signalType,
      payload,
    });
  }, [currentUserId, supabase]);

  // Create peer connection with signaling
  const createPeerConnection = useCallback((callId: string, targetUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserId) {
        sendSignal(targetUserId, 'ice-candidate', event.candidate.toJSON(), callId);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        setCallState('connected');
        // Start call timer
        if (!callTimerRef.current) {
          callTimerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setCallState('failed');
        setError('Connection lost');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendSignal]);

  // Handle incoming signaling messages
  const handleSignal = useCallback(async (signal: any) => {
    const pc = peerConnectionRef.current;
    if (!pc || !remoteUserId || !currentCallId) return;

    switch (signal.signal_type) {
      case 'answer':
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          setCallState('connected');
          // Process pending ICE candidates
          for (const candidate of pendingIceCandidatesRef.current) {
            await pc.addIceCandidate(candidate);
          }
          pendingIceCandidatesRef.current = [];
        } catch (err) {
          console.error('Error handling answer:', err);
        }
        break;

      case 'ice-candidate':
        const candidate = new RTCIceCandidate(signal.payload);
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        } else {
          pendingIceCandidatesRef.current.push(candidate);
        }
        break;

      case 'call-ended':
      case 'call-rejected':
        endCall();
        break;
    }
  }, [remoteUserId, currentCallId]);

  // Subscribe to signaling channel
  useEffect(() => {
    if (!currentUserId || !currentCallId) return;

    const channel = supabase
      .channel(`call-signals-${currentCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          if (payload.new.call_id === currentCallId) {
            handleSignal(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, currentCallId, supabase, handleSignal]);

  // Start outgoing call
  const startCall = useCallback(async () => {
    if (!currentUserId || !remoteUserId) {
      setError('Missing user information');
      return;
    }

    try {
      setCallState('connecting');
      setError(null);

      // Generate call ID
      const callId = crypto.randomUUID();
      setCurrentCallId(callId);

      // Create call record in database
      await supabase.from('active_calls').insert({
        call_id: callId,
        caller_id: currentUserId,
        callee_id: remoteUserId,
        call_type: initialCallType,
        status: 'ringing',
        caller_name: remoteUserName, // Will be used by receiver
      });

      // Initialize media
      const stream = await initializeLocalStream();
      const pc = createPeerConnection(callId, remoteUserId);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(remoteUserId, 'offer', offer, callId);

      setCallState('ringing');
      onCallStart?.();

      // Timeout: End call if not answered in 45 seconds
      setTimeout(() => {
        if (callState === 'ringing') {
          endCall();
          setError('No answer');
        }
      }, 45000);
    } catch (err) {
      console.error('Error starting call:', err);
      setCallState('failed');
    }
  }, [currentUserId, remoteUserId, initialCallType, supabase, initializeLocalStream, createPeerConnection, sendSignal, onCallStart, callState]);

  // End call
  const endCall = useCallback(async () => {
    // Signal the other party
    if (currentCallId && remoteUserId && currentUserId) {
      await sendSignal(remoteUserId, 'call-ended', { reason: 'ended' }, currentCallId);
      
      // Update call status in database
      await supabase
        .from('active_calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('call_id', currentCallId);
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    setCurrentCallId(null);
    setCallState('ended');
    setCallDuration(0);
    onCallEnd?.();
    
    setTimeout(() => {
      onClose();
    }, 1000);
  }, [currentCallId, remoteUserId, currentUserId, supabase, sendSignal, onCallEnd, onClose]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // Start call when opened
  useEffect(() => {
    if (isOpen && callState === 'idle') {
      startCall();
    }
  }, [isOpen, callState, startCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  // Minimized view (picture-in-picture style)
  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 100,
          right: 20,
          width: 160,
          height: 120,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#1a1a2e',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          cursor: 'pointer',
        }}
        onClick={() => setIsMinimized(false)}
      >
        {isVideoEnabled ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
            }}
          >
            <Phone size={32} color="white" />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            fontSize: 12,
            fontWeight: 600,
            color: 'white',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {formatDuration(callDuration)}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: 'var(--danger)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} color="white" />
        </button>
      </div>
    );
  }

  // Full call interface
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#0f0f1a',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: 'white',
            }}
          >
            {remoteUserName || 'Unknown'}
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'ringing' && 'Ringing...'}
            {callState === 'connected' && formatDuration(callDuration)}
            {callState === 'ended' && 'Call ended'}
            {callState === 'failed' && (error || 'Call failed')}
          </p>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
          }}
        >
          <Minimize2 size={20} />
        </button>
      </div>

      {/* Video Area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Remote video (large) */}
        {isVideoEnabled ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#1a1a2e',
            }}
          />
        ) : (
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 80,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 64,
              fontWeight: 600,
              color: 'white',
            }}
          >
            {(remoteUserName || 'U').charAt(0).toUpperCase()}
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        {isVideoEnabled && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 120,
              height: 160,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror local video
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          padding: '24px 20px 40px',
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {/* Mute */}
        <button
          onClick={toggleAudio}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: isAudioEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isAudioEnabled ? (
            <Mic size={24} color="white" />
          ) : (
            <MicOff size={24} color="white" />
          )}
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: isVideoEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isVideoEnabled ? (
            <Video size={24} color="white" />
          ) : (
            <VideoOff size={24} color="white" />
          )}
        </button>

        {/* End call */}
        <button
          onClick={endCall}
          style={{
            width: 72,
            height: 56,
            borderRadius: 28,
            background: '#ef4444',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
          }}
        >
          <PhoneOff size={28} color="white" />
        </button>
      </div>
    </div>
  );
};

// Hook for managing call state
export const useCallInterface = () => {
  const [callState, setCallState] = useState<{
    isOpen: boolean;
    callType: 'voice' | 'video';
    remoteUserId?: string;
    remoteUserName?: string;
  }>({
    isOpen: false,
    callType: 'voice',
  });

  const startVoiceCall = useCallback((userId: string, userName?: string) => {
    setCallState({
      isOpen: true,
      callType: 'voice',
      remoteUserId: userId,
      remoteUserName: userName,
    });
  }, []);

  const startVideoCall = useCallback((userId: string, userName?: string) => {
    setCallState({
      isOpen: true,
      callType: 'video',
      remoteUserId: userId,
      remoteUserName: userName,
    });
  }, []);

  const closeCall = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    callState,
    startVoiceCall,
    startVideoCall,
    closeCall,
  };
};