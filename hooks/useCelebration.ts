/**
 * Use Celebration Hook
 * 
 * Provides haptic feedback and celebration animations for milestone achievements
 * Used in Picture of Progress and other celebratory moments in the app
 * 
 * @module useCelebration
 */

import { useRef, useCallback } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

export type CelebrationType = 'milestone' | 'success' | 'upload' | 'achievement' | 'encouragement';

export interface CelebrationOptions {
  type?: CelebrationType;
  haptic?: boolean;
  vibration?: boolean;
  duration?: number;
}

export interface UseCelebrationReturn {
  celebrate: (options?: CelebrationOptions) => Promise<void>;
  milestoneHaptic: () => Promise<void>;
  successHaptic: () => Promise<void>;
  lightHaptic: () => Promise<void>;
  errorHaptic: () => Promise<void>;
  selectionHaptic: () => Promise<void>;
  isHapticsAvailable: boolean;
}

/**
 * Hook for celebration haptics and animations
 * 
 * Usage:
 * ```tsx
 * const { celebrate, milestoneHaptic, successHaptic } = useCelebration();
 * 
 * // On milestone achievement
 * await celebrate({ type: 'milestone' });
 * 
 * // Quick success feedback
 * await successHaptic();
 * ```
 */
export function useCelebration(): UseCelebrationReturn {
  const lastHapticTime = useRef<number>(0);
  
  // Check if haptics are available (iOS and Android with haptic hardware)
  const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
  
  // Throttle haptics to prevent rapid-fire (min 100ms between)
  const canTriggerHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticTime.current < 100) {
      return false;
    }
    lastHapticTime.current = now;
    return true;
  }, []);
  
  /**
   * Light selection haptic - for button taps, selections
   */
  const selectionHaptic = useCallback(async () => {
    if (!isHapticsAvailable || !canTriggerHaptic()) return;
    
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.debug('Haptic selection unavailable:', error);
    }
  }, [isHapticsAvailable, canTriggerHaptic]);
  
  /**
   * Light impact haptic - for minor feedback
   */
  const lightHaptic = useCallback(async () => {
    if (!isHapticsAvailable || !canTriggerHaptic()) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.debug('Haptic impact unavailable:', error);
    }
  }, [isHapticsAvailable, canTriggerHaptic]);
  
  /**
   * Success haptic - for confirmations, uploads
   */
  const successHaptic = useCallback(async () => {
    if (!isHapticsAvailable || !canTriggerHaptic()) return;
    
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.debug('Haptic notification unavailable:', error);
    }
  }, [isHapticsAvailable, canTriggerHaptic]);
  
  /**
   * Error haptic - for validation errors
   */
  const errorHaptic = useCallback(async () => {
    if (!isHapticsAvailable || !canTriggerHaptic()) return;
    
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.debug('Haptic notification unavailable:', error);
    }
  }, [isHapticsAvailable, canTriggerHaptic]);
  
  /**
   * Milestone celebration haptic - extra special pattern for big achievements
   * Creates a "ta-da!" feel with multiple impacts
   */
  const milestoneHaptic = useCallback(async () => {
    if (!isHapticsAvailable) {
      // Fallback to vibration if haptics unavailable
      Vibration.vibrate([0, 100, 100, 100, 100, 200]);
      return;
    }
    
    try {
      // First impact - attention
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second impact - building excitement
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Success notification - the celebration!
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.debug('Milestone haptic unavailable:', error);
      // Fallback
      Vibration.vibrate([0, 100, 100, 100, 100, 200]);
    }
  }, [isHapticsAvailable]);
  
  /**
   * Main celebrate function - combines haptics based on celebration type
   */
  const celebrate = useCallback(async (options?: CelebrationOptions) => {
    const { 
      type = 'success', 
      haptic = true,
      vibration = false,
      duration,
    } = options || {};
    
    if (!haptic && !vibration) return;
    
    // Vibration fallback if requested
    if (vibration && !isHapticsAvailable) {
      Vibration.vibrate(duration || 100);
      return;
    }
    
    if (!haptic) return;
    
    switch (type) {
      case 'milestone':
        await milestoneHaptic();
        break;
        
      case 'achievement':
        // Strong double tap for achievements
        if (isHapticsAvailable) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await new Promise(resolve => setTimeout(resolve, 150));
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        break;
        
      case 'upload':
        // Quick success for uploads
        await successHaptic();
        break;
        
      case 'encouragement':
        // Soft encouragement tap
        await lightHaptic();
        break;
        
      case 'success':
      default:
        await successHaptic();
        break;
    }
  }, [milestoneHaptic, successHaptic, lightHaptic, isHapticsAvailable]);
  
  return {
    celebrate,
    milestoneHaptic,
    successHaptic,
    lightHaptic,
    errorHaptic,
    selectionHaptic,
    isHapticsAvailable,
  };
}

/**
 * Get celebration emoji based on type
 */
export function getCelebrationEmoji(type: CelebrationType): string {
  switch (type) {
    case 'milestone':
      return '🎉';
    case 'achievement':
      return '🏆';
    case 'upload':
      return '✅';
    case 'encouragement':
      return '💪';
    case 'success':
    default:
      return '⭐';
  }
}

/**
 * Get celebration message based on type
 */
export function getCelebrationMessage(type: CelebrationType): string {
  switch (type) {
    case 'milestone':
      return "Amazing milestone achieved! 🎉";
    case 'achievement':
      return "What an accomplishment! 🏆";
    case 'upload':
      return "Uploaded successfully! ✅";
    case 'encouragement':
      return "You've got this! 💪";
    case 'success':
    default:
      return "Great job! ⭐";
  }
}
