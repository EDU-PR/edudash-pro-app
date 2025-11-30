'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNotificationSound, playNotificationSound } from '@/hooks/useNotificationSound';
import { lockOrientation } from '@/hooks/useOrientationLock';

interface NativeAppManagerProps {
  /** Whether to lock orientation to portrait by default */
  lockOrientationOnMount?: boolean;
  /** Whether to enable notification sounds */
  enableSounds?: boolean;
  /** Callback when a push message is received while app is in foreground */
  onPushMessage?: (data: any) => void;
  /** Callback when notification is clicked */
  onNotificationClick?: (url: string, type?: string) => void;
}

/**
 * Component that manages native app-like behavior:
 * - Status bar integration (theme-color updates)
 * - Notification sounds
 * - Screen orientation locking
 * - Push notification handling in foreground
 * - Service worker message handling
 */
export function NativeAppManager({
  lockOrientationOnMount = true,
  enableSounds = true,
  onPushMessage,
  onNotificationClick,
}: NativeAppManagerProps) {
  const { playNotification } = useNotificationSound();
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lock orientation on mount
  useEffect(() => {
    if (lockOrientationOnMount) {
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => {
        lockOrientation('portrait');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lockOrientationOnMount]);

  // Handle service worker messages
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      
      if (!data || typeof data !== 'object') return;

      // Handle notification click from service worker
      if (data.type === 'NOTIFICATION_CLICK') {
        if (onNotificationClick) {
          onNotificationClick(data.url, data.notificationType);
        } else if (data.url) {
          window.location.href = data.url;
        }
      }

      // Handle push message while app is in foreground
      if (data.type === 'PUSH_RECEIVED') {
        if (enableSounds) {
          // Play notification sound based on type
          if (data.notificationType === 'call') {
            playNotificationSound('ringtone', { loop: false });
          } else {
            playNotification();
          }
        }

        if (onPushMessage) {
          onPushMessage(data);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [enableSounds, playNotification, onPushMessage, onNotificationClick]);

  // Handle visibility change to update status bar and clear badge
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateThemeColor = () => {
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        // Keep consistent dark theme
        metaThemeColor.setAttribute('content', '#111111');
      }
    };

    const handleVisibilityChange = () => {
      updateThemeColor();
      
      // Clear app badge when user returns to the app
      if (!document.hidden && 'clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(() => {
          // Badge API not supported or failed
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Prevent pull-to-refresh on mobile (native app behavior)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (!isPWA) return;

    // Prevent overscroll/pull-to-refresh
    let lastTouchY = 0;
    
    const preventPullToRefresh = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      
      // If at top of page and trying to scroll down, prevent
      if (scrollTop <= 0 && touchY > lastTouchY) {
        e.preventDefault();
      }
      
      lastTouchY = touchY;
    };

    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, []);

  // Handle wake lock (keep screen on during calls)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Wake lock will be managed by call components
    // This is just setup for the API availability

    const checkWakeLockSupport = async () => {
      if ('wakeLock' in navigator) {
        console.log('[NativeApp] Wake lock is supported');
      }
    };

    checkWakeLockSupport();
  }, []);

  // Clear any pending notification timeouts on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  return null; // This is a logic-only component
}

/**
 * Show an in-app notification toast with sound
 * Use this for notifications when the app is in the foreground
 */
export function showInAppNotification(
  title: string,
  body: string,
  options: {
    sound?: boolean;
    vibrate?: boolean;
    duration?: number;
    onClick?: () => void;
    type?: 'message' | 'call' | 'announcement' | 'general';
  } = {}
) {
  const { sound = true, vibrate = true, duration = 5000, onClick, type = 'general' } = options;

  // Play sound
  if (sound) {
    if (type === 'call') {
      playNotificationSound('ringtone', { loop: false, vibrate });
    } else {
      playNotificationSound('notification', { vibrate });
    }
  } else if (vibrate && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Vibration not supported or failed
    }
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'in-app-notification';
  notification.innerHTML = `
    <div class="in-app-notification-content">
      <div class="in-app-notification-icon">
        ${type === 'call' ? '📞' : type === 'message' ? '💬' : type === 'announcement' ? '📢' : '🔔'}
      </div>
      <div class="in-app-notification-text">
        <div class="in-app-notification-title">${escapeHtml(title)}</div>
        <div class="in-app-notification-body">${escapeHtml(body)}</div>
      </div>
      <button class="in-app-notification-close" aria-label="Close">&times;</button>
    </div>
  `;

  // Add styles if not already present
  if (!document.getElementById('in-app-notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'in-app-notification-styles';
    styles.textContent = `
      .in-app-notification {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        padding: 12px;
        padding-top: max(12px, env(safe-area-inset-top));
        animation: slideDown 0.3s ease-out;
        pointer-events: auto;
      }
      .in-app-notification-content {
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        max-width: 480px;
        margin: 0 auto;
      }
      .in-app-notification-icon {
        font-size: 28px;
        flex-shrink: 0;
      }
      .in-app-notification-text {
        flex: 1;
        min-width: 0;
      }
      .in-app-notification-title {
        font-weight: 600;
        font-size: 15px;
        color: white;
        margin-bottom: 2px;
      }
      .in-app-notification-body {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .in-app-notification-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .in-app-notification-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  // Add to DOM
  document.body.appendChild(notification);

  // Handle click
  const handleClick = (e: Event) => {
    if ((e.target as HTMLElement).classList.contains('in-app-notification-close')) {
      dismiss();
    } else if (onClick) {
      onClick();
      dismiss();
    }
  };

  notification.addEventListener('click', handleClick);

  // Dismiss function
  const dismiss = () => {
    notification.style.animation = 'slideUp 0.3s ease-out forwards';
    setTimeout(() => {
      notification.removeEventListener('click', handleClick);
      notification.remove();
    }, 300);
  };

  // Auto-dismiss after duration
  const timeoutId = setTimeout(dismiss, duration);

  // Return dismiss function for manual control
  return () => {
    clearTimeout(timeoutId);
    dismiss();
  };
}

// Helper to escape HTML - uses pure string replacement for safety
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  return text.replace(/[&<>"'`=/]/g, (char) => escapeMap[char] || char);
}

export default NativeAppManager;
