/**
 * Background Call Handler
 * 
 * Manages background call functionality including:
 * - Picture-in-picture for video calls
 * - Background audio routing
 * - Notification management
 * - Call state persistence
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { callKeepManager } from './callkeep-manager';

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
}

class BackgroundCallManagerImpl implements BackgroundCallManager {
  private currentCallId: string | null = null;
  private currentCallType: 'voice' | 'video' | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private audioSession: Audio.Sound | null = null;
  private isBackgroundModeActive = false;

  constructor() {
    this.setupAppStateListener();
    this.registerBackgroundTask();
  }

  private setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
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

      // This would integrate with expo-notifications or native push notifications
      console.log(`[BackgroundCallManager] Call notification: ${callerName} - ${formatDuration(duration)}`);
    } catch (error) {
      console.error('[BackgroundCallManager] Error showing call notification:', error);
    }
  }

  async hideCallNotification(): Promise<void> {
    try {
      // Hide the ongoing call notification
      console.log('[BackgroundCallManager] Hiding call notification');
    } catch (error) {
      console.error('[BackgroundCallManager] Error hiding call notification:', error);
    }
  }

  private async handleAppBackgrounded(): Promise<void> {
    if (!this.currentCallId) return;
    
    console.log('[BackgroundCallManager] App backgrounded during call');
    
    try {
      // Show ongoing call notification
      await this.showCallNotification('EduDash Call', 0);
      
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

  private async handleAppForegrounded(): Promise<void> {
    if (!this.currentCallId) return;
    
    console.log('[BackgroundCallManager] App foregrounded during call');
    
    try {
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
  onReturnFromBackground?: () => void;
}

export function useCallBackgroundHandler({
  callState,
  isCallActive,
  callId,
  callType = 'voice',
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
      backgroundCallManager.startBackgroundMode(callId, callType);
    } else if (!isCallActive || callState === 'ended') {
      backgroundCallManager.stopBackgroundMode();
    }
  }, [callState, isCallActive, callId, callType]);
}