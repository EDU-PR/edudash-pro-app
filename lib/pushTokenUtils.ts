/**
 * Push Token Management Utilities
 * 
 * Extracted from NotificationRouter to break circular dependency with authActions.
 * These utilities handle activation/deactivation of push notification tokens.
 */

import { assertSupabase } from './supabase';
import { getStableDeviceId } from './notifications';

/**
 * Deactivate push tokens for current user on this device
 * Call this when user logs out
 */
export async function deactivateCurrentUserTokens(userId: string): Promise<void> {
  if (!userId) return;
  try {
    if (__DEV__) console.log('[PushTokenUtils] Deactivating tokens for user:', userId);

    // Use the same stable installation id as push registration paths.
    const installationId = await getStableDeviceId();

    if (!installationId) {
      if (__DEV__) console.warn('[PushTokenUtils] No installation ID, skipping token deactivation');
      return;
    }

    // Mark tokens as inactive
    const { error } = await assertSupabase()
      .from('push_devices')
      .update({ 
        is_active: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('device_installation_id', installationId);
    
    if (error) {
      console.error('[PushTokenUtils] Failed to deactivate tokens:', error);
    } else {
      if (__DEV__) console.log('[PushTokenUtils] Tokens deactivated successfully');
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
  if (!userId) return;
  try {
    if (__DEV__) console.log('[PushTokenUtils] Reactivating tokens for user:', userId);

    // Use the same stable installation id as push registration paths.
    const installationId = await getStableDeviceId();

    if (!installationId) {
      if (__DEV__) console.warn('[PushTokenUtils] No installation ID, skipping token reactivation');
      return;
    }
    
    // Deactivate all other users' tokens on this device
    await assertSupabase()
      .from('push_devices')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('device_installation_id', installationId)
      .neq('user_id', userId);
    
    // Activate current user's token on this device
    const { error } = await assertSupabase()
      .from('push_devices')
      .update({ 
        is_active: true,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('device_installation_id', installationId);
    
    if (error) {
      console.error('[PushTokenUtils] Failed to reactivate tokens:', error);
    } else {
      if (__DEV__) console.log('[PushTokenUtils] Tokens reactivated successfully');
    }
  } catch (error) {
    console.error('[PushTokenUtils] Error reactivating tokens:', error);
  }
}
