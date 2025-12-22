/**
 * Enhanced Audio and Camera Permissions Manager
 * 
 * Comprehensive permissions handling for voice and video calls
 * with proper error handling and user guidance.
 */

import { Alert, Linking } from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

interface PermissionResult {
  granted: boolean;
  canAskAgain?: boolean;
  error?: string;
}

interface PermissionStatus {
  camera: PermissionResult;
  microphone: PermissionResult;
  notifications: PermissionResult;
}

class EnhancedPermissionsManager {
  
  /**
   * Check and request camera permissions
   */
  async requestCameraPermission(): Promise<PermissionResult> {
    try {
      console.log('[Permissions] Requesting camera permission');
      
      // Check current status
      const { status: existingStatus } = await Camera.getCameraPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return { granted: true };
      }
      
      // Request permission
      const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
      
      if (status === 'granted') {
        console.log('[Permissions] Camera permission granted');
        return { granted: true };
      } else {
        console.warn('[Permissions] Camera permission denied:', status);
        return { 
          granted: false, 
          canAskAgain,
          error: this.getCameraPermissionError(status, canAskAgain)
        };
      }
    } catch (error) {
      console.error('[Permissions] Camera permission error:', error);
      return { 
        granted: false, 
        error: 'Failed to request camera permission'
      };
    }
  }

  /**
   * Check and request microphone permissions
   */
  async requestMicrophonePermission(): Promise<PermissionResult> {
    try {
      console.log('[Permissions] Requesting microphone permission');
      
      // Check current status
      const { status: existingStatus } = await Audio.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return { granted: true };
      }
      
      // Request permission
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      
      if (status === 'granted') {
        console.log('[Permissions] Microphone permission granted');
        return { granted: true };
      } else {
        console.warn('[Permissions] Microphone permission denied:', status);
        return { 
          granted: false, 
          canAskAgain,
          error: this.getMicrophonePermissionError(status, canAskAgain)
        };
      }
    } catch (error) {
      console.error('[Permissions] Microphone permission error:', error);
      return { 
        granted: false, 
        error: 'Failed to request microphone permission'
      };
    }
  }

  /**
   * Check all permissions required for video calls
   */
  async checkVideoCallPermissions(): Promise<PermissionStatus> {
    const [camera, microphone, notifications] = await Promise.all([
      this.requestCameraPermission(),
      this.requestMicrophonePermission(),
      this.checkNotificationPermissions(),
    ]);

    return { camera, microphone, notifications };
  }

  /**
   * Check all permissions required for voice calls
   */
  async checkVoiceCallPermissions(): Promise<PermissionStatus> {
    const [microphone, notifications] = await Promise.all([
      this.requestMicrophonePermission(),
      this.checkNotificationPermissions(),
    ]);

    return { 
      camera: { granted: true }, // Not needed for voice calls
      microphone, 
      notifications 
    };
  }

  /**
   * Check notification permissions (important for background calls)
   */
  async checkNotificationPermissions(): Promise<PermissionResult> {
    try {
      // For now, return granted since notification permissions 
      // are handled by expo-notifications plugin
      return { granted: true };
    } catch (error) {
      console.error('[Permissions] Notification permission error:', error);
      return { 
        granted: false, 
        error: 'Failed to check notification permissions'
      };
    }
  }

  /**
   * Show comprehensive permission dialog for video calls
   */
  async showVideoCallPermissionDialog(): Promise<boolean> {
    const permissions = await this.checkVideoCallPermissions();
    
    const missing: string[] = [];
    if (!permissions.camera.granted) missing.push('Camera');
    if (!permissions.microphone.granted) missing.push('Microphone');
    
    if (missing.length === 0) {
      return true; // All permissions granted
    }

    return new Promise((resolve) => {
      Alert.alert(
        'Permissions Required for Video Call',
        `EduDash Pro needs access to your ${missing.join(' and ')} to enable video calls with teachers and parents.\n\nWithout these permissions, video calls will not work properly.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Settings',
            onPress: () => {
              Linking.openSettings();
              resolve(false);
            },
          },
          {
            text: 'Retry',
            onPress: async () => {
              const retryResult = await this.checkVideoCallPermissions();
              resolve(retryResult.camera.granted && retryResult.microphone.granted);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show comprehensive permission dialog for voice calls
   */
  async showVoiceCallPermissionDialog(): Promise<boolean> {
    const permissions = await this.checkVoiceCallPermissions();
    
    if (permissions.microphone.granted) {
      return true; // All permissions granted
    }

    return new Promise((resolve) => {
      Alert.alert(
        'Microphone Permission Required',
        'EduDash Pro needs access to your microphone to enable voice calls with teachers and parents.\n\nWithout microphone access, voice calls will not work.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Settings',
            onPress: () => {
              Linking.openSettings();
              resolve(false);
            },
          },
          {
            text: 'Retry',
            onPress: async () => {
              const retryResult = await this.checkVoiceCallPermissions();
              resolve(retryResult.microphone.granted);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Quick permission check without showing dialogs
   */
  async hasRequiredPermissions(callType: 'voice' | 'video'): Promise<boolean> {
    if (callType === 'voice') {
      const permissions = await this.checkVoiceCallPermissions();
      return permissions.microphone.granted;
    } else {
      const permissions = await this.checkVideoCallPermissions();
      return permissions.camera.granted && permissions.microphone.granted;
    }
  }

  /**
   * Get user-friendly error message for camera permission
   */
  private getCameraPermissionError(status: string, canAskAgain?: boolean): string {
    if (!canAskAgain) {
      return 'Camera permission was permanently denied. Please enable it in Settings > EduDash Pro > Camera.';
    }
    
    switch (status) {
      case 'denied':
        return 'Camera access is required for video calls. Please allow camera access when prompted.';
      case 'restricted':
        return 'Camera access is restricted on this device.';
      default:
        return 'Unable to access camera. Please check your device settings.';
    }
  }

  /**
   * Get user-friendly error message for microphone permission
   */
  private getMicrophonePermissionError(status: string, canAskAgain?: boolean): string {
    if (!canAskAgain) {
      return 'Microphone permission was permanently denied. Please enable it in Settings > EduDash Pro > Microphone.';
    }
    
    switch (status) {
      case 'denied':
        return 'Microphone access is required for calls. Please allow microphone access when prompted.';
      case 'restricted':
        return 'Microphone access is restricted on this device.';
      default:
        return 'Unable to access microphone. Please check your device settings.';
    }
  }

  /**
   * Test microphone functionality
   */
  async testMicrophone(): Promise<{ working: boolean; error?: string }> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') {
        return { working: false, error: 'Microphone permission not granted' };
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Try to create a recording (but don't actually record)
      const recording = new Audio.Recording();
      try {
        await recording.prepareToRecordAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.MIN,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });
        await recording.getURI(); // Test if we can get URI
        
        return { working: true };
      } catch (recordingError) {
        console.error('[Permissions] Microphone test failed:', recordingError);
        return { working: false, error: 'Microphone is not responding properly' };
      } finally {
        try {
          await recording.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.warn('[Permissions] Recording cleanup error:', cleanupError);
        }
      }
    } catch (error) {
      console.error('[Permissions] Microphone test error:', error);
      return { working: false, error: 'Failed to test microphone' };
    }
  }

  /**
   * Test camera functionality
   */
  async testCamera(): Promise<{ working: boolean; error?: string }> {
    try {
      const { status } = await Camera.getCameraPermissionsAsync();
      if (status !== 'granted') {
        return { working: false, error: 'Camera permission not granted' };
      }

      // Camera is accessible if permission is granted
      // Actual camera test would require mounting Camera component
      return { working: true };
    } catch (error) {
      console.error('[Permissions] Camera test error:', error);
      return { working: false, error: 'Failed to test camera' };
    }
  }
}

// Singleton instance
export const enhancedPermissionsManager = new EnhancedPermissionsManager();

// Export types for use in components
export type { PermissionResult, PermissionStatus };