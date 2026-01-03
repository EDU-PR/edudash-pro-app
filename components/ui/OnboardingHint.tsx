/**
 * OnboardingHint Component
 * 
 * Shows contextual hints and tooltips to help users discover features.
 * Supports pulse animations, dismiss on tap, and persistence via AsyncStorage.
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { track } from '@/lib/analytics';

const { width: screenWidth } = Dimensions.get('window');

export interface OnboardingHintProps {
  /** Unique identifier for persistence */
  hintId: string;
  /** Hint message to display */
  message: string;
  /** Icon to show (optional) */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Position relative to the target element */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Show close button */
  dismissible?: boolean;
  /** Auto-hide after milliseconds (0 = never) */
  autoHideMs?: number;
  /** Show only once per user */
  showOnce?: boolean;
  /** Custom style */
  style?: any;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Pulse animation color */
  pulseColor?: string;
  /** Screen for analytics */
  screen?: string;
}

const STORAGE_PREFIX = 'hint:dismissed:';

export function OnboardingHint({
  hintId,
  message,
  icon = 'bulb',
  position = 'bottom',
  dismissible = true,
  autoHideMs = 0,
  showOnce = true,
  style,
  onDismiss,
  pulseColor,
  screen = 'unknown',
}: OnboardingHintProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const actualPulseColor = pulseColor || theme.primary;

  // Check if hint was previously dismissed
  useEffect(() => {
    const checkDismissed = async () => {
      if (showOnce) {
        try {
          const wasDismissed = await AsyncStorage.getItem(`${STORAGE_PREFIX}${hintId}`);
          if (wasDismissed === 'true') {
            setDismissed(true);
            return;
          }
        } catch (error) {
          console.warn('[OnboardingHint] Error checking dismissed state:', error);
        }
      }
      // Show hint with animation
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      track('onboarding.hint_shown', { hintId, screen });
    };
    
    checkDismissed();
  }, [hintId, showOnce, fadeAnim, screen]);

  // Pulse animation
  useEffect(() => {
    if (!visible || dismissed) return;
    
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [visible, dismissed, pulseAnim]);

  // Auto-hide
  useEffect(() => {
    if (autoHideMs > 0 && visible && !dismissed) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [autoHideMs, visible, dismissed]);

  const handleDismiss = async () => {
    track('onboarding.hint_dismissed', { hintId, screen });
    
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      setDismissed(true);
      setVisible(false);
      
      // Persist dismissal
      if (showOnce) {
        try {
          await AsyncStorage.setItem(`${STORAGE_PREFIX}${hintId}`, 'true');
        } catch (error) {
          console.warn('[OnboardingHint] Error saving dismissed state:', error);
        }
      }
      
      onDismiss?.();
    });
  };

  if (!visible || dismissed) return null;

  const positionStyles = {
    top: { marginBottom: 8 },
    bottom: { marginTop: 8 },
    left: { marginRight: 8 },
    right: { marginLeft: 8 },
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          backgroundColor: theme.cardBackground,
          borderColor: actualPulseColor + '40',
          opacity: fadeAnim,
          transform: [{ scale: pulseAnim }],
        },
        positionStyles[position],
        style,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: actualPulseColor + '20' }]}>
        <Ionicons name={icon} size={18} color={actualPulseColor} />
      </View>
      
      <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>
        {message}
      </Text>
      
      {dismissible && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
      
      {/* Arrow indicator */}
      <View
        style={[
          styles.arrow,
          position === 'top' && styles.arrowBottom,
          position === 'bottom' && styles.arrowTop,
          { borderTopColor: theme.cardBackground },
        ]}
      />
    </Animated.View>
  );
}

/**
 * Helper to reset all hints (for testing or settings)
 */
export async function resetAllHints(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const hintKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    if (hintKeys.length > 0) {
      await AsyncStorage.multiRemove(hintKeys);
    }
  } catch (error) {
    console.warn('[OnboardingHint] Error resetting hints:', error);
  }
}

/**
 * Check if a specific hint was dismissed
 */
export async function wasHintDismissed(hintId: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(`${STORAGE_PREFIX}${hintId}`);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Hook to manage onboarding hint visibility state
 * Returns [shouldShow, dismiss] tuple
 */
export function useOnboardingHint(hintId: string): [boolean, () => void] {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const checkHint = async () => {
      try {
        const wasDismissed = await AsyncStorage.getItem(`${STORAGE_PREFIX}${hintId}`);
        if (wasDismissed !== 'true') {
          setShouldShow(true);
        }
      } catch (error) {
        console.warn('[useOnboardingHint] Error checking hint state:', error);
        // Default to showing the hint if we can't check
        setShouldShow(true);
      }
    };
    checkHint();
  }, [hintId]);

  const dismiss = async () => {
    setShouldShow(false);
    try {
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${hintId}`, 'true');
      track('onboarding.hint_dismissed', { hintId, source: 'hook' });
    } catch (error) {
      console.warn('[useOnboardingHint] Error saving dismissed state:', error);
    }
  };

  return [shouldShow, dismiss];
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: screenWidth - 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  arrowTop: {
    top: -8,
    left: '50%',
    marginLeft: -8,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowBottom: {
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

export default OnboardingHint;
