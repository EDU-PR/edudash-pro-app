/**
 * Push Notification Setup for Incoming Calls
 * 
 * Gets Expo Push Token and saves to user's profile for incoming call notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get project ID from EAS config (matches extra.eas.projectId in app.json)
const EXPO_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId || 'ab7c9230-2f47-4bfa-b4f4-4ae516a334bc';

// Storage key for stable device ID
const DEVICE_ID_STORAGE_KEY = '@edudash_device_id';

/**
 * Get or create a stable device ID that persists across app restarts
 */
async function getStableDeviceId(): Promise<string> {
  try {
    // First try to get from storage
    const storedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (storedId) {
      return storedId;
    }
    
    // Generate a new stable ID
    const baseId = Constants.deviceId || Constants.sessionId || `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const deviceId = `device_${baseId}`;
    
    // Store for future use
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    console.log('[PushNotifications] Generated new device ID:', deviceId);
    
    return deviceId;
  } catch (error) {
    // Fallback if storage fails
    console.warn('[PushNotifications] Failed to get/store device ID:', error);
    return `device_${Platform.OS}-${Date.now()}`;
  }
}

/**
 * Get Expo Push Token for this device
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Check permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[PushNotifications] Permission denied');
      return null;
    }

    // Get Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });

    console.log('[PushNotifications] ✅ Got Expo Push Token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('[PushNotifications] Failed to get push token:', error);
    return null;
  }
}

/**
 * Save push token to user's profile AND push_devices table in Supabase
 * This ensures tokens are available for both incoming calls (profiles) and
 * general notifications (push_devices)
 */
export async function savePushTokenToProfile(userId: string): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      console.warn('[PushNotifications] No token to save');
      return false;
    }

    const supabase = assertSupabase();
    
    // Save to BOTH profiles (for call notifications) and push_devices (for general notifications)
    // This ensures compatibility with all Edge Functions that send push notifications
    
    // 1. Update user's profile with push token
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        expo_push_token: token,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[PushNotifications] Failed to save token to profile:', profileError);
      // Continue to try push_devices anyway
    } else {
      console.log('[PushNotifications] ✅ Push token saved to profiles');
    }
    
    // 2. Also save to push_devices table for general notifications
    // This uses upsert with device_id to handle multiple devices per user
    const Device = (await import('expo-device')).default;
    
    // Get a stable device ID that persists across app restarts
    const deviceId = await getStableDeviceId();
    
    const { error: deviceError } = await supabase
      .from('push_devices')
      .upsert({
        user_id: userId,
        expo_push_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        is_active: true,
        device_id: deviceId,
        device_installation_id: deviceId, // Use same ID for both columns
        device_metadata: {
          brand: Device?.brand,
          model: Device?.modelName,
          osVersion: Device?.osVersion,
          appVersion: Constants.expoConfig?.version,
          expo_project_id: EXPO_PROJECT_ID,
          updated_for_calls: true,
        },
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_installation_id' // Match unique index push_devices_user_device_unique
      });

    if (deviceError) {
      console.error('[PushNotifications] Failed to save token to push_devices:', deviceError);
    } else {
      console.log('[PushNotifications] ✅ Push token saved to push_devices');
    }

    // Return true if at least profiles was updated successfully
    return !profileError;
  } catch (error) {
    console.error('[PushNotifications] Save token error:', error);
    return false;
  }
}

/**
 * Setup push notifications for incoming calls
 * Call this when user logs in
 */
export async function setupIncomingCallNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[PushNotifications] Skipping on web');
    return;
  }

  console.log('[PushNotifications] Setting up incoming call notifications...');
  
  // Save push token to profile
  const saved = await savePushTokenToProfile(userId);
  
  if (saved) {
    console.log('[PushNotifications] ✅ Ready to receive incoming calls');
  } else {
    console.warn('[PushNotifications] ⚠️ Push notifications may not work');
  }
}
