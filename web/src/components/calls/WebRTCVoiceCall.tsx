'use client';

/**
 * WebRTC Voice Call Interface
 * Pure WebRTC implementation for P2P voice calls - no Daily.co overhead
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, User, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { WebRTCVoiceCall, WebRTCCallState } from '@/lib/services/webrtcService';
import RingtoneService from '@/lib/services/ringtoneService';

interface WebRTCVoiceCallProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  calleeName: string;
  calleeId?: string;
  isInitiator: boolean; // true = caller, false = callee
}

export function WebRTCVoiceCallInterface({
  isOpen,
  onClose,
  callId,
  calleeName,
  calleeId,
  isInitiator,
}: WebRTCVoiceCallProps) {
  const [callState, setCallState] = useState<WebRTCCallState>({
    status: 'idle',
    isMuted: false,
    isSpeakerOn: true,
    remoteStream: null,
    localStream: null,
    error: null,
  });
  const [callDuration, setCallDuration] = useState(0);

  const webrtcRef = useRef<WebRTCVoiceCall | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringbackRef = useRef<HTMLAudioElement | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle state changes from WebRTC service
  const handleStateChange = useCallback((newState: Partial<WebRTCCallState>) => {
    setCallState((prev) => ({ ...prev, ...newState }));
  }, []);

  // Handle call ended
  const handleCallEnded = useCallback((reason: string) => {
    console.log('[WebRTCVoiceCall] Call ended:', reason);
    stopRingback();
    onClose();
  }, [onClose]);

  // Start ringback tone for caller
  const startRingback = useCallback(async () => {
    try {
      const audio = await RingtoneService.playRingtone('outgoing', { loop: true });
      ringbackRef.current = audio;
    } catch (err) {
      console.warn('[WebRTCVoiceCall] Failed to play ringback:', err);
    }
  }, []);

  // Stop ringback tone
  const stopRingback = useCallback(() => {
    if (ringbackRef.current) {
      RingtoneService.stopRingtone(ringbackRef.current);
      ringbackRef.current = null;
    }
  }, []);

  // Initialize WebRTC call
  useEffect(() => {
    if (!isOpen || !callId) return;

    const initCall = async () => {
      try {
        // Play ringback if we're the caller
        if (isInitiator) {
          await startRingback();
        }

        // Create WebRTC call instance
        webrtcRef.current = new WebRTCVoiceCall({
          callId,
          isInitiator,
          remoteUserId: calleeId || '',
          onStateChange: handleStateChange,
          onCallEnded: handleCallEnded,
        });

        await webrtcRef.current.initialize();
      } catch (error) {
        console.error('[WebRTCVoiceCall] Failed to initialize:', error);
        handleStateChange({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to start call',
        });
      }
    };

    initCall();

    return () => {
      stopRingback();
      if (webrtcRef.current) {
        webrtcRef.current.cleanup();
        webrtcRef.current = null;
      }
    };
  }, [isOpen, callId, isInitiator, calleeId, handleStateChange, handleCallEnded, startRingback, stopRingback]);

  // Handle remote stream - play audio
  useEffect(() => {
    if (callState.remoteStream && audioRef.current) {
      audioRef.current.srcObject = callState.remoteStream;
      audioRef.current.play().catch((err) => {
        console.warn('[WebRTCVoiceCall] Failed to play remote audio:', err);
      });

      // Stop ringback when connected
      stopRingback();

      // Start call timer
      callStartTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callState.remoteStream, stopRingback]);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (webrtcRef.current) {
      webrtcRef.current.toggleMute();
      setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, []);

  // Toggle speaker
  const handleToggleSpeaker = useCallback(() => {
    if (audioRef.current) {
      const newValue = !callState.isSpeakerOn;
      audioRef.current.volume = newValue ? 1 : 0.1; // Low volume vs normal
      setCallState((prev) => ({ ...prev, isSpeakerOn: newValue }));
    }
  }, [callState.isSpeakerOn]);

  // End call
  const handleEndCall = useCallback(async () => {
    stopRingback();

    if (webrtcRef.current) {
      await webrtcRef.current.endCall();
    }

    // Update database status
    try {
      await supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('call_id', callId);
    } catch (error) {
      console.error('[WebRTCVoiceCall] Failed to update call status:', error);
    }

    onClose();
  }, [callId, onClose, stopRingback, supabase]);

  if (!isOpen) return null;

  const isConnected = callState.status === 'connected';
  const isConnecting = callState.status === 'connecting' || callState.status === 'ringing';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Hidden audio element for remote stream */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Close button */}
      <button
        onClick={handleEndCall}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: 8,
          padding: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={24} color="white" />
      </button>

      {/* Call type indicator */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34, 197, 94, 0.2)',
          padding: '8px 16px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Phone size={16} color="#22c55e" />
        <span style={{ color: '#22c55e', fontSize: 14, fontWeight: 500 }}>Voice Call</span>
      </div>

      {/* Avatar with pulse animation */}
      <div
        style={{
          position: 'relative',
          width: 140,
          height: 140,
          marginBottom: 24,
        }}
      >
        {/* Pulse rings when connecting */}
        {isConnecting && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `calc(100% + ${i * 30}px)`,
                  height: `calc(100% + ${i * 30}px)`,
                  borderRadius: '50%',
                  border: '2px solid rgba(34, 197, 94, 0.3)',
                  animation: `pulse-ring 1.5s ease-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </>
        )}

        {/* Sound wave animation when connected */}
        {isConnected && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '130%',
              height: '130%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 4,
                  height: 20 + Math.random() * 30,
                  background: 'rgba(34, 197, 94, 0.5)',
                  borderRadius: 2,
                  animation: `sound-wave 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Avatar circle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
          }}
        >
          <User size={48} color="white" />
        </div>
      </div>

      {/* Callee name */}
      <h2
        style={{
          color: 'white',
          fontSize: 28,
          fontWeight: 600,
          margin: 0,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        {calleeName}
      </h2>

      {/* Call status / duration */}
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 16,
          margin: 0,
          marginBottom: 48,
        }}
      >
        {callState.status === 'connecting' && 'Connecting...'}
        {callState.status === 'ringing' && 'Ringing...'}
        {callState.status === 'connected' && formatDuration(callDuration)}
        {callState.status === 'failed' && (callState.error || 'Call failed')}
        {callState.status === 'ended' && 'Call ended'}
      </p>

      {/* Error message */}
      {callState.error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            padding: '12px 20px',
            borderRadius: 12,
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          {callState.error}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
        }}
      >
        {/* Mute button */}
        <button
          onClick={handleToggleMute}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: callState.isMuted
              ? 'rgba(239, 68, 68, 0.2)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {callState.isMuted ? (
            <MicOff size={28} color="#ef4444" />
          ) : (
            <Mic size={28} color="white" />
          )}
        </button>

        {/* End call button */}
        <button
          onClick={handleEndCall}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
            transition: 'transform 0.2s ease',
          }}
        >
          <PhoneOff size={32} color="white" />
        </button>

        {/* Speaker button */}
        <button
          onClick={handleToggleSpeaker}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: !callState.isSpeakerOn
              ? 'rgba(239, 68, 68, 0.2)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {callState.isSpeakerOn ? (
            <Volume2 size={28} color="white" />
          ) : (
            <VolumeX size={28} color="#ef4444" />
          )}
        </button>
      </div>

      {/* Control labels */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginTop: 12,
        }}
      >
        <span style={{ width: 64, textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
          {callState.isMuted ? 'Unmute' : 'Mute'}
        </span>
        <span style={{ width: 72, textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
          End
        </span>
        <span style={{ width: 64, textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
          Speaker
        </span>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 0;
          }
        }

        @keyframes sound-wave {
          0%, 100% {
            transform: scaleY(0.5);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}

export default WebRTCVoiceCallInterface;
