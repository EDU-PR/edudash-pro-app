/**
 * NotificationRouter - Smart notification routing for multi-account support
 * 
 * Handles notifications for shared devices where multiple users may be registered.
 * When a notification arrives, it checks if it's for the currently logged-in user
 * and provides options to switch accounts if needed.
 */

import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from './supabase';
import { signOutAndRedirect } from './authActions';
import { 
  deactivateCurrentUserTokens as deactivateTokens,
  reactivateUserTokens as reactivateTokens 
} from './pushTokenUtils';

// Re-export for backwards compatibility
export { 
  deactivateTokens as deactivateCurrentUserTokens,
  reactivateTokens as reactivateUserTokens 
};

export interface NotificationPayload {
  user_id?: string;
  recipient_id?: string;
  target_user_id?: string;
  type?: string;
  title?: string;
  body?: string;
  [key: string]: any;
}

/**
 * Get currently logged-in user ID
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await assertSupabase().auth.getSession();
    return session?.user?.id || null;
  } catch (error) {
    console.error('[NotificationRouter] Failed to get current user:', error);
    return null;
  }
}

/**
 * Get user's name/email for display
 */
async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const { data } = await assertSupabase()
      .from('users')
      .select('first_name, last_name, email')
      .eq('auth_user_id', userId)
      .maybeSingle();
    
    if (data?.first_name) {
      return `${data.first_name} ${data.last_name || ''}`.trim();
    }
    return data?.email || 'Another user';
  } catch (error) {
    return 'Another user';
  }
}

/**
 * Handle account switch request
 */
async function handleAccountSwitch(targetUserId: string): Promise<void> {
  try {
    // Sign out current user
    await signOutAndRedirect({ 
      redirectTo: '/(auth)/sign-in',
      clearBiometrics: false // Keep biometrics for easy switch back
    });
    
    // Store the target user ID so sign-in can pre-fill or auto-select
    // This could be enhanced to show "Switch to [User]" prompt on sign-in
    await assertSupabase()
      .from('app_state')
      .upsert({
        key: 'pending_account_switch',
        value: { target_user_id: targetUserId, timestamp: Date.now() }
      });
  } catch (error) {
    console.error('[NotificationRouter] Account switch failed:', error);
    Alert.alert(
      'Switch Failed',
      'Unable to switch accounts. Please sign in manually.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Route notification based on target user
 * Returns true if notification should be shown, false if handled differently
 */
export async function routeNotification(
  notification: Notifications.Notification
): Promise<boolean> {
  try {
    const data = notification.request.content.data as NotificationPayload;
    
    // Extract target user ID (check multiple possible fields)
    const targetUserId = data.user_id || data.recipient_id || data.target_user_id;
    
    if (!targetUserId) {
      // No user targeting - show to current user
      console.log('[NotificationRouter] No target user, showing notification');
      return true;
    }
    
    // Get currently logged-in user
    const currentUserId = await getCurrentUserId();
    
    if (!currentUserId) {
      // No user logged in - show notification with prompt to sign in
      console.log('[NotificationRouter] No user logged in, showing notification');
      return true;
    }
    
    if (targetUserId === currentUserId) {
      // Notification is for current user - show it
      console.log('[NotificationRouter] Notification for current user, showing');
      return true;
    }
    
    // Notification is for a different user
    console.log('[NotificationRouter] Notification for different user:', {
      target: targetUserId,
      current: currentUserId
    });
    
    // Get target user's display name
    const targetUserName = await getUserDisplayName(targetUserId);
    
    // Show alert with option to switch accounts
    Alert.alert(
      'Message for Another User',
      `This ${data.type || 'notification'} is for ${targetUserName}. Would you like to switch accounts?`,
      [
        {
          text: 'Ignore',
          style: 'cancel',
          onPress: () => {
            console.log('[NotificationRouter] User chose to ignore notification');
          }
        },
        {
          text: 'Switch Account',
          onPress: async () => {
            console.log('[NotificationRouter] User chose to switch accounts');
            await handleAccountSwitch(targetUserId);
          }
        }
      ],
      { cancelable: true }
    );
    
    // Don't show the original notification
    return false;
    
  } catch (error) {
    console.error('[NotificationRouter] Error routing notification:', error);
    // On error, show the notification to avoid silent failures
    return true;
  }
}

/**
 * Setup notification router listener
 * Call this during app initialization
 */
export function setupNotificationRouter(): () => void {
  console.log('[NotificationRouter] Setting up notification router');
  
  // Listen for notifications received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      console.log('[NotificationRouter] Foreground notification received');
      const shouldShow = await routeNotification(notification);
      
      if (!shouldShow) {
        // Notification was handled (wrong user), don't show it
        console.log('[NotificationRouter] Notification suppressed (wrong user)');
      }
    }
  );
  
  // Listen for notification interactions (user tapped notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      console.log('[NotificationRouter] Notification interaction received');
      const notification = response.notification;
      const data = notification.request.content.data as NotificationPayload;
      
      // Extract target user ID
      const targetUserId = data.user_id || data.recipient_id || data.target_user_id;
      const currentUserId = await getCurrentUserId();
      
      if (targetUserId && targetUserId !== currentUserId) {
        // User tapped notification for different account
        const targetUserName = await getUserDisplayName(targetUserId);
        
        Alert.alert(
          'Switch Account?',
          `This message is for ${targetUserName}. Switch to their account?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Switch',
              onPress: async () => {
                await handleAccountSwitch(targetUserId);
              }
            }
          ]
        );
      } else {
        // Notification is for current user - handle normally
        handleNotificationInteraction(data);
      }
    }
  );
  
  // Return cleanup function
  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
    console.log('[NotificationRouter] Notification router cleaned up');
  };
}

/**
 * Handle notification interaction (user tapped notification)
 */
function handleNotificationInteraction(data: NotificationPayload): void {
  // Route to appropriate screen based on notification type
  switch (data.type) {
    case 'message':
    case 'chat':
      if (data.thread_id || data.conversation_id) {
        router.push(`/screens/parent-message-thread?id=${data.thread_id || data.conversation_id}` as any);
      } else {
        router.push('/screens/parent-messages' as any);
      }
      break;
      
    case 'call':
    case 'video_call':
    case 'voice_call':
      // Handle incoming call
      if (data.call_id) {
        router.push(`/screens/incoming-call?id=${data.call_id}` as any);
      }
      break;
      
    case 'announcement':
      router.push('/screens/parent-dashboard' as any);
      break;
      
    case 'homework':
    case 'assignment':
      router.push('/screens/homework' as any);
      break;
      
    default:
      // Unknown type - go to main dashboard
      router.push('/screens/parent-dashboard' as any);
  }
}

