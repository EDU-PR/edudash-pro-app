'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Image from 'next/image';

interface PWASplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function PWASplashScreen({ onComplete, duration = 4000 }: PWASplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth progress bar animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / (duration / 50));
      });
    }, 50);

    // Animation sequence
    const timers = [
      setTimeout(() => setStep(1), 150),   // Logo appears
      setTimeout(() => setStep(2), 600),   // Rings expand
      setTimeout(() => setStep(3), 1800),  // Sparkle effect
      setTimeout(() => setStep(4), 3000),  // Fade out prep
      setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration),
    ];

    return () => {
      clearInterval(progressInterval);
      timers.forEach(clearTimeout);
    };
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className="pwa-splash-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 25%, #2d1b4e 50%, #1a0a2e 75%, #0a0a0f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: step >= 4 ? 0 : 1,
        transition: 'opacity 0.8s ease-out',
      }}
    >
      {/* Animated gradient blobs */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: 0.15
      }}>
        <div 
          className="blob-1"
          style={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            filter: 'blur(80px)',
            animation: 'blob-float 12s ease-in-out infinite',
            opacity: step >= 1 ? 1 : 0,
            transition: 'opacity 0.6s ease-out'
          }}
        />
        <div 
          className="blob-2"
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '10%',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ec4899, #7c3aed)',
            filter: 'blur(80px)',
            animation: 'blob-float 12s ease-in-out infinite 3s',
            opacity: step >= 1 ? 1 : 0,
            transition: 'opacity 0.6s ease-out 0.2s'
          }}
        />
      </div>

      {/* Main content */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '40px'
      }}>
        {/* Animated rings and logo */}
        <div style={{
          position: 'relative',
          width: '180px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Outer ring */}
          <div style={{
            position: 'absolute',
            width: step >= 2 ? '180px' : '140px',
            height: step >= 2 ? '180px' : '140px',
            borderRadius: '50%',
            border: '3px solid rgba(124, 58, 237, 0.3)',
            opacity: step >= 2 ? 0.6 : 0,
            transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: step >= 2 ? 'spin-slow 30s linear infinite' : 'none'
          }} />
          
          {/* Middle ring */}
          <div style={{
            position: 'absolute',
            width: step >= 2 ? '160px' : '140px',
            height: step >= 2 ? '160px' : '140px',
            borderRadius: '50%',
            border: '3px solid rgba(168, 85, 247, 0.4)',
            opacity: step >= 2 ? 0.8 : 0,
            transition: 'all 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s',
            animation: step >= 2 ? 'spin-slow 25s linear infinite reverse' : 'none'
          }} />
          
          {/* Logo circle with actual app icon */}
          <div style={{
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: step >= 1 ? '0 20px 60px rgba(124, 58, 237, 0.5), 0 0 80px rgba(236, 72, 153, 0.3)' : 'none',
            transform: step >= 1 ? 'scale(1)' : 'scale(0.3)',
            opacity: step >= 1 ? 1 : 0,
            transition: 'all 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: step >= 1 ? 'float-gentle 4s ease-in-out infinite' : 'none'
          }}>
            <Image 
              src="/icon-192.png" 
              alt="EduDash Pro" 
              width={140} 
              height={140}
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>

          {/* Sparkle effect */}
          {step >= 3 && (
            <>
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '20px',
                animation: 'sparkle-pop 0.6s ease-out, float-sparkle 2s ease-in-out infinite',
                opacity: 0.9
              }}>
                <Sparkles size={32} color="#fbbf24" strokeWidth={2} />
              </div>
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '15px',
                animation: 'sparkle-pop 0.6s ease-out 0.2s, float-sparkle 2.5s ease-in-out infinite',
                opacity: 0.8
              }}>
                <Sparkles size={24} color="#ec4899" strokeWidth={2} />
              </div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '-10px',
                animation: 'sparkle-pop 0.6s ease-out 0.4s, float-sparkle 3s ease-in-out infinite',
                opacity: 0.7
              }}>
                <Sparkles size={20} color="#7c3aed" strokeWidth={2} />
              </div>
            </>
          )}
        </div>

        {/* Text */}
        <div 
          style={{
            textAlign: 'center',
            opacity: step >= 1 ? 1 : 0,
            transform: step >= 1 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out 0.3s'
          }}
        >
          <h1 style={{
            fontSize: '42px',
            fontWeight: 700,
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em'
          }}>
            EduDash Pro
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#a0a0a0',
            fontWeight: 500,
            letterSpacing: '0.05em'
          }}>
            AI-Powered Educational Platform
          </p>
          
          {/* Loading progress bar */}
          <div style={{
            width: '240px',
            height: '4px',
            background: 'rgba(124, 58, 237, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '24px',
            opacity: step >= 1 ? 1 : 0,
            transition: 'opacity 0.4s ease-out 0.5s'
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #ec4899, #7c3aed)',
              backgroundSize: '200% 100%',
              borderRadius: '2px',
              transition: 'width 0.1s linear',
              animation: 'gradient-shift 2s ease infinite',
              boxShadow: '0 0 10px rgba(124, 58, 237, 0.6)'
            }} />
          </div>

          {/* Loading text */}
          <p style={{
            fontSize: '13px',
            color: '#666',
            marginTop: '12px',
            fontWeight: 500,
            opacity: step >= 1 ? 0.7 : 0,
            transition: 'opacity 0.4s ease-out 0.6s'
          }}>
            {progress < 30 ? 'Initializing...' : progress < 70 ? 'Loading resources...' : progress < 95 ? 'Almost ready...' : 'Ready!'}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes blob-float {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(40px, -60px) scale(1.1);
          }
          66% {
            transform: translate(-30px, 30px) scale(0.9);
          }
        }

        @keyframes float-gentle {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes rotate-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes sparkle-pop {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.3) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(360deg);
            opacity: 0.9;
          }
        }

        @keyframes float-sparkle {
          0%, 100% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) translateX(5px) rotate(180deg);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 20px 60px rgba(124, 58, 237, 0.5), 0 0 80px rgba(236, 72, 153, 0.3);
          }
          50% {
            box-shadow: 0 20px 80px rgba(124, 58, 237, 0.7), 0 0 100px rgba(236, 72, 153, 0.5);
          }
        }
      `}</style>
    </div>
  );
}
