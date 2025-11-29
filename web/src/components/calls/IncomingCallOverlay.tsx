'use client';

import { Phone, PhoneOff, Video, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';

interface IncomingCallOverlayProps {
  callerName?: string;
  callType: 'voice' | 'video';
  onAnswer: () => void;
  onReject: () => void;
  isVisible: boolean;
  isConnecting?: boolean;
}

export function IncomingCallOverlay({
  callerName = 'Unknown',
  callType,
  onAnswer,
  onReject,
  isVisible,
  isConnecting = false,
}: IncomingCallOverlayProps) {
  const [ringCount, setRingCount] = useState(0);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [hasUserInteraction, setHasUserInteraction] = useState(false);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio with user gesture fallback
  const initializeAudio = useCallback(() => {
    if (ringtoneRef.current) return;
    
    try {
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      audio.volume = 1.0; // Maximum volume
      audio.preload = 'auto';
      ringtoneRef.current = audio;
      console.log('[IncomingCall] Ringtone audio initialized at max volume');
    } catch (err) {
      console.warn('[IncomingCall] Failed to initialize audio:', err);
    }
  }, []);

  // Try to play ringtone
  const playRingtone = useCallback(async () => {
    if (!ringtoneRef.current) {
      initializeAudio();
    }
    
    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.currentTime = 0;
        await ringtoneRef.current.play();
        setAudioInitialized(true);
        console.log('[IncomingCall] Ringtone playing');
      } catch (err) {
        console.warn('[IncomingCall] Ringtone autoplay blocked, will play on interaction:', err);
        // Will try again when user interacts with the page
      }
    }
  }, [initializeAudio]);

  // Stop ringtone
  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    // Stop any ongoing vibration
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (err) {
        // Ignore vibration errors
      }
    }
  }, []);

  // Track first user interaction so we can safely trigger audio/vibration
  useEffect(() => {
    if (hasUserInteraction) return;

    const markInteraction = () => {
      setHasUserInteraction(true);
    };

    window.addEventListener('pointerdown', markInteraction, { once: true });
    window.addEventListener('keydown', markInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
    };
  }, [hasUserInteraction]);

  // Ensure audio element is lazily created when overlay mounts
  useEffect(() => {
    if (isVisible) {
      initializeAudio();
    }
  }, [isVisible, initializeAudio]);

  // Play ringtone when visible - vibration is only triggered on user interaction (answer/reject)
  useEffect(() => {
    if (!isVisible) {
      setRingCount(0);
      stopRingtone();
      return;
    }

    if (!hasUserInteraction) {
      console.log('[IncomingCall] Waiting for user interaction before playing ringtone');
      return;
    }

    console.log('[IncomingCall] Incoming call visible, starting ringtone');
    playRingtone();

    // NOTE: navigator.vibrate() requires a user gesture (click/tap) to work in modern browsers.
    // Calling it automatically here causes "[Intervention] Blocked call to navigator.vibrate"
    // warnings in Chrome. Vibration is now triggered in handleAnswer/handleReject callbacks.
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate#security

    // Retry playing audio every 2 seconds if it failed initially
    const retryInterval = setInterval(() => {
      if (ringtoneRef.current?.paused && isVisible) {
        playRingtone();
      }
    }, 2000);

    return () => {
      clearInterval(retryInterval);
      stopRingtone();
    };
  }, [isVisible, hasUserInteraction, playRingtone, stopRingtone]);

  // Handle user interaction to enable audio
  const handleInteraction = useCallback(() => {
    if (!hasUserInteraction) {
      setHasUserInteraction(true);
    }

    if (!audioInitialized && isVisible) {
      playRingtone();
    }
  }, [audioInitialized, hasUserInteraction, isVisible, playRingtone]);

  // Handle answer with haptic feedback
  const handleAnswer = useCallback(() => {
    // Provide haptic feedback on user gesture (this is allowed)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(100);
      } catch (err) {
        // Ignore vibration errors
      }
    }
    stopRingtone();
    onAnswer();
  }, [onAnswer, stopRingtone]);

  // Handle reject with haptic feedback
  const handleReject = useCallback(() => {
    // Provide haptic feedback on user gesture (this is allowed)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(50);
      } catch (err) {
        // Ignore vibration errors
      }
    }
    stopRingtone();
    onReject();
  }, [onReject, stopRingtone]);

  // Visual pulse effect counter
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setRingCount((prev) => prev + 1);
    }, 1500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      onClick={handleInteraction}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Pulsing avatar */}
      <div
        style={{
          position: 'relative',
          width: 140,
          height: 140,
          marginBottom: 32,
        }}
      >
        {/* Outer pulse rings */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140 + i * 30,
              height: 140 + i * 30,
              borderRadius: '50%',
              border: `2px solid ${callType === 'video' ? '#3b82f6' : '#22c55e'}`,
              opacity: 0.3 - i * 0.1,
              animation: `pulse-ring 1.5s ease-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
        
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
            background: callType === 'video' 
              ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
              : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 40px ${callType === 'video' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`,
          }}
        >
          {callType === 'video' ? (
            <Video size={48} color="white" />
          ) : (
            <Phone size={48} color="white" style={{ animation: 'shake 0.5s ease-in-out infinite' }} />
          )}
        </div>
      </div>

      {/* Caller info */}
      <h2
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'white',
          margin: 0,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        {callerName}
      </h2>
      
      <p
        style={{
          fontSize: 16,
          color: 'rgba(255, 255, 255, 0.7)',
          margin: 0,
          marginBottom: 60,
          textAlign: 'center',
        }}
      >
        {isConnecting ? 'Connecting...' : `Incoming ${callType} call...`}
      </p>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 48,
          alignItems: 'center',
        }}
      >
        {/* Reject button */}
        <button
          onClick={handleReject}
          disabled={isConnecting}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: isConnecting 
              ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            boxShadow: isConnecting 
              ? '0 8px 24px rgba(107, 114, 128, 0.4)'
              : '0 8px 24px rgba(239, 68, 68, 0.4)',
            transition: 'transform 0.2s ease',
            opacity: isConnecting ? 0.6 : 1,
          }}
          onMouseEnter={(e) => !isConnecting && (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <PhoneOff size={32} color="white" />
        </button>

        {/* Accept button */}
        <button
          onClick={handleAnswer}
          disabled={isConnecting}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: isConnecting 
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            boxShadow: isConnecting 
              ? '0 8px 24px rgba(59, 130, 246, 0.4)'
              : '0 8px 24px rgba(34, 197, 94, 0.4)',
            transition: 'transform 0.2s ease',
            animation: isConnecting ? 'none' : 'bounce-slight 1s ease-in-out infinite',
          }}
          onMouseEnter={(e) => !isConnecting && (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isConnecting ? (
            <Loader2 size={32} color="white" style={{ animation: 'spin 1s linear infinite' }} />
          ) : callType === 'video' ? (
            <Video size={32} color="white" />
          ) : (
            <Phone size={32} color="white" />
          )}
        </button>
      </div>

      {/* Labels */}
      <div
        style={{
          display: 'flex',
          gap: 48,
          marginTop: 16,
        }}
      >
        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, width: 72, textAlign: 'center' }}>
          Decline
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, width: 72, textAlign: 'center' }}>
          {isConnecting ? 'Connecting...' : 'Accept'}
        </span>
      </div>

      {/* Keyframes animation styles */}
      <style jsx global>{`
        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        
        @keyframes bounce-slight {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
