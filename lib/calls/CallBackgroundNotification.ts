/**
 * Call Background Notification Handler
 * 
 * Handles incoming call notifications when the app is backgrounded or killed.
 * Uses expo-task-manager for background execution on Android.
 * 
 * This is needed because:
 * - Supabase Realtime only works when app is active
 * - Expo push notifications need a background task to wake the app
 * - Firebase is optional, so we can't rely on FCM HeadlessJS
 */

import { Platform, Vibration, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Task name for background notification handling
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

// Ringtone vibration pattern (mimics phone call)
const RINGTONE_VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000];

// Storage key for pending call
const PENDING_CALL_KEY = 'edudash_pending_incoming_call';

export interface IncomingCallNotificationData {
  type: 'incoming_call';
  call_id: string;
  caller_id: string;
  caller_name: string;
  call_type: 'voice' | 'video';
  meeting_url?: string;
}

// NOTE: react-native-callkeep has been removed due to Expo SDK 54+ incompatibility
// See: https://github.com/react-native-webrtc/react-native-callkeep/issues/866-869
// Using expo-notifications foreground service instead

/**
 * Save pending call for the main app to pick up when foregrounded
 */
async function savePendingCall(callData: IncomingCallNotificationData): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_CALL_KEY, JSON.stringify({
      ...callData,
      timestamp: Date.now(),
    }));
    console.log('[CallBackgroundNotification] Saved pending call:', callData.call_id);
  } catch (error) {
    console.error('[CallBackgroundNotification] Failed to save pending call:', error);
  }
}

/**
 * Get and clear pending call data
 */
export async function getPendingIncomingCall(): Promise<IncomingCallNotificationData | null> {
  try {
    const data = await AsyncStorage.getItem(PENDING_CALL_KEY);
    if (!data) return null;
    
    const callData = JSON.parse(data);
    
    // Clear after reading (one-time use)
    await AsyncStorage.removeItem(PENDING_CALL_KEY);
    
    // Ignore stale calls (older than 60 seconds)
    if (Date.now() - callData.timestamp > 60000) {
      console.log('[CallBackgroundNotification] Ignoring stale pending call');
      return null;
    }
    
    return callData;
  } catch (error) {
    console.error('[CallBackgroundNotification] Failed to get pending call:', error);
    return null;
  }
}

/**
 * Setup incoming call notification channel (Android)
 */
async function setupIncomingCallChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  
  try {
    // CRITICAL: Create channel with MAX importance for full-screen intent
    // This enables the notification to show as a heads-up notification
    // and allows full-screen intent on Android 10+
    await Notifications.setNotificationChannelAsync('incoming-calls', {
      name: 'Incoming Calls',
      description: 'Voice and video call notifications with high priority and full-screen intent',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: RINGTONE_VIBRATION_PATTERN,
      lightColor: '#00f5ff',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    
    // Setup notification category with answer/decline actions
    // These buttons appear when user expands the notification
    // On some devices, they also appear in heads-up notifications
    await Notifications.setNotificationCategoryAsync('incoming_call', [
      {
        identifier: 'ANSWER',
        buttonTitle: '✓ Answer',
        options: {
          opensAppToForeground: true,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'DECLINE',
        buttonTitle: '✕ Decline',
        options: {
          opensAppToForeground: false,
          isAuthenticationRequired: false,
          isDestructive: true,
        },
      },
    ]);
    
    console.log('[CallBackgroundNotification] Incoming call channel created');
  } catch (error) {
    console.error('[CallBackgroundNotification] Failed to setup channel:', error);
  }
}

/**
 * Show full-screen incoming call notification
 * 
 * On Android, this shows a heads-up notification with Answer/Decline buttons.
 * Users need to expand the notification to see the action buttons on most devices.
 * On Samsung/OneUI devices, buttons may appear directly in the heads-up notification.
 */
async function showIncomingCallNotification(callData: IncomingCallNotificationData): Promise<void> {
  try {
    await setupIncomingCallChannel();
    
    const callTypeEmoji = callData.call_type === 'video' ? '📹' : '📞';
    const callTypeText = callData.call_type === 'video' ? 'Video Call' : 'Voice Call';
    const callerName = callData.caller_name || 'Someone';
    
    await Notifications.scheduleNotificationAsync({
      identifier: `incoming-call-${callData.call_id}`,
      content: {
        title: `${callTypeEmoji} ${callerName}`,
        body: `Incoming ${callTypeText} • Tap to answer`,
        subtitle: 'Swipe down for Answer/Decline',
        categoryIdentifier: 'incoming_call',
        data: {
          type: 'incoming_call',
          call_id: callData.call_id,
          caller_id: callData.caller_id,
          caller_name: callData.caller_name,
          call_type: callData.call_type,
          meeting_url: callData.meeting_url,
        },
        sound: 'default',
        // Android-specific
        ...(Platform.OS === 'android' && {
          channelId: 'incoming-calls',
          priority: 'max',
          sticky: true,
          autoDismiss: false,
          color: '#00f5ff',
          badge: 1,
        }),
        // iOS-specific
        ...(Platform.OS === 'ios' && {
          interruptionLevel: 'critical',
        }),
      },
      trigger: null, // Show immediately
    });
    
    // Start vibration for Android (iOS handles via system)
    if (Platform.OS === 'android') {
      Vibration.vibrate(RINGTONE_VIBRATION_PATTERN, true);
      
      // Stop vibration after 30 seconds
      setTimeout(() => {
        Vibration.cancel();
      }, 30000);
    }
    
    console.log('[CallBackgroundNotification] Notification shown for call:', callData.call_id);
  } catch (error) {
    console.error('[CallBackgroundNotification] Failed to show notification:', error);
  }
}

/**
 * Try to show native call screen via CallKeep
 * DISABLED: CallKeep is broken with Expo SDK 54+ (duplicate method exports bug)
 * See: https://github.com/react-native-webrtc/react-native-callkeep/issues/866-869
 */
async function showCallKeepNotification(_callData: IncomingCallNotificationData): Promise<boolean> {
  // CallKeep removed - always return false so we use notification-based approach
  return false;
}

/**
 * Cancel incoming call notification
 */
export async function cancelIncomingCallNotification(callId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`incoming-call-${callId}`);
    await Notifications.dismissNotificationAsync(`incoming-call-${callId}`);
    Vibration.cancel();
    
    // Note: CallKeep removal - no native call screen to dismiss
    
    console.log('[CallBackgroundNotification] Cancelled notification for:', callId);
  } catch (error) {
    console.error('[CallBackgroundNotification] Failed to cancel:', error);
  }
}

/**
 * Handle background notification
 */
async function handleBackgroundNotification(notification: Notifications.Notification | null | undefined): Promise<void> {
  // Guard against null/undefined notification
  if (!notification?.request?.content?.data) {
    console.warn('[CallBackgroundNotification] Invalid notification received:', notification);
    return;
  }
  
  const data = notification.request.content.data as any;
  
  console.log('[CallBackgroundNotification] Background notification received:', {
    type: data?.type,
    callId: data?.call_id,
    appState: AppState.currentState,
  });
  
  // Handle incoming calls
  if (data?.type === 'incoming_call') {
    const callData: IncomingCallNotificationData = {
      type: 'incoming_call',
      call_id: data.call_id,
      caller_id: data.caller_id,
      caller_name: data.caller_name || 'Unknown',
      call_type: data.call_type || 'voice',
      meeting_url: data.meeting_url,
    };
    
    // Save for when app opens
    await savePendingCall(callData);
    
    // If app is backgrounded (not killed), show notification
    if (AppState.currentState !== 'active') {
      // Try CallKeep first for native call screen
      const callKeepSuccess = await showCallKeepNotification(callData);
      
      // Always show notification as backup
      if (!callKeepSuccess) {
        await showIncomingCallNotification(callData);
      }
    }
    return;
  }
  
  // Handle message notifications - mark as delivered when notification is received
  // This works even when app is backgrounded or killed (WhatsApp-style)
  if (data?.type === 'message' || data?.type === 'chat') {
    try {
      const { assertSupabase } = require('./supabase');
      const supabase = assertSupabase();
      
      // Get current user from session (if available)
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      
      if (currentUserId && data.thread_id) {
        await supabase.rpc('mark_messages_delivered', {
          p_thread_id: data.thread_id,
          p_user_id: currentUserId,
        });
        console.log('[CallBackgroundNotification] ✅ Marked messages as delivered (background)');
      }
    } catch (err) {
      console.warn('[CallBackgroundNotification] Failed to mark messages as delivered:', err);
    }
  }
}

/**
 * Define the background task for expo-task-manager
 * This MUST be defined at module load time (outside any function)
 * It enables notifications to wake the app when killed
 */
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  console.log('[CallBackgroundNotification] Background task executed:', {
    hasData: !!data,
    hasError: !!error,
    executionInfo,
  });
  
  if (error) {
    console.error('[CallBackgroundNotification] Background task error:', error);
    return;
  }
  
  if (data) {
    const notification = (data as any).notification as Notifications.Notification;
    if (notification) {
      await handleBackgroundNotification(notification);
    }
  }
});

/**
 * Register the background notification task
 * Call this at app startup (in index.js or App.tsx)
 * The defineTask above must already be defined for this to work
 */
export async function registerBackgroundNotificationTask(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('[CallBackgroundNotification] Skipping on non-Android');
    return;
  }
  
  try {
    // CRITICAL: Setup the incoming call channel FIRST
    // This must complete before registering the task
    await setupIncomingCallChannel();
    console.log('[CallBackgroundNotification] ✅ Channel setup complete');
    
    // THEN register the background notification handler with Expo
    // This must be done after TaskManager.defineTask
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('[CallBackgroundNotification] ✅ Background task registered');
  } catch (error: any) {
    // Task may already be registered - not a critical error
    console.warn('[CallBackgroundNotification] Registration warning:', error.message);
  }
}

/**
 * Check if an incoming call notification was tapped to open the app
 * Call this in CallProvider when app starts
 */
export async function checkForIncomingCallOnLaunch(): Promise<IncomingCallNotificationData | null> {
  try {
    // Check for notification that launched the app
    const response = await Notifications.getLastNotificationResponseAsync();
    
    if (response?.notification?.request?.content?.data?.type === 'incoming_call') {
      const data = response.notification.request.content.data as any;
      console.log('[CallBackgroundNotification] App opened from call notification:', data.call_id);
      
      return {
        type: 'incoming_call',
        call_id: data.call_id,
        caller_id: data.caller_id,
        caller_name: data.caller_name || 'Unknown',
        call_type: data.call_type || 'voice',
        meeting_url: data.meeting_url,
      };
    }
    
    // Also check async storage for pending call
    return await getPendingIncomingCall();
  } catch (error) {
    console.error('[CallBackgroundNotification] Launch check failed:', error);
    return null;
  }
}

export default {
  registerBackgroundNotificationTask,
  checkForIncomingCallOnLaunch,
  cancelIncomingCallNotification,
  getPendingIncomingCall,
};
