/**
 * ConnectionStatusBar — thin animated bar shown at the top of chat when
 * the Supabase Realtime connection is lost.
 *
 * Only the `disconnected` state is surfaced — transient connecting/reconnecting
 * states are hidden since the online/offline indicator next to the user's name
 * already conveys presence. The bar auto-hides after 5 seconds.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRealtimeConnectionState, type ConnectionState } from '@/hooks/messaging/useRealtimeConnectionState';

interface ConnectionStatusBarProps {
  /** Override internal hook state (for testing / storybook) */
  overrideState?: ConnectionState;
}

const BAR_HEIGHT = 20;
const AUTO_HIDE_MS = 5_000;

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = React.memo(({ overrideState }) => {
  const { state: hookState } = useRealtimeConnectionState();
  const state = overrideState ?? hookState;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const [dismissed, setDismissed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldShow = state === 'disconnected' && !dismissed;

  useEffect(() => {
    if (state === 'disconnected') {
      setDismissed(false);
    }
  }, [state]);

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (shouldShow) {
      hideTimer.current = setTimeout(() => setDismissed(true), AUTO_HIDE_MS);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [shouldShow]);

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: shouldShow ? BAR_HEIGHT : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [shouldShow, heightAnim]);

  if (!shouldShow) {
    return <Animated.View style={{ height: heightAnim }} />;
  }

  return (
    <Animated.View style={[styles.bar, { height: heightAnim }]}>
      <View style={styles.inner}>
        <Ionicons name="cloud-offline-outline" size={12} color="#e2e8f0" />
        <Text style={styles.label} numberOfLines={1}>
          Offline · Messages will be queued
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#475569',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '500',
  },
});
