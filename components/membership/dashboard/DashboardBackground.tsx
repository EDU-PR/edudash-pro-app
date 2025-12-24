/**
 * Dashboard Background Component
 * Renders the organization wallpaper behind dashboard content
 */
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { DashboardSettings } from './types';

interface DashboardBackgroundProps {
  settings?: DashboardSettings;
  children: React.ReactNode;
}

export function DashboardBackground({ settings, children }: DashboardBackgroundProps) {
  const hasWallpaper = settings?.wallpaper_url;
  const opacity = settings?.wallpaper_opacity || 0.15;

  return (
    <View style={styles.container}>
      {hasWallpaper && (
        <Image
          source={{ uri: settings.wallpaper_url }}
          style={[styles.wallpaper, { opacity }]}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  wallpaper: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
});
