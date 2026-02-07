/**
 * Device Session Tracker
 *
 * Registers the current device with Supabase on sign-in and monitors
 * for concurrent logins on other devices (Option B: soft detection).
 *
 * On new-device detection, shows an in-app notification rather than
 * forcibly kicking the user — awareness without disruption.
 *
 * @module lib/deviceSessionTracker
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { assertSupabase } from '@/lib/supabase';

// Stable device identifier (persists across app reinstalls on Android)
let cachedDeviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    if (Platform.OS === 'android') {
      cachedDeviceId = Application.getAndroidId() || `android_${Date.now()}`;
    } else if (Platform.OS === 'ios') {
      const id = await Application.getIosIdForVendorAsync();
      cachedDeviceId = id || `ios_${Date.now()}`;
    } else {
      // Web: use a persistent localStorage ID
      const stored = typeof localStorage !== 'undefined' && localStorage.getItem('edudash_device_id');
      if (stored) {
        cachedDeviceId = stored;
      } else {
        cachedDeviceId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('edudash_device_id', cachedDeviceId);
        }
      }
    }
  } catch {
    cachedDeviceId = `fallback_${Date.now()}`;
  }
  return cachedDeviceId;
}

function getDeviceName(): string {
  try {
    const parts = [Device.brand, Device.modelName].filter(Boolean);
    return parts.join(' ') || `${Platform.OS} device`;
  } catch {
    return `${Platform.OS} device`;
  }
}

function getAppVersion(): string {
  try {
    return Application.nativeApplicationVersion || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export interface OtherDevice {
  device_id: string;
  device_name: string;
  platform: string;
  last_active_at: string;
}

export interface SessionRegistrationResult {
  otherDevices: OtherDevice[];
  deviceCount: number;
  isNewDevice: boolean;
}

/**
 * Register the current device and check for other active sessions.
 * Call this after successful sign-in.
 *
 * Returns info about other active devices so the caller can show
 * a soft notification if the user is logged in elsewhere.
 */
export async function registerDeviceSession(): Promise<SessionRegistrationResult> {
  try {
    const deviceId = await getDeviceId();
    const deviceName = getDeviceName();
    const platform = Platform.OS;
    const appVersion = getAppVersion();

    const supabase = assertSupabase();
    const { data, error } = await supabase.rpc('register_device_session', {
      p_device_id: deviceId,
      p_device_name: deviceName,
      p_platform: platform,
      p_app_version: appVersion,
    });

    if (error) {
      console.warn('[DeviceSession] Registration failed:', error.message);
      return { otherDevices: [], deviceCount: 1, isNewDevice: false };
    }

    const otherDevices: OtherDevice[] = data?.other_devices || [];
    const deviceCount: number = data?.device_count || 1;

    if (otherDevices.length > 0) {
      console.log(
        `[DeviceSession] User has ${deviceCount} active device(s):`,
        otherDevices.map((d) => `${d.device_name} (${d.platform})`).join(', '),
      );
    }

    return {
      otherDevices,
      deviceCount,
      isNewDevice: otherDevices.length > 0,
    };
  } catch (err) {
    console.warn('[DeviceSession] Unexpected error:', err);
    return { otherDevices: [], deviceCount: 1, isNewDevice: false };
  }
}

/**
 * Mark the current device session as signed out.
 * Call during sign-out flow.
 */
export async function deactivateDeviceSession(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const supabase = assertSupabase();
    await supabase.rpc('sign_out_device_session', { p_device_id: deviceId });
  } catch (err) {
    console.warn('[DeviceSession] Deactivation failed (non-fatal):', err);
  }
}

/**
 * Heartbeat: update last_active_at for this device.
 * Call periodically (e.g., every 5 min) from the presence system.
 */
export async function refreshDeviceSession(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const supabase = assertSupabase();
    await supabase
      .from('active_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .eq('is_active', true);
  } catch {
    // Non-critical — next heartbeat will update
  }
}
