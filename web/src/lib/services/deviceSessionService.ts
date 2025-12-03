'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Device Session Management
 * Similar to WhatsApp - only one active device per user at a time
 */

interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  platform: string;
  browser: string;
  lastSeen: string;
}

/**
 * Generate a unique device ID based on browser fingerprint
 */
export function generateDeviceId(): string {
  // Try to get existing device ID from localStorage
  const existingId = localStorage.getItem('edudash_device_id');
  if (existingId) return existingId;

  // Create new device ID using browser fingerprint
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency,
    navigator.maxTouchPoints,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');

  // Hash the fingerprint to create a unique ID
  const hashCode = fingerprint.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
  }, 0);

  const deviceId = `device_${Math.abs(hashCode)}_${Date.now()}`;
  localStorage.setItem('edudash_device_id', deviceId);
  return deviceId;
}

/**
 * Get device information
 */
export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let platform = 'Unknown';

  // Detect browser
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  // Detect platform
  if (ua.includes('Android')) platform = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) platform = 'iOS';
  else if (ua.includes('Windows')) platform = 'Windows';
  else if (ua.includes('Mac')) platform = 'macOS';
  else if (ua.includes('Linux')) platform = 'Linux';

  return {
    deviceId: generateDeviceId(),
    userAgent: ua,
    platform,
    browser,
    lastSeen: new Date().toISOString(),
  };
}

/**
 * Register current device as active session
 * Returns true if successful, false if another device is active
 */
export async function registerDeviceSession(userId: string): Promise<{
  success: boolean;
  isNewDevice: boolean;
  otherDeviceInfo?: {
    platform: string;
    browser: string;
    lastSeen: string;
  };
}> {
  try {
    const supabase = createClient();
    const deviceInfo = getDeviceInfo();

    // Check for existing active session
    const { data: existingSessions } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('device_id', deviceInfo.deviceId)
      .order('last_active_at', { ascending: false });

    const hasOtherActiveDevice = existingSessions && existingSessions.length > 0;
    const otherDevice = existingSessions?.[0];

    if (hasOtherActiveDevice) {
      // Deactivate all other sessions
      await supabase
        .from('user_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('user_id', userId)
        .neq('device_id', deviceInfo.deviceId);
    }

    // Upsert current device session
    const { error } = await supabase
      .from('user_sessions')
      .upsert({
        user_id: userId,
        device_id: deviceInfo.deviceId,
        user_agent: deviceInfo.userAgent,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        last_active_at: deviceInfo.lastSeen,
        is_active: true,
        started_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_id',
      });

    if (error) {
      console.error('[DeviceSession] Failed to register session:', error);
      return { success: false, isNewDevice: false };
    }

    return {
      success: true,
      isNewDevice: hasOtherActiveDevice,
      otherDeviceInfo: otherDevice ? {
        platform: otherDevice.platform,
        browser: otherDevice.browser,
        lastSeen: otherDevice.last_active_at,
      } : undefined,
    };
  } catch (error) {
    console.error('[DeviceSession] Error registering device:', error);
    return { success: false, isNewDevice: false };
  }
}

/**
 * Check if current device has an active session
 */
export async function isDeviceSessionActive(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const deviceInfo = getDeviceInfo();

    const { data } = await supabase
      .from('user_sessions')
      .select('is_active')
      .eq('user_id', userId)
      .eq('device_id', deviceInfo.deviceId)
      .eq('is_active', true)
      .maybeSingle();

    return !!data;
  } catch (error) {
    console.error('[DeviceSession] Error checking session:', error);
    return false;
  }
}

/**
 * Update last seen timestamp for current device
 */
export async function updateDeviceHeartbeat(userId: string): Promise<void> {
  try {
    const supabase = createClient();
    const deviceInfo = getDeviceInfo();

    await supabase
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceInfo.deviceId);
  } catch (error) {
    console.error('[DeviceSession] Error updating heartbeat:', error);
  }
}

/**
 * Deactivate current device session (logout)
 */
export async function deactivateDeviceSession(userId: string): Promise<void> {
  try {
    const supabase = createClient();
    const deviceInfo = getDeviceInfo();

    await supabase
      .from('user_sessions')
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString() 
      })
      .eq('user_id', userId)
      .eq('device_id', deviceInfo.deviceId);

    // Clear device ID from localStorage
    localStorage.removeItem('edudash_device_id');
  } catch (error) {
    console.error('[DeviceSession] Error deactivating session:', error);
  }
}

/**
 * Listen for session invalidation (when user logs in on another device)
 */
export function listenForSessionInvalidation(
  userId: string,
  onInvalidated: () => void
): () => void {
  const supabase = createClient();
  const deviceInfo = getDeviceInfo();

  const channel = supabase
    .channel(`session-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        // Check if current device session was deactivated
        if (
          payload.new.device_id === deviceInfo.deviceId &&
          payload.new.is_active === false &&
          payload.old.is_active === true
        ) {
          console.log('[DeviceSession] Session invalidated by another device');
          onInvalidated();
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

/**
 * Format relative time for "last seen"
 */
export function formatLastSeen(lastSeen: string): string {
  const now = new Date();
  const then = new Date(lastSeen);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
