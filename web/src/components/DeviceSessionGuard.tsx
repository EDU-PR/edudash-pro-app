'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  registerDeviceSession,
  isDeviceSessionActive,
  updateDeviceHeartbeat,
  deactivateDeviceSession,
  listenForSessionInvalidation,
  formatLastSeen,
} from '@/lib/services/deviceSessionService';
import { Smartphone, Monitor, Tablet, AlertCircle } from 'lucide-react';

/**
 * DeviceSessionGuard Component
 * 
 * Ensures only one active device session per user (WhatsApp-style).
 * Shows modal when user logs in on another device.
 */
export function DeviceSessionGuard() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [otherDeviceInfo, setOtherDeviceInfo] = useState<{
    platform: string;
    browser: string;
    lastSeen: string;
  } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize device session
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setUserId(session.user.id);

      // Register device session
      const result = await registerDeviceSession(session.user.id);
      
      if (result.success && result.isNewDevice && result.otherDeviceInfo) {
        // Show modal if logged in from new device
        setOtherDeviceInfo(result.otherDeviceInfo);
        setShowModal(true);
      }
    };

    initSession();
  }, [supabase]);

  // Listen for session invalidation (another device logged in)
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = listenForSessionInvalidation(userId, async () => {
      // This device's session was invalidated
      setShowModal(false);
      await handleLogout(true);
    });

    return unsubscribe;
  }, [userId]);

  // Heartbeat to keep session alive
  useEffect(() => {
    if (!userId) return;

    // Update heartbeat every 30 seconds
    const interval = setInterval(async () => {
      await updateDeviceHeartbeat(userId);
      
      // Check if session is still active
      const isActive = await isDeviceSessionActive(userId);
      if (!isActive) {
        // Session was deactivated, log out
        await handleLogout(true);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userId]);

  // Handle logout
  const handleLogout = async (forced = false) => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      if (userId) {
        await deactivateDeviceSession(userId);
      }
      await supabase.auth.signOut();
      
      if (forced) {
        // Show message that they were logged out
        router.push('/sign-in?reason=logged_out_other_device');
      } else {
        router.push('/sign-in');
      }
    } catch (error) {
      console.error('[DeviceSessionGuard] Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Dismiss modal and continue on this device
  const handleContinue = () => {
    setShowModal(false);
  };

  // Get device icon based on platform
  const getDeviceIcon = (platform: string) => {
    if (platform.includes('Android') || platform.includes('iOS')) {
      return <Smartphone className="w-16 h-16 text-orange-500" />;
    }
    if (platform.includes('Mac') || platform.includes('Windows') || platform.includes('Linux')) {
      return <Monitor className="w-16 h-16 text-blue-500" />;
    }
    return <Tablet className="w-16 h-16 text-purple-500" />;
  };

  if (!showModal || !otherDeviceInfo) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 32,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          {getDeviceIcon(otherDeviceInfo.platform)}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#111',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Using EduDash Pro on this device?
        </h2>

        {/* Description */}
        <div
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            gap: 12,
          }}
        >
          <AlertCircle style={{ width: 20, height: 20, color: '#D97706', flexShrink: 0 }} />
          <p style={{ fontSize: 14, color: '#92400E', margin: 0 }}>
            You were previously logged in on <strong>{otherDeviceInfo.platform}</strong> using{' '}
            <strong>{otherDeviceInfo.browser}</strong>. That device has been logged out.
          </p>
        </div>

        <p
          style={{
            fontSize: 14,
            color: '#6B7280',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Last active: {formatLastSeen(otherDeviceInfo.lastSeen)}
        </p>

        <p
          style={{
            fontSize: 14,
            color: '#6B7280',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          You can only use EduDash Pro on one device at a time for security.
        </p>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '14px 24px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22c55e')}
        >
          Continue on this device
        </button>
      </div>
    </div>
  );
}
