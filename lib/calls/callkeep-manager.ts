/**
 * CallKeep Manager
 * 
 * Manages native call UI integration for iOS and Android
 * Enables calls to display and ring even when device is locked
 * 
 * Features:
 * - Native call screen (lock screen UI)
 * - Wake screen for incoming calls
 * - Audio routing through system call UI
 * - Integrates with VoiceCallInterface and WhatsAppStyleIncomingCall
 * - Event emitter for answer/end actions from native UI
 */

import { Platform } from 'react-native';
import { EventEmitter } from 'events';

/**
 * Events emitted by CallKeepManager
 * - 'answerCall': User answered call from native UI (callUUID: string)
 * - 'endCall': User ended call from native UI (callUUID: string)
 * - 'muteCall': User toggled mute from native UI (callUUID: string, muted: boolean)
 * - 'holdCall': User toggled hold from native UI (callUUID: string, hold: boolean)
 */
export interface CallKeepEvents {
  answerCall: (callUUID: string) => void;
  endCall: (callUUID: string) => void;
  muteCall: (callUUID: string, muted: boolean) => void;
  holdCall: (callUUID: string, hold: boolean) => void;
}

// Conditionally import CallKeep (may not be available in some environments)
let RNCallKeep: any = null;
try {
  RNCallKeep = require('react-native-callkeep').default;
} catch (error) {
  console.warn('[CallKeepManager] react-native-callkeep not available:', error);
}

// Conditionally import InCallManager
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch (error) {
  console.warn('[CallKeepManager] InCallManager not available:', error);
}

export interface CallKeepConfig {
  appName: string;
  supportsVideo: boolean;
  imageName?: string;
  ringtoneSound?: string;
}

class CallKeepManager extends EventEmitter {
  private isSetup = false;
  private activeCallId: string | null = null;
  
  constructor() {
    super();
    // Set max listeners to avoid warnings with multiple CallProvider instances
    this.setMaxListeners(20);
  }
  
  /**
   * Initialize CallKeep with app configuration
   */
  async setup(config: CallKeepConfig): Promise<boolean> {
    if (!RNCallKeep) {
      // Only log warning in production - expected in development/Expo Go
      if (typeof __DEV__ === 'undefined' || !__DEV__) {
        console.warn('[CallKeepManager] CallKeep not available');
      }
      return false;
    }
    
    if (this.isSetup) {
      return true;
    }
    
    try {
      const options = {
        ios: {
          appName: config.appName,
          imageName: config.imageName || 'AppIcon',
          ringtoneSound: config.ringtoneSound || 'ringtone.mp3',
          supportsVideo: config.supportsVideo,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
        },
        android: {
          alertTitle: 'Permissions Required',
          alertDescription: 'This application needs access to your phone accounts to make calls.',
          cancelButton: 'Cancel',
          okButton: 'OK',
          imageName: config.imageName || 'ic_launcher',
          additionalPermissions: [],
          selfManaged: true, // Important for Android 11+
          foregroundService: {
            channelId: 'com.edudashpro.app.calls',
            channelName: 'Voice & Video Calls',
            notificationTitle: 'EduDash Call in progress',
            notificationIcon: 'ic_launcher',
          },
        },
      };
      
      await RNCallKeep.setup(options);
      
      // Register event listeners
      this.registerEventListeners();
      
      // Request permissions
      if (Platform.OS === 'android') {
        const granted = await RNCallKeep.checkPhoneAccountPermission();
        if (!granted) {
          await RNCallKeep.requestPhoneAccountPermission();
        }
      }
      
      this.isSetup = true;
      console.log('[CallKeepManager] Setup complete');
      return true;
    } catch (error) {
      console.error('[CallKeepManager] Setup failed:', error);
      return false;
    }
  }
  
  /**
   * Register CallKeep event listeners
   */
  private registerEventListeners() {
    if (!RNCallKeep) return;
    
    RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
      console.log('[CallKeepManager] Answer call from native UI:', callUUID);
      // Emit event so CallProvider can handle the answer
      this.emit('answerCall', callUUID);
    });
    
    RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
      console.log('[CallKeepManager] End call from native UI:', callUUID);
      // Emit event so CallProvider can handle the end
      this.emit('endCall', callUUID);
      // Also end the call in CallKeep
      this.endCall(callUUID);
    });
    
    RNCallKeep.addEventListener('didPerformDTMFAction', ({ callUUID, digits }: { callUUID: string; digits: string }) => {
      console.log('[CallKeepManager] DTMF:', callUUID, digits);
    });
    
    RNCallKeep.addEventListener('didToggleHoldCallAction', ({ callUUID, hold }: { callUUID: string; hold: boolean }) => {
      console.log('[CallKeepManager] Hold toggled from native UI:', callUUID, hold);
      this.emit('holdCall', callUUID, hold);
    });
    
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ callUUID, muted }: { callUUID: string; muted: boolean }) => {
      console.log('[CallKeepManager] Mute toggled from native UI:', callUUID, muted);
      this.emit('muteCall', callUUID, muted);
    });
  }
  
  /**
   * Display incoming call screen (works even when device is locked)
   */
  async displayIncomingCall(
    callId: string,
    callerName: string,
    hasVideo: boolean = false
  ): Promise<void> {
    if (!RNCallKeep) {
      console.warn('[CallKeepManager] CallKeep not available for incoming call');
      return;
    }
    
    try {
      this.activeCallId = callId;
      
      await RNCallKeep.displayIncomingCall(
        callId,
        callerName,
        callerName,
        'generic',
        hasVideo
      );
      
      console.log('[CallKeepManager] Incoming call displayed:', {
        callId,
        callerName,
        hasVideo,
      });
    } catch (error) {
      console.error('[CallKeepManager] Failed to display incoming call:', error);
    }
  }
  
  /**
   * Start outgoing call
   */
  async startCall(callId: string, calleeName: string, hasVideo: boolean = false): Promise<void> {
    if (!RNCallKeep) return;
    
    try {
      this.activeCallId = callId;
      
      await RNCallKeep.startCall(callId, calleeName, calleeName, 'generic', hasVideo);
      
      console.log('[CallKeepManager] Outgoing call started:', {
        callId,
        calleeName,
        hasVideo,
      });
    } catch (error) {
      console.error('[CallKeepManager] Failed to start call:', error);
    }
  }
  
  /**
   * Report call connected
   */
  async reportConnected(callId: string): Promise<void> {
    if (!RNCallKeep) return;
    
    try {
      await RNCallKeep.reportConnectedOutgoingCallWithUUID(callId);
      console.log('[CallKeepManager] Call connected:', callId);
    } catch (error) {
      console.error('[CallKeepManager] Failed to report connected:', error);
    }
  }
  
  /**
   * End call and remove from system UI
   */
  async endCall(callId: string): Promise<void> {
    if (!RNCallKeep) return;
    
    try {
      await RNCallKeep.endCall(callId);
      
      if (this.activeCallId === callId) {
        this.activeCallId = null;
      }
      
      console.log('[CallKeepManager] Call ended:', callId);
    } catch (error) {
      console.error('[CallKeepManager] Failed to end call:', error);
    }
  }
  
  /**
   * End all active calls
   */
  async endAllCalls(): Promise<void> {
    if (!RNCallKeep) return;
    
    try {
      await RNCallKeep.endAllCalls();
      this.activeCallId = null;
      console.log('[CallKeepManager] All calls ended');
    } catch (error) {
      console.error('[CallKeepManager] Failed to end all calls:', error);
    }
  }
  
  /**
   * Set call on hold
   */
  async setOnHold(callId: string, hold: boolean): Promise<void> {
    if (!RNCallKeep) return;
    
    try {
      await RNCallKeep.setOnHold(callId, hold);
      console.log('[CallKeepManager] Call hold:', callId, hold);
    } catch (error) {
      console.error('[CallKeepManager] Failed to set hold:', error);
    }
  }
  
  /**
   * Set call muted
   */
  async setMuted(callId: string, muted: boolean): Promise<void> {
    if (!RNCallKeep) return;
    
    try {
      await RNCallKeep.setMutedCall(callId, muted);
      console.log('[CallKeepManager] Call muted:', callId, muted);
    } catch (error) {
      console.error('[CallKeepManager] Failed to set mute:', error);
    }
  }
  
  /**
   * Check if CallKeep is available and setup
   */
  isAvailable(): boolean {
    return !!RNCallKeep && this.isSetup;
  }
  
  /**
   * Get current active call ID
   */
  getActiveCallId(): string | null {
    return this.activeCallId;
  }
  
  /**
   * Cleanup - remove all listeners
   */
  cleanup() {
    if (!RNCallKeep) return;
    
    try {
      RNCallKeep.removeEventListener('answerCall');
      RNCallKeep.removeEventListener('endCall');
      RNCallKeep.removeEventListener('didPerformDTMFAction');
      RNCallKeep.removeEventListener('didToggleHoldCallAction');
      RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
      
      console.log('[CallKeepManager] Cleanup complete');
    } catch (error) {
      console.error('[CallKeepManager] Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const callKeepManager = new CallKeepManager();

// Export for testing
export { CallKeepManager };

