/**
 * ConnectionStatusBar — thin animated bar shown at the top of chat when
 * the Supabase Realtime connection is degraded or lost.
 *
 * States:
 *  - connected → hidden (no bar)
 *  - connecting / reconnecting → yellow bar "Connecting..."
 *  - disconnected → red bar "No connection. Messages will be sent when you're back online."
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRealtimeConnectionState, type ConnectionState } from '@/hooks/messaging/useRealtimeConnectionState';

interface ConnectionStatusBarProps {
  /** Override internal hook state (for testing / storybook) */
  overrideState?: ConnectionState;
}

const BAR_HEIGHT = 28;

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = React.memo(({ overrideState }) => {
  const { state: hookState } = useRealtimeConnectionState();
  const state = overrideState ?? hookState;
  const heightAnim = useRef(new Animated.Value(0)).current;

  const visible = state !== 'connected';

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: visible ? BAR_HEIGHT : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [visible, heightAnim]);

  if (state === 'connected') {
    return <Animated.View style={{ height: heightAnim }} />;
  }

  const isDisconnected = state === 'disconnected';
  const bgColor = isDisconnected ? '#dc2626' : '#d97706';
  const icon = isDisconnected ? 'cloud-offline-outline' : 'sync-outline';
  const label = isDisconnected
    ? 'No connection. Messages will be sent when you\u2019re back online.'
    : 'Connecting\u2026';

  return (
    <Animated.View style={[styles.bar, { height: heightAnim, backgroundColor: bgColor }]}>
      <View style={styles.inner}>
        <Ionicons name={icon} size={14} color="#fff" />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
