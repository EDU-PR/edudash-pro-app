/**
 * Dashboard Wallpaper Background Component
 * Renders the organization wallpaper as a background layer on any screen
 */
import React from 'react';
import { View, Image, StyleSheet, ImageBackground } from 'react-native';
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';

interface DashboardWallpaperBackgroundProps {
  children: React.ReactNode;
  /** Override the opacity from organization settings */
  opacity?: number;
  /** Skip wallpaper rendering (useful for specific screens) */
  disabled?: boolean;
}

export function DashboardWallpaperBackground({ 
  children, 
  opacity: overrideOpacity,
  disabled = false,
}: DashboardWallpaperBackgroundProps) {
  const { settings } = useOrganizationBranding();
  
  const wallpaperUrl = settings?.wallpaper_url;
  const wallpaperOpacity = overrideOpacity ?? settings?.wallpaper_opacity ?? 0.15;
  
  // No wallpaper set or disabled
  if (!wallpaperUrl || disabled) {
    return <View style={styles.container}>{children}</View>;
  }
  
  return (
    <View style={styles.container}>
      {/* Wallpaper layer */}
      <Image
        key={wallpaperUrl}
        source={{ uri: wallpaperUrl }}
        style={[styles.wallpaper, { opacity: wallpaperOpacity }]}
        resizeMode="cover"
        blurRadius={2}
      />
      {/* Content layer */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

/**
 * Hook to get wallpaper settings for manual usage
 */
export function useWallpaperSettings() {
  const { settings } = useOrganizationBranding();
  
  return {
    wallpaperUrl: settings?.wallpaper_url || null,
    wallpaperOpacity: settings?.wallpaper_opacity ?? 0.15,
    customGreeting: settings?.custom_greeting || null,
    hasWallpaper: !!settings?.wallpaper_url,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
