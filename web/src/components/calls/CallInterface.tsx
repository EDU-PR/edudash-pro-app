'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Minimize2,
  X,
  Volume2,
  VolumeX,
  SwitchCamera,
  UserPlus,
  Users,
} from 'lucide-react';

type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed' | 'no-answer';

// Call timeout in milliseconds (30 seconds)
const CALL_TIMEOUT_MS = 30000;

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
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(incomingCallId || null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialCallType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  
  // Camera facing mode for switching front/back
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [availableContacts, setAvailableContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [showRetryButton, setShowRetryButton] = useState(false);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, [supabase]);

  // Play/stop ringback tone when ringing
  useEffect(() => {
    if (callState === 'ringing' && !isIncoming) {
      // Play ringback tone for outgoing calls
      if (!ringbackAudioRef.current) {
        ringbackAudioRef.current = new Audio('/sounds/ringback.mp3');
        ringbackAudioRef.current.loop = true;
        ringbackAudioRef.current.volume = 0.5;
      }
      ringbackAudioRef.current.play().catch(console.warn);
    } else {
      // Stop ringback tone
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current.currentTime = 0;
      }
    };
  }, [callState, isIncoming]);

  // Format call duration
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize local media stream
  const initializeLocalStream = useCallback(async (videoEnabled: boolean = isVideoEnabled) => {
    try {
      // Stop any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: videoEnabled ? { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Update video enabled state based on actual stream
      if (videoEnabled) {
        setIsVideoEnabled(true);
      }

      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Unable to access camera/microphone. Please check permissions.');
      throw err;
    }
  }, [facingMode]);

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
        setShowRetryButton(true);
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
        (payload: { new: { call_id: string; [key: string]: unknown } }) => {
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

      // Get caller's name for notification
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', currentUserId)
        .single();
      
      const callerName = callerProfile 
        ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() || 'Someone'
        : 'Someone';

      // Create call record in database
      await supabase.from('active_calls').insert({
        call_id: callId,
        caller_id: currentUserId,
        callee_id: remoteUserId,
        call_type: initialCallType,
        status: 'ringing',
        caller_name: callerName,
      });

      // Send push notification to callee (for when app is closed)
      try {
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: remoteUserId,
            title: `Incoming ${initialCallType} call`,
            body: `${callerName} is calling...`,
            tag: `call-${callId}`,
            type: 'call',
            requireInteraction: true,
            data: {
              url: '/dashboard/parent/messages',
              callId,
              callType: initialCallType,
              callerId: currentUserId,
              callerName,
            },
          }),
        });
      } catch (notifErr) {
        console.warn('Failed to send call push notification:', notifErr);
      }

      // Initialize media - for video calls, always enable camera
      const shouldEnableVideo = initialCallType === 'video';
      const stream = await initializeLocalStream(shouldEnableVideo);
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

      // Note: Call timeout is handled in a separate useEffect to properly track state
    } catch (err) {
      console.error('Error starting call:', err);
      setCallState('failed');
      setShowRetryButton(true);
    }
  }, [currentUserId, remoteUserId, initialCallType, supabase, initializeLocalStream, createPeerConnection, sendSignal, onCallStart]);

  // Call timeout handler - tracks state properly
  useEffect(() => {
    if (callState === 'ringing' && !isIncoming && currentCallId && remoteUserId && currentUserId) {
      // Set timeout for unanswered call
      callTimeoutRef.current = setTimeout(async () => {
        console.log('Call timeout - no answer');
        
        // Update call status to missed
        await supabase
          .from('active_calls')
          .update({ status: 'missed', ended_at: new Date().toISOString() })
          .eq('call_id', currentCallId);

        // Get caller name for notification
        const { data: callerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', currentUserId)
          .single();
        
        const callerName = callerProfile 
          ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() || 'Someone'
          : 'Someone';

        // Send missed call notification
        try {
          await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: remoteUserId,
              title: 'Missed Call',
              body: `You missed a call from ${callerName}`,
              tag: `missed-call-${currentCallId}`,
              type: 'message',
              data: {
                url: '/dashboard/parent/messages',
                callId: currentCallId,
                callerId: currentUserId,
                callerName,
              },
            }),
          });
        } catch (err) {
          console.warn('Failed to send missed call notification:', err);
        }

        setCallState('no-answer');
        setError('No answer');
        setShowRetryButton(true);
        
        // Cleanup streams but keep interface open for retry
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        
        // Don't auto-close - let user decide to retry or close
      }, CALL_TIMEOUT_MS);

      return () => {
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
      };
    }
  }, [callState, isIncoming, currentCallId, remoteUserId, currentUserId, supabase, onClose]);

  // End call
  const endCall = useCallback(async () => {
    // Clear call timeout if active
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Signal the other party
    if (currentCallId && remoteUserId && currentUserId) {
      await sendSignal(remoteUserId, 'call-ended', { reason: 'ended' }, currentCallId);
      
      // Update call status in database
      await supabase
        .from('active_calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('call_id', currentCallId);
    }

    // Stop ringback audio
    if (ringbackAudioRef.current) {
      ringbackAudioRef.current.pause();
      ringbackAudioRef.current.currentTime = 0;
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
    setShowRetryButton(false);
    onCallEnd?.();
    
    setTimeout(() => {
      onClose();
    }, 1000);
  }, [currentCallId, remoteUserId, currentUserId, supabase, sendSignal, onCallEnd, onClose]);

  // Retry call after no answer or failure
  const retryCall = useCallback(async () => {
    // Reset state for retry
    setCallState('idle');
    setError(null);
    setShowRetryButton(false);
    setCallDuration(0);
    pendingIceCandidatesRef.current = [];
    
    // Small delay then start call again
    setTimeout(() => {
      startCall();
    }, 100);
  }, [startCall]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) {
      // No stream yet, initialize with video
      try {
        const stream = await initializeLocalStream(true);
        // Add video track to peer connection if it exists
        if (peerConnectionRef.current && stream) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            } else {
              peerConnectionRef.current.addTrack(videoTrack, stream);
            }
          }
        }
        setIsVideoEnabled(true);
      } catch (err) {
        console.error('Failed to enable video:', err);
      }
      return;
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    } else {
      // No video track, need to add one
      try {
        const stream = await initializeLocalStream(true);
        if (peerConnectionRef.current && stream) {
          const newVideoTrack = stream.getVideoTracks()[0];
          if (newVideoTrack) {
            peerConnectionRef.current.addTrack(newVideoTrack, stream);
          }
        }
        setIsVideoEnabled(true);
      } catch (err) {
        console.error('Failed to add video track:', err);
      }
    }
  }, [initializeLocalStream]);

  // Switch camera (front/back)
  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    if (localStreamRef.current && isVideoEnabled) {
      try {
        // Stop current video track
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          currentVideoTrack.stop();
        }

        // Get new video track with different camera
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: newFacingMode
          }
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Replace track in local stream
        if (currentVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack);
        }
        localStreamRef.current.addTrack(newVideoTrack);

        // Update video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Replace track in peer connection
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }
      } catch (err) {
        console.error('Failed to switch camera:', err);
        // Revert facing mode on error
        setFacingMode(facingMode);
      }
    }
  }, [facingMode, isVideoEnabled]);

  // Add participant to call (placeholder for group call feature)
  const addParticipant = useCallback(async (userId: string, userName: string) => {
    // For now, just track participants locally
    // In a full implementation, this would initiate a new peer connection
    setParticipants(prev => [...prev, { id: userId, name: userName }]);
    setShowAddParticipants(false);
    
    // TODO: Implement actual multi-party call logic
    // This would involve:
    // 1. Creating a new peer connection for each participant
    // 2. Sending call invites to new participants
    // 3. Managing multiple video streams
    console.log('Adding participant:', userId, userName);
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

  // Toggle speaker/loudspeaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled((prev) => !prev);
    // Note: Web Audio API doesn't have native speaker toggle like mobile
    // This is a UI state that can be used for future implementation
    // On mobile apps, this would route audio to speaker vs earpiece
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
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            {/* Video call indicator */}
            {initialCallType === 'video' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: isVideoEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  fontSize: 11,
                  color: isVideoEnabled ? '#22c55e' : 'rgba(255, 255, 255, 0.6)',
                }}
              >
                <Video size={12} />
                {isVideoEnabled ? 'Camera on' : 'Camera off'}
              </span>
            )}
          </div>
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
            {callState === 'no-answer' && 'No answer'}
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
        {/* No Answer / Failed Overlay with Retry */}
        {(callState === 'no-answer' || callState === 'failed') && showRetryButton && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              gap: 24,
            }}
          >
            {/* Status icon */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                background: callState === 'no-answer' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PhoneOff size={40} color={callState === 'no-answer' ? '#fbbf24' : '#ef4444'} />
            </div>

            {/* Status text */}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'white' }}>
                {callState === 'no-answer' ? 'No Answer' : 'Call Failed'}
              </h3>
              <p style={{ margin: '8px 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
                {callState === 'no-answer' 
                  ? `${remoteUserName || 'User'} didn't answer`
                  : error || 'Unable to connect the call'
                }
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {/* Retry button */}
              <button
                onClick={retryCall}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 28px',
                  borderRadius: 28,
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)',
                }}
              >
                <Phone size={20} />
                Call Again
              </button>

              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 28px',
                  borderRadius: 28,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
                Close
              </button>
            </div>
          </div>
        )}

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
          <div style={{ position: 'relative' }}>
            {/* Pulsing ring animation for connecting/ringing states */}
            {(callState === 'connecting' || callState === 'ringing') && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    border: '2px solid rgba(124, 58, 237, 0.4)',
                    animation: 'pulse-ring 1.5s ease-out infinite',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 240,
                    height: 240,
                    borderRadius: '50%',
                    border: '2px solid rgba(124, 58, 237, 0.2)',
                    animation: 'pulse-ring 1.5s ease-out infinite 0.3s',
                  }}
                />
                <style>{`
                  @keyframes pulse-ring {
                    0% {
                      transform: translate(-50%, -50%) scale(0.8);
                      opacity: 1;
                    }
                    100% {
                      transform: translate(-50%, -50%) scale(1.4);
                      opacity: 0;
                    }
                  }
                `}</style>
              </>
            )}
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
                position: 'relative',
                zIndex: 1,
                boxShadow: (callState === 'connecting' || callState === 'ringing') 
                  ? '0 0 40px rgba(124, 58, 237, 0.5)' 
                  : 'none',
              }}
            >
              {(remoteUserName || 'U').charAt(0).toUpperCase()}
            </div>
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
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Secondary controls row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          {/* Switch camera (only show for video calls) */}
          {isVideoEnabled && (
            <button
              onClick={switchCamera}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Switch camera"
            >
              <SwitchCamera size={20} color="white" />
            </button>
          )}

          {/* Add participants */}
          <button
            onClick={() => setShowAddParticipants(true)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
            title="Add participant"
          >
            <UserPlus size={20} color="white" />
            {participants.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  background: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {participants.length + 1}
              </span>
            )}
          </button>
        </div>

        {/* Main controls row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
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

        {/* Speaker/Loudspeaker toggle */}
        <button
          onClick={toggleSpeaker}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: isSpeakerEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            border: isSpeakerEnabled ? '2px solid rgba(34, 197, 94, 0.5)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title={isSpeakerEnabled ? 'Speaker on' : 'Speaker off'}
        >
          {isSpeakerEnabled ? (
            <Volume2 size={24} color="#22c55e" />
          ) : (
            <VolumeX size={24} color="white" />
          )}
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: isVideoEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.3)',
            border: isVideoEnabled ? '2px solid rgba(34, 197, 94, 0.5)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <Video size={24} color="#22c55e" />
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

      {/* Add Participants Modal */}
      {showAddParticipants && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          onClick={() => setShowAddParticipants(false)}
        >
          <div
            style={{
              background: '#1a1a2e',
              borderRadius: 16,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              maxHeight: '70vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 600 }}>
                <Users size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Add to Call
              </h3>
              <button
                onClick={() => setShowAddParticipants(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="white" />
              </button>
            </div>

            {/* Current participants */}
            {participants.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 8 }}>
                  In this call ({participants.length + 1})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: 16,
                      background: 'var(--primary)',
                      color: 'white',
                      fontSize: 13,
                    }}
                  >
                    You
                  </div>
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 16,
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: 13,
                      }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add participants hint */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.05)',
                textAlign: 'center',
              }}
            >
              <Users size={32} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>
                Group calls coming soon!
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '8px 0 0' }}>
                You&apos;ll be able to add teachers and other parents to your calls.
              </p>
            </div>
          </div>
        </div>
      )}
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