/**
 * OnlineStatusIndicator — Shows user's online/offline/last-seen status
 * 
 * A small pulsing green dot for online users, gray for offline,
 * with optional "last seen" text.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type OnlineStatus = 'online' | 'away' | 'offline';

interface OnlineStatusDotProps {
  status: OnlineStatus;
  /** Size of the dot in px */
  size?: number;
  /** Show a pulsing glow for online status */
  pulse?: boolean;
}

/**
 * Colored dot indicator for online status
 */
export function OnlineStatusDot({ status, size = 12, pulse = true }: OnlineStatusDotProps) {
  const { theme } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'online' && pulse) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulse, pulseAnim]);

  const dotColor =
    status === 'online'
      ? '#22C55E'
      : status === 'away'
        ? '#F59E0B'
        : theme.textSecondary + '60';

  const styles = StyleSheet.create({
    wrapper: {
      width: size + 4,
      height: size + 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pulseRing: {
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: dotColor + '40',
    },
    dot: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: dotColor,
      borderWidth: 2,
      borderColor: theme.surface,
    },
  });

  return (
    <View style={styles.wrapper}>
      {status === 'online' && pulse && (
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.6, 0] }) },
          ]}
        />
      )}
      <View style={styles.dot} />
    </View>
  );
}

interface OnlineStatusBadgeProps {
  status: OnlineStatus;
  lastSeen?: string | Date;
}

/**
 * Full badge with dot + "Online" / "Last seen X ago" text
 */
export function OnlineStatusBadge({ status, lastSeen }: OnlineStatusBadgeProps) {
  const { theme } = useTheme();

  const statusText = (() => {
    if (status === 'online') return 'Online';
    if (status === 'away') return 'Away';
    if (lastSeen) {
      const lastSeenDate = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
      const diffMs = Date.now() - lastSeenDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return lastSeenDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return 'Offline';
  })();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    text: {
      fontSize: 12,
      color: status === 'online' ? '#22C55E' : theme.textSecondary,
      fontWeight: status === 'online' ? '600' : '400',
    },
  });

  return (
    <View style={styles.container}>
      <OnlineStatusDot status={status} size={8} />
      <Text style={styles.text}>{statusText}</Text>
    </View>
  );
}

export default OnlineStatusDot;
export type { OnlineStatus };
