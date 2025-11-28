'use client';

import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface IncomingCallOverlayProps {
  callerName?: string;
  callType: 'voice' | 'video';
  onAnswer: () => void;
  onReject: () => void;
  isVisible: boolean;
}

export function IncomingCallOverlay({
  callerName = 'Unknown',
  callType,
  onAnswer,
  onReject,
  isVisible,
}: IncomingCallOverlayProps) {
  const [ringCount, setRingCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone and vibrate
  useEffect(() => {
    if (!isVisible) {
      setRingCount(0);
      return;
    }

    // Try to vibrate (mobile devices)
    if ('vibrate' in navigator) {
      const vibratePattern = [200, 100, 200, 100, 200, 500];
      const interval = setInterval(() => {
        navigator.vibrate(vibratePattern);
      }, 2000);
      
      return () => {
        clearInterval(interval);
        navigator.vibrate(0);
      };
    }
  }, [isVisible]);

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
        Incoming {callType} call...
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
          onClick={onReject}
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
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <PhoneOff size={32} color="white" />
        </button>

        {/* Accept button */}
        <button
          onClick={onAnswer}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
            transition: 'transform 0.2s ease',
            animation: 'bounce-slight 1s ease-in-out infinite',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {callType === 'video' ? (
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
          Accept
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
      `}</style>
    </div>
  );
}
