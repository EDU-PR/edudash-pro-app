/**
 * Draggable Dash FAB
 * 
 * A floating action button that can be dragged anywhere on screen.
 * Position is persisted and restored on app restart.
 * Can be hidden via settings.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
  Platform,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPreferencesSafe } from '@/contexts/AppPreferencesContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FAB_SIZE = 56;
const EDGE_PADDING = 16;
const BOTTOM_NAV_HEIGHT = 70; // Height of bottom nav bar

interface DraggableDashFABProps {
  bottomOffset?: number; // Extra offset for bottom nav
}

export function DraggableDashFAB({ bottomOffset = BOTTOM_NAV_HEIGHT }: DraggableDashFABProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showDashFAB, fabPosition, setFabPosition } = useAppPreferencesSafe();
  
  // Default position (bottom right, above safe area)
  const defaultX = SCREEN_WIDTH - FAB_SIZE - EDGE_PADDING;
  const defaultY = SCREEN_HEIGHT - FAB_SIZE - EDGE_PADDING - insets.bottom - bottomOffset;
  
  const [isDragging, setIsDragging] = useState(false);
  const position = useRef(new Animated.ValueXY({
    x: fabPosition?.x ?? defaultX,
    y: fabPosition?.y ?? defaultY,
  })).current;
  
  const scale = useRef(new Animated.Value(1)).current;
  
  // Update position when fabPosition changes (from storage)
  useEffect(() => {
    if (fabPosition) {
      position.setValue({ x: fabPosition.x, y: fabPosition.y });
    } else {
      position.setValue({ x: defaultX, y: defaultY });
    }
  }, [fabPosition, defaultX, defaultY]);

  // Boundaries for dragging
  const minX = EDGE_PADDING;
  const maxX = SCREEN_WIDTH - FAB_SIZE - EDGE_PADDING;
  const minY = insets.top + EDGE_PADDING;
  const maxY = SCREEN_HEIGHT - FAB_SIZE - EDGE_PADDING - insets.bottom - bottomOffset;

  // Track if gesture was a tap vs drag
  const wasDragging = useRef(false);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to pan if moved more than 10 pixels
        const isDragging = Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
        wasDragging.current = isDragging;
        return isDragging;
      },
      onPanResponderGrant: () => {
        wasDragging.current = false;
        // Haptic feedback on grab
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setIsDragging(true);
        
        // Scale up slightly when grabbed
        Animated.spring(scale, {
          toValue: 1.1,
          useNativeDriver: true,
        }).start();
        
        // Extract current position
        position.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        wasDragging.current = true;
        // Clamp position within bounds
        const newX = Math.max(minX, Math.min(maxX, gestureState.dx + (fabPosition?.x ?? defaultX)));
        const newY = Math.max(minY, Math.min(maxY, gestureState.dy + (fabPosition?.y ?? defaultY)));
        
        position.setValue({ x: newX - (fabPosition?.x ?? defaultX), y: newY - (fabPosition?.y ?? defaultY) });
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        
        // Scale back to normal
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
        
        // If it was just a tap (no significant movement), navigate
        if (!wasDragging.current && Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          position.flattenOffset();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/screens/dash-assistant');
          return;
        }
        
        // Flatten offset
        position.flattenOffset();
        
        // Get final position
        const finalX = Math.max(minX, Math.min(maxX, (fabPosition?.x ?? defaultX) + gestureState.dx));
        const finalY = Math.max(minY, Math.min(maxY, (fabPosition?.y ?? defaultY) + gestureState.dy));
        
        // Snap to nearest edge (left or right)
        const snapX = finalX < SCREEN_WIDTH / 2 ? minX : maxX;
        
        // Animate to snapped position
        Animated.spring(position, {
          toValue: { x: snapX, y: finalY },
          useNativeDriver: false,
          friction: 7,
        }).start(() => {
          // Save position
          setFabPosition({ x: snapX, y: finalY });
        });
        
        // Haptic feedback on release
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      },
    })
  ).current;

  const handlePress = async () => {
    if (isDragging) return; // Don't navigate if dragging
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics not available
    }
    router.push('/screens/dash-assistant');
  };

  if (!showDashFAB) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { scale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.fabWrapper}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Animated.View
            style={[
              styles.fab,
              {
                shadowColor: theme.primary || '#6366F1',
                opacity: isDragging ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons 
              name={isDragging ? 'move' : 'sparkles'} 
              size={26} 
              color="#FFFFFF" 
            />
          </Animated.View>
        </LinearGradient>
        
        {/* Drag indicator dot */}
        {isDragging && (
          <View style={styles.dragIndicator}>
            <View style={styles.dragDot} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1000,
  },
  fabWrapper: {
    position: 'relative',
  },
  gradient: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  dragIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dragDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
});

export default DraggableDashFAB;
