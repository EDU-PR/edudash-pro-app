/**
 * Push Token Management Utilities
 * 
 * Extracted from NotificationRouter to break circular dependency with authActions.
 * These utilities handle activation/deactivation of push notification tokens.
 */

import { assertSupabase } from './supabase';

/**
 * Deactivate push tokens for current user on this device
 * Call this when user logs out
 */
export async function deactivateCurrentUserTokens(userId: string): Promise<void> {
  try {
    console.log('[PushTokenUtils] Deactivating tokens for user:', userId);
    
    // Get device installation ID
    const Constants = require('expo-constants').default;
    const installationId = Constants.deviceId || Constants.sessionId;
    
    if (!installationId) {
      console.warn('[PushTokenUtils] No installation ID, skipping token deactivation');
      return;
    }
    
    // Mark tokens as inactive
    const { error } = await assertSupabase()
      .from('push_devices')
      .update({ 
        is_active: false,
        revoked_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('device_installation_id', installationId);
    
    if (error) {
      console.error('[PushTokenUtils] Failed to deactivate tokens:', error);
    } else {
      console.log('[PushTokenUtils] Tokens deactivated successfully');
    }
  } catch (error) {
    console.error('[PushTokenUtils] Error deactivating tokens:', error);
  }
}

/**
 * Reactivate push tokens for current user on this device
 * Call this when user logs in
 */
export async function reactivateUserTokens(userId: string): Promise<void> {
  try {
    console.log('[PushTokenUtils] Reactivating tokens for user:', userId);
    
    // Get device installation ID
    const Constants = require('expo-constants').default;
    const installationId = Constants.deviceId || Constants.sessionId;
    
    if (!installationId) {
      console.warn('[PushTokenUtils] No installation ID, skipping token reactivation');
      return;
    }
    
    // Deactivate all other users' tokens on this device
    await assertSupabase()
      .from('push_devices')
      .update({ is_active: false })
      .eq('device_installation_id', installationId)
      .neq('user_id', userId);
    
    // Activate current user's token on this device
    const { error } = await assertSupabase()
      .from('push_devices')
      .update({ 
        is_active: true,
        last_seen_at: new Date().toISOString(),
        revoked_at: null
      })
      .eq('user_id', userId)
      .eq('device_installation_id', installationId);
    
    if (error) {
      console.error('[PushTokenUtils] Failed to reactivate tokens:', error);
    } else {
      console.log('[PushTokenUtils] Tokens reactivated successfully');
    }
  } catch (error) {
    console.error('[PushTokenUtils] Error reactivating tokens:', error);
  }
}
