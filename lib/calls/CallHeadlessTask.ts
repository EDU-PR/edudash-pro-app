/**
 * HeadlessJS Task for Background Call Handling
 * 
 * Handles incoming call notifications when the app is killed or backgrounded on Android.
 * This is required because Supabase Realtime subscriptions only work when the app is active.
 * 
 * Flow:
 * 1. FCM data message arrives with type: 'incoming_call'
 * 2. Android wakes up the app headlessly (no UI)
 * 3. This task runs and displays CallKeep incoming call screen
 * 4. User sees native call UI and can answer/decline
 * 5. If answered, app opens and CallProvider handles the rest
 */

import { AppRegistry, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import CallKeep
let RNCallKeep: any = null;
try {
  RNCallKeep = require('react-native-callkeep').default;
} catch {
  console.warn('[CallHeadlessTask] react-native-callkeep not available');
}

// Conditionally import Firebase Messaging
let messaging: any = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch {
  // Firebase messaging not available - will use Expo notifications fallback
  console.warn('[CallHeadlessTask] Firebase messaging not available');
}

export interface IncomingCallData {
  type: 'incoming_call';
  call_id: string;
  caller_id: string;
  caller_name: string;
  call_type: 'voice' | 'video';
  meeting_url: string;
}

/**
 * Storage key for pending call data
 * Used to pass call info from headless task to the main app
 */
const PENDING_CALL_KEY = 'edudash_pending_call';

/**
 * Save pending call data for the main app to pick up
 */
async function savePendingCall(callData: IncomingCallData): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_CALL_KEY, JSON.stringify({
      ...callData,
      timestamp: Date.now(),
    }));
    console.log('[CallHeadlessTask] Saved pending call:', callData.call_id);
  } catch (error) {
    console.error('[CallHeadlessTask] Failed to save pending call:', error);
  }
}

/**
 * Get and clear pending call data
 */
export async function getPendingCall(): Promise<IncomingCallData | null> {
  try {
    const data = await AsyncStorage.getItem(PENDING_CALL_KEY);
    if (!data) return null;
    
    const callData = JSON.parse(data);
    
    // Clear after reading (one-time use)
    await AsyncStorage.removeItem(PENDING_CALL_KEY);
    
    // Ignore stale calls (older than 60 seconds)
    if (Date.now() - callData.timestamp > 60000) {
      console.log('[CallHeadlessTask] Ignoring stale pending call');
      return null;
    }
    
    return callData;
  } catch (error) {
    console.error('[CallHeadlessTask] Failed to get pending call:', error);
    return null;
  }
}

/**
 * Setup CallKeep for headless operation
 */
async function setupCallKeepHeadless(): Promise<boolean> {
  if (!RNCallKeep) {
    console.warn('[CallHeadlessTask] CallKeep not available');
    return false;
  }
  
  try {
    const options = {
      ios: {
        appName: 'EduDash Pro',
        imageName: 'AppIcon',
        ringtoneSound: 'ringtone.mp3',
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
      },
      android: {
        alertTitle: 'Permissions Required',
        alertDescription: 'This application needs access to your phone accounts to make calls.',
        cancelButton: 'Cancel',
        okButton: 'OK',
        imageName: 'ic_launcher',
        additionalPermissions: [],
        selfManaged: true, // Important for Android 11+
        foregroundService: {
          channelId: 'com.edudashpro.app.calls',
          channelName: 'Voice & Video Calls',
          notificationTitle: 'EduDash Call in progress',
          notificationIcon: 'ic_launcher',
        },
        // Enable wake screen for incoming calls
        wakeScreen: true,
        useFullScreenIntent: true,
        turnScreenOn: true,
        showWhenLocked: true,
      },
    };
    
    await RNCallKeep.setup(options);
    
    // Request phone account permission for Android
    if (Platform.OS === 'android') {
      const hasPermission = await RNCallKeep.checkPhoneAccountPermission();
      if (!hasPermission) {
        await RNCallKeep.requestPhoneAccountPermission();
      }
    }
    
    console.log('[CallHeadlessTask] CallKeep setup complete');
    return true;
  } catch (error) {
    console.error('[CallHeadlessTask] CallKeep setup failed:', error);
    return false;
  }
}

/**
 * HeadlessJS task handler for incoming calls
 * This runs when the app is killed and receives a high-priority FCM data message
 */
async function CallHeadlessTask(remoteMessage: any): Promise<void> {
  console.log('[CallHeadlessTask] Received message:', JSON.stringify(remoteMessage));
  
  const data = remoteMessage?.data;
  
  if (!data || data.type !== 'incoming_call') {
    console.log('[CallHeadlessTask] Not an incoming call message, ignoring');
    return;
  }
  
  const callData: IncomingCallData = {
    type: 'incoming_call',
    call_id: data.call_id,
    caller_id: data.caller_id,
    caller_name: data.caller_name || 'Unknown',
    call_type: data.call_type || 'voice',
    meeting_url: data.meeting_url,
  };
  
  console.log('[CallHeadlessTask] Processing incoming call:', {
    callId: callData.call_id,
    callerName: callData.caller_name,
    callType: callData.call_type,
  });
  
  // Save call data for when the app opens
  await savePendingCall(callData);
  
  // Setup and display CallKeep incoming call screen
  const setupSuccess = await setupCallKeepHeadless();
  
  if (setupSuccess && RNCallKeep) {
    try {
      await RNCallKeep.displayIncomingCall(
        callData.call_id,
        callData.caller_name,
        callData.caller_name,
        'generic',
        callData.call_type === 'video'
      );
      
      console.log('[CallHeadlessTask] Incoming call displayed via CallKeep');
    } catch (error) {
      console.error('[CallHeadlessTask] Failed to display incoming call:', error);
    }
  }
  
  // Set up a timeout to show missed call notification if not answered
  setTimeout(async () => {
    // Check if call is still pending (not answered)
    const pendingCall = await AsyncStorage.getItem(PENDING_CALL_KEY);
    if (pendingCall) {
      const callInfo = JSON.parse(pendingCall);
      if (callInfo.call_id === callData.call_id) {
        // Call was not answered - show missed call notification
        await showMissedCallNotificationHeadless(callData.caller_name, callData.call_type);
        // Clear the pending call
        await AsyncStorage.removeItem(PENDING_CALL_KEY);
      }
    }
  }, 30000); // 30 seconds timeout
}

/**
 * Show missed call notification when app is killed/backgrounded
 * Includes badge update (red dot on app icon)
 * Shows on lock screen
 */
async function showMissedCallNotificationHeadless(
  callerName: string, 
  callType: 'voice' | 'video'
): Promise<void> {
  try {
    // Dynamically import expo-notifications
    const Notifications = await import('expo-notifications');
    const { badgeManager } = await import('../NotificationBadgeManager');
    
    const callTypeIcon = callType === 'video' ? '📹' : '📞';
    const timestamp = new Date().toLocaleTimeString('en-ZA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Update badge count (red dot on app icon)
    await badgeManager.addMissedCall();
    const totalBadge = badgeManager.getTotalBadgeCount();

    // Schedule notification - shows on lock screen and notification shade
    await Notifications.scheduleNotificationAsync({
      identifier: `missed-call-headless-${Date.now()}`,
      content: {
        title: `${callTypeIcon} Missed Call`,
        body: `${callerName} • ${timestamp}`,
        data: { 
          type: 'missed_call', 
          callerName,
          callType,
          timestamp: Date.now(),
        },
        // Android: Show on lock screen with badge
        ...(Platform.OS === 'android' && {
          channelId: 'missed-calls', // Use dedicated missed calls channel
          priority: 'high' as const,
          vibrate: [0, 250, 250, 250],
          color: '#EF4444', // Red for missed call
        }),
        // iOS: Update badge
        ...(Platform.OS === 'ios' && {
          badge: totalBadge,
        }),
      },
      trigger: null,
    });

    console.log('[CallHeadlessTask] Missed call notification shown for:', callerName, 'badge:', totalBadge);
  } catch (error) {
    console.error('[CallHeadlessTask] Failed to show missed call notification:', error);
  }
}

/**
 * Register HeadlessJS task for Android background call handling
 * Must be called in index.js before expo-router/entry
 */
export function registerCallHeadlessTask(): void {
  if (Platform.OS !== 'android') {
    console.log('[CallHeadlessTask] Skipping registration on non-Android platform');
    return;
  }
  
  // Register the HeadlessJS task
  AppRegistry.registerHeadlessTask('CallHeadlessTask', () => CallHeadlessTask);
  console.log('[CallHeadlessTask] HeadlessJS task registered');
  
  // Register FCM background message handler if available
  if (messaging) {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('[CallHeadlessTask] FCM background message:', JSON.stringify(remoteMessage));
      
      if (remoteMessage?.data?.type === 'incoming_call') {
        await CallHeadlessTask(remoteMessage);
      }
    });
    console.log('[CallHeadlessTask] FCM background handler registered');
  }
}

/**
 * Handle foreground FCM messages for calls
 * Call this from CallProvider or App.tsx
 */
export function setupForegroundCallHandler(
  onIncomingCall: (callData: IncomingCallData) => void
): (() => void) | null {
  if (!messaging) {
    console.warn('[CallHeadlessTask] Firebase messaging not available for foreground handler');
    return null;
  }
  
  const unsubscribe = messaging().onMessage(async (remoteMessage: any) => {
    console.log('[CallHeadlessTask] FCM foreground message:', JSON.stringify(remoteMessage));
    
    if (remoteMessage?.data?.type === 'incoming_call') {
      const callData: IncomingCallData = {
        type: 'incoming_call',
        call_id: remoteMessage.data.call_id,
        caller_id: remoteMessage.data.caller_id,
        caller_name: remoteMessage.data.caller_name || 'Unknown',
        call_type: remoteMessage.data.call_type || 'voice',
        meeting_url: remoteMessage.data.meeting_url,
      };
      
      onIncomingCall(callData);
    }
  });
  
  console.log('[CallHeadlessTask] Foreground call handler registered');
  return unsubscribe;
}
