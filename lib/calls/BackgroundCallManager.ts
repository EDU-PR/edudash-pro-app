/**
 * Background Call Handler
 * 
 * Manages background call functionality including:
 * - Picture-in-picture for video calls
 * - Background audio routing
 * - Notification management (notification shade/drawer)
 * - Call state persistence
 * - Badge management (red dot on app icon)
 * - Lock screen notifications
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { callKeepManager } from './callkeep-manager';
import { badgeManager } from '../NotificationBadgeManager';

// Conditionally import background task modules
let TaskManager: any = null;
let BackgroundFetch: any = null;
try {
  TaskManager = require('expo-task-manager');
  BackgroundFetch = require('expo-background-fetch');
} catch (error) {
  console.warn('[BackgroundCallManager] Background task modules not available:', error);
}

const BACKGROUND_CALL_TASK = 'background-call-task';

interface BackgroundCallManager {
  startBackgroundMode: (callId: string, callType: 'voice' | 'video') => Promise<void>;
  stopBackgroundMode: () => Promise<void>;
  enablePictureInPicture: (enabled: boolean) => Promise<void>;
  maintainAudioSession: () => Promise<void>;
  showCallNotification: (callerName: string, duration: number) => Promise<void>;
  hideCallNotification: () => Promise<void>;
  updateCallNotificationDuration: (callerName: string, duration: number) => Promise<void>;
  setCallerName: (name: string) => void;
  showMissedCallNotification: (callerName: string, callType: 'voice' | 'video') => Promise<void>;
}
class BackgroundCallManagerImpl implements BackgroundCallManager {
  private currentCallId: string | null = null;
  private currentCallType: 'voice' | 'video' | null = null;
  private currentCallerName: string = 'EduDash Call';
  private callStartTime: number | null = null;
  private durationUpdateInterval: NodeJS.Timeout | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private audioSession: Audio.Sound | null = null;
  private isBackgroundModeActive = false;
  private notificationResponseSubscription: any = null;
  private appStateSubscription: { remove: () => void } | null = null;

  constructor() {
    this.setupAppStateListener();
    this.registerBackgroundTask();
    this.setupNotificationResponseListener();
  }
  
  /**
   * Clean up all subscriptions and resources
   * Call this when the app is terminating or during hot reload
   */
  cleanup(): void {
    // Remove AppState subscription
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    // Remove notification response subscription
    if (this.notificationResponseSubscription) {
      this.notificationResponseSubscription.remove();
      this.notificationResponseSubscription = null;
    }
    
    // Stop duration updates
    this.stopDurationUpdates();
    
    // Clean up audio session
    this.cleanupAudioSession();
    
    console.log('[BackgroundCallManager] Cleanup complete');
  }
  
  setCallerName(name: string): void {
    this.currentCallerName = name || 'EduDash Call';
  }
  
  // Listen for notification action responses (End Call, Return)
  private async setupNotificationResponseListener() {
    try {
      const Notifications = await import('expo-notifications');
      
      this.notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data;
          
          if (data?.type === 'ongoing_call') {
            console.log('[BackgroundCallManager] Notification action:', actionId);
            
            if (actionId === 'END_CALL') {
              // End the call
              this.stopBackgroundMode();
              // Emit event for CallProvider to handle
              this.onEndCallFromNotification?.();
            } else if (actionId === 'RETURN_TO_CALL' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
              // Return to call - app opens to foreground automatically
              this.onReturnToCallFromNotification?.();
            }
          }
        }
      );
      
      console.log('[BackgroundCallManager] Notification response listener set up');
    } catch (error) {
      console.warn('[BackgroundCallManager] Could not set up notification listener:', error);
    }
  }
  
  // Callbacks for notification actions
  public onEndCallFromNotification?: () => void;
  public onReturnToCallFromNotification?: () => void;

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = this.appState;
      this.appState = nextAppState;

      if (previousState === 'active' && nextAppState === 'background' && this.currentCallId) {
        this.handleAppBackgrounded();
      } else if (previousState === 'background' && nextAppState === 'active' && this.currentCallId) {
        this.handleAppForegrounded();
      }
    });
  }

  private async registerBackgroundTask() {
    if (!TaskManager || !BackgroundFetch) {
      console.log('[BackgroundCallManager] Background task modules not available, skipping registration');
      return;
    }

    try {
      await TaskManager.defineTask(BACKGROUND_CALL_TASK, async () => {
        console.log('[BackgroundCallManager] Background task executed');
        
        if (this.currentCallId && this.isBackgroundModeActive) {
          // Keep call session alive
          await this.maintainAudioSession();
          
          // Update call notification if needed
          await this.updateCallNotification();
        }
        
        return BackgroundFetch.BackgroundFetchResult.NewData;
      });

      // Register the background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_CALL_TASK, {
        minimumInterval: 15000, // 15 seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      console.log('[BackgroundCallManager] Background task registered successfully');
    } catch (error) {
      console.error('[BackgroundCallManager] Failed to register background task:', error);
    }
  }

  async startBackgroundMode(callId: string, callType: 'voice' | 'video'): Promise<void> {
    console.log(`[BackgroundCallManager] Starting background mode for ${callType} call:`, callId);
    
    this.currentCallId = callId;
    this.currentCallType = callType;
    this.isBackgroundModeActive = true;
    this.callStartTime = Date.now();

    try {
      // Set up audio session for background playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
      });

      // Enable background audio category
      if (Platform.OS === 'ios') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
        });
      }

      // Set up CallKeep for native call UI
      if (callKeepManager.isAvailable()) {
        await callKeepManager.reportConnected(callId);
      }

      // For video calls, prepare picture-in-picture if available
      if (callType === 'video' && Platform.OS === 'android') {
        await this.enablePictureInPicture(true);
      }

      console.log('[BackgroundCallManager] Background mode started successfully');
    } catch (error) {
      console.error('[BackgroundCallManager] Failed to start background mode:', error);
      this.isBackgroundModeActive = false;
    }
  }

  async stopBackgroundMode(): Promise<void> {
    console.log('[BackgroundCallManager] Stopping background mode');
    
    try {
      // Stop duration update interval
      this.stopDurationUpdates();
      
      // Clean up audio session
      await this.cleanupAudioSession();
      
      // Hide call notification
      await this.hideCallNotification();
      
      // End CallKeep session
      if (this.currentCallId && callKeepManager.isAvailable()) {
        await callKeepManager.endCall(this.currentCallId);
      }
      
      // Disable picture-in-picture
      if (this.currentCallType === 'video') {
        await this.enablePictureInPicture(false);
      }
      
      // Reset state
      this.currentCallId = null;
      this.currentCallType = null;
      this.currentCallerName = 'EduDash Call';
      this.callStartTime = null;
      this.isBackgroundModeActive = false;
      
      console.log('[BackgroundCallManager] Background mode stopped successfully');
    } catch (error) {
      console.error('[BackgroundCallManager] Error stopping background mode:', error);
    }
  }

  async enablePictureInPicture(enabled: boolean): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[BackgroundCallManager] Picture-in-picture only available on Android');
      return;
    }

    try {
      if (enabled) {
        // Enable picture-in-picture mode for video calls
        // This would require native Android implementation
        console.log('[BackgroundCallManager] Picture-in-picture mode enabled');
      } else {
        console.log('[BackgroundCallManager] Picture-in-picture mode disabled');
      }
    } catch (error) {
      console.error('[BackgroundCallManager] Error toggling picture-in-picture:', error);
    }
  }

  async maintainAudioSession(): Promise<void> {
    try {
      // Ensure audio session remains active
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('[BackgroundCallManager] Error maintaining audio session:', error);
    }
  }

  async showCallNotification(callerName: string, duration: number): Promise<void> {
    try {
      const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      // Import expo-notifications dynamically
      const Notifications = await import('expo-notifications');
      
      // Ensure the ongoing calls channel exists (Android)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('ongoing-calls', {
          name: 'Ongoing Calls',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 0], // No vibration for ongoing notification
          lightColor: '#6366F1',
          sound: null, // No sound for ongoing notification
          enableVibrate: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
        
        // Set up notification categories with actions
        await Notifications.setNotificationCategoryAsync('ongoing_call', [
          {
            identifier: 'END_CALL',
            buttonTitle: 'End Call',
            options: {
              isDestructive: true,
              opensAppToForeground: false,
            },
          },
          {
            identifier: 'RETURN_TO_CALL',
            buttonTitle: 'Return',
            options: {
              opensAppToForeground: true,
            },
          },
        ]);
      }

      // Schedule an ongoing notification for the active call
      // This will appear in the notification shade (pull-down drawer)
      await Notifications.scheduleNotificationAsync({
        identifier: 'ongoing-call',
        content: {
          title: '📞 EduDash Pro',
          subtitle: `Call with ${callerName}`,
          body: `Ongoing call • ${formatDuration(duration)}`,
          data: { 
            type: 'ongoing_call', 
            callId: this.currentCallId,
            callerName,
          },
          categoryIdentifier: 'ongoing_call',
          // Android-specific options for ongoing notification
          ...(Platform.OS === 'android' && {
            channelId: 'ongoing-calls',
            // These make it behave like WhatsApp's call notification
            priority: 'max' as const,
            vibrate: [0],
            sound: null,
            // Ongoing notifications can't be dismissed by user
            sticky: true,
            // Small icon and color
            color: '#6366F1',
          }),
          // iOS-specific
          ...(Platform.OS === 'ios' && {
            interruptionLevel: 'timeSensitive' as const,
          }),
        },
        trigger: null, // Show immediately
      });

      console.log(`[BackgroundCallManager] Call notification shown: ${callerName} - ${formatDuration(duration)}`);
    } catch (error) {
      console.error('[BackgroundCallManager] Error showing call notification:', error);
    }
  }

  async hideCallNotification(): Promise<void> {
    try {
      // Import expo-notifications dynamically
      const Notifications = await import('expo-notifications');
      
      // Dismiss the ongoing call notification
      await Notifications.dismissNotificationAsync('ongoing-call');
      
      console.log('[BackgroundCallManager] Call notification hidden');
    } catch (error) {
      console.error('[BackgroundCallManager] Error hiding call notification:', error);
    }
  }
  
  async updateCallNotificationDuration(callerName: string, duration: number): Promise<void> {
    // Update the notification with current call duration
    await this.showCallNotification(callerName, duration);
  }

  /**
   * Show a missed call notification with badge
   * This appears in the notification shade and updates the app icon badge (red dot)
   * Works on lock screen and when app is backgrounded
   */
  async showMissedCallNotification(callerName: string, callType: 'voice' | 'video'): Promise<void> {
    try {
      const Notifications = await import('expo-notifications');
      const callTypeIcon = callType === 'video' ? '📹' : '📞';
      const timestamp = new Date().toLocaleTimeString('en-ZA', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Update badge count (red dot on app icon)
      await badgeManager.addMissedCall();
      const totalBadge = badgeManager.getTotalBadgeCount();

      // Show notification in notification shade and lock screen
      await Notifications.scheduleNotificationAsync({
        identifier: `missed-call-${Date.now()}`,
        content: {
          title: `${callTypeIcon} Missed Call`,
          body: `${callerName} • ${timestamp}`,
          data: { 
            type: 'missed_call', 
            callerName,
            callType,
            timestamp: Date.now(),
          },
          // Android-specific - shows on lock screen with badge
          ...(Platform.OS === 'android' && {
            channelId: 'missed-calls', // Use dedicated missed calls channel
            priority: 'high' as const,
            vibrate: [0, 250, 250, 250],
            color: '#EF4444', // Red for missed call
          }),
          // iOS-specific
          ...(Platform.OS === 'ios' && {
            sound: 'default',
            badge: totalBadge,
            interruptionLevel: 'active' as const,
          }),
        },
        trigger: null, // Show immediately
      });

      console.log(`[BackgroundCallManager] Missed call notification shown for ${callerName}, badge: ${totalBadge}`);
    } catch (error) {
      console.error('[BackgroundCallManager] Error showing missed call notification:', error);
    }
  }

  private async handleAppBackgrounded(): Promise<void> {
    if (!this.currentCallId) return;
    
    console.log('[BackgroundCallManager] App backgrounded during call');
    
    try {
      // Calculate current call duration
      const duration = this.callStartTime 
        ? Math.floor((Date.now() - this.callStartTime) / 1000) 
        : 0;
      
      // Show ongoing call notification with caller name and duration
      await this.showCallNotification(this.currentCallerName, duration);
      
      // Start updating the notification every 30 seconds
      this.startDurationUpdates();
      
      // Maintain audio session
      await this.maintainAudioSession();
      
      // For video calls, enable picture-in-picture if available
      if (this.currentCallType === 'video') {
        await this.enablePictureInPicture(true);
      }
    } catch (error) {
      console.error('[BackgroundCallManager] Error handling app backgrounded:', error);
    }
  }
  
  private startDurationUpdates(): void {
    // Clear any existing interval
    if (this.durationUpdateInterval) {
      clearInterval(this.durationUpdateInterval);
    }
    
    // Update notification every 30 seconds with new duration
    this.durationUpdateInterval = setInterval(async () => {
      if (this.currentCallId && this.callStartTime) {
        const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
        await this.showCallNotification(this.currentCallerName, duration);
      }
    }, 30000);
  }
  
  private stopDurationUpdates(): void {
    if (this.durationUpdateInterval) {
      clearInterval(this.durationUpdateInterval);
      this.durationUpdateInterval = null;
    }
  }

  private async handleAppForegrounded(): Promise<void> {
    if (!this.currentCallId) return;
    
    console.log('[BackgroundCallManager] App foregrounded during call');
    
    try {
      // Stop updating duration
      this.stopDurationUpdates();
      
      // Hide call notification
      await this.hideCallNotification();
      
      // Disable picture-in-picture
      if (this.currentCallType === 'video') {
        await this.enablePictureInPicture(false);
      }
    } catch (error) {
      console.error('[BackgroundCallManager] Error handling app foregrounded:', error);
    }
  }

  private async cleanupAudioSession(): Promise<void> {
    try {
      if (this.audioSession) {
        await this.audioSession.unloadAsync();
        this.audioSession = null;
      }
      
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: false,
      });
    } catch (error) {
      console.error('[BackgroundCallManager] Error cleaning up audio session:', error);
    }
  }

  private async updateCallNotification(): Promise<void> {
    // Update the ongoing call notification with current duration
    // This would be called periodically by the background task
  }

  // Public methods for external use
  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  getCurrentCallType(): 'voice' | 'video' | null {
    return this.currentCallType;
  }

  isInBackgroundMode(): boolean {
    return this.isBackgroundModeActive;
  }
}

// Singleton instance
export const backgroundCallManager = new BackgroundCallManagerImpl();

// Hook for use in components
import { useEffect, useRef } from 'react';

interface UseCallBackgroundHandlerProps {
  callState: string;
  isCallActive: boolean;
  callId?: string | null;
  callType?: 'voice' | 'video';
  callerName?: string;
  onReturnFromBackground?: () => void;
}

export function useCallBackgroundHandler({
  callState,
  isCallActive,
  callId,
  callType = 'voice',
  callerName = 'EduDash Call',
  onReturnFromBackground,
}: UseCallBackgroundHandlerProps) {
  const wasInBackgroundRef = useRef(false);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && wasInBackgroundRef.current && isCallActive) {
        onReturnFromBackground?.();
        wasInBackgroundRef.current = false;
      } else if (nextAppState === 'background' && isCallActive) {
        wasInBackgroundRef.current = true;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isCallActive, onReturnFromBackground]);

  // Start/stop background mode based on call state
  useEffect(() => {
    if (callState === 'connected' && isCallActive && callId) {
      // Set caller name for notification
      backgroundCallManager.setCallerName(callerName);
      backgroundCallManager.startBackgroundMode(callId, callType);
    } else if (!isCallActive || callState === 'ended') {
      backgroundCallManager.stopBackgroundMode();
    }
  }, [callState, isCallActive, callId, callType, callerName]);
}