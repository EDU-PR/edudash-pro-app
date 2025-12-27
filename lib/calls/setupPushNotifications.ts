/**
 * Push Notification Setup for Incoming Calls
 * 
 * Gets Expo Push Token and saves to user's profile for incoming call notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import Constants from 'expo-constants';

// Get project ID from EAS config (matches extra.eas.projectId in app.json)
const EXPO_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId || 'ab7c9230-2f47-4bfa-b4f4-4ae516a334bc';

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
 * Save push token to user's profile in Supabase
 */
export async function savePushTokenToProfile(userId: string): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      console.warn('[PushNotifications] No token to save');
      return false;
    }

    const supabase = assertSupabase();
    
    // Update user's profile with push token
    const { error } = await supabase
      .from('profiles')
      .update({ 
        expo_push_token: token,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[PushNotifications] Failed to save token:', error);
      return false;
    }

    console.log('[PushNotifications] ✅ Push token saved to profile');
    return true;
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
