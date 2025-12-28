/**
 * CallKeep Manager (STUBBED)
 * 
 * DISABLED: react-native-callkeep has been removed due to Expo SDK 54+ incompatibility.
 * The library has a bug causing duplicate method exports on Android, which breaks builds.
 * See: https://github.com/react-native-webrtc/react-native-callkeep/issues/866-869
 * 
 * This file provides stub implementations for backward compatibility with any code
 * that may still reference the callKeepManager singleton.
 * 
 * Alternative approach: Using expo-notifications foreground service for maintaining
 * calls when the app is backgrounded.
 */

import { EventEmitter } from 'events';

/**
 * Events that would be emitted by CallKeepManager
 */
export interface CallKeepEvents {
  answerCall: (callUUID: string) => void;
  endCall: (callUUID: string) => void;
  muteCall: (callUUID: string, muted: boolean) => void;
  holdCall: (callUUID: string, hold: boolean) => void;
}

export interface CallKeepConfig {
  appName: string;
  supportsVideo: boolean;
  imageName?: string;
  ringtoneSound?: string;
}

/**
 * Stubbed CallKeepManager class
 * All methods are no-ops that return safe default values
 */
class CallKeepManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
    console.log('[CallKeepManager] STUBBED - CallKeep is disabled due to Expo SDK 54+ incompatibility');
  }
  
  /**
   * Setup is a no-op - always returns false indicating CallKeep is not available
   */
  async setup(_config: CallKeepConfig): Promise<boolean> {
    console.warn('[CallKeepManager] setup() called but CallKeep is disabled');
    return false;
  }
  
  /**
   * Display incoming call - no-op
   */
  async displayIncomingCall(
    _callId: string,
    _callerName: string,
    _hasVideo: boolean = false
  ): Promise<void> {
    console.warn('[CallKeepManager] displayIncomingCall() called but CallKeep is disabled');
  }
  
  /**
   * Start outgoing call - no-op
   */
  async startCall(_callId: string, _calleeName: string, _hasVideo: boolean = false): Promise<void> {
    console.warn('[CallKeepManager] startCall() called but CallKeep is disabled');
  }
  
  /**
   * Report call connected - no-op
   */
  async reportConnected(_callId: string): Promise<void> {
    console.warn('[CallKeepManager] reportConnected() called but CallKeep is disabled');
  }
  
  /**
   * End call - no-op
   */
  async endCall(_callId: string): Promise<void> {
    console.warn('[CallKeepManager] endCall() called but CallKeep is disabled');
  }
  
  /**
   * End all calls - no-op
   */
  async endAllCalls(): Promise<void> {
    console.warn('[CallKeepManager] endAllCalls() called but CallKeep is disabled');
  }
  
  /**
   * Set on hold - no-op
   */
  async setOnHold(_callId: string, _hold: boolean): Promise<void> {
    console.warn('[CallKeepManager] setOnHold() called but CallKeep is disabled');
  }
  
  /**
   * Set muted - no-op
   */
  async setMuted(_callId: string, _muted: boolean): Promise<void> {
    console.warn('[CallKeepManager] setMuted() called but CallKeep is disabled');
  }
  
  /**
   * Always returns false - CallKeep is not available
   */
  isAvailable(): boolean {
    return false;
  }
  
  /**
   * Always returns null - no active call via CallKeep
   */
  getActiveCallId(): string | null {
    return null;
  }
  
  /**
   * Cleanup - no-op
   */
  cleanup(): void {
    // No-op
  }
}

// Export singleton instance
export const callKeepManager = new CallKeepManager();

// Export for testing
export { CallKeepManager };

