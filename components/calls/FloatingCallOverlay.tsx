/**
 * Floating Call Overlay - Persistent mini call UI
 * 
 * WhatsApp-style floating call bubble that:
 * - Shows when there's an active call but the full modal is closed
 * - Tap to return to full call UI
 * - Long press to end call
 * - Draggable to reposition on screen
 * 
 * Rendered at ROOT level and persists across navigation.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallSafe } from './CallProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MINIMIZED_SIZE = 64;

export function FloatingCallOverlay() {
  const callContext = useCallSafe();
  
  const pan = React.useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - MINIMIZED_SIZE - 16, y: 100 })).current;
  const scale = React.useRef(new Animated.Value(1)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to drag if moved more than 5 pixels (prevent accidental drags)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        Animated.spring(scale, {
          toValue: 1.1,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
        }).start();

        // Snap to edges
        let finalX = (pan.x as any)._value;
        let finalY = (pan.y as any)._value;

        // Keep within screen bounds
        const maxX = SCREEN_WIDTH - MINIMIZED_SIZE - 16;
        const maxY = SCREEN_HEIGHT - MINIMIZED_SIZE - 100; // Account for nav bar
        
        finalX = Math.max(16, Math.min(finalX, maxX));
        finalY = Math.max(50, Math.min(finalY, maxY));

        // Snap to nearest edge (left or right)
        if (Math.abs(gesture.dx) > 10) {
          finalX = gesture.moveX < SCREEN_WIDTH / 2 ? 16 : maxX;
        }

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }).start();
      },
    })
  ).current;

  // Don't render if:
  // 1. No call context
  // 2. No active call (isInActiveCall = false)
  // 3. The full call interface is open (show full modal instead)
  if (!callContext || !callContext.isInActiveCall || callContext.isCallInterfaceOpen) {
    return null;
  }
  
  const { incomingCall, outgoingCall, endCall, returnToCall } = callContext;
  
  // Get caller name from either incoming call or outgoing call params
  let callerName = 'Call';
  if (incomingCall) {
    callerName = incomingCall.caller_name || 'Incoming';
  } else if (outgoingCall) {
    callerName = outgoingCall.userName || 'Outgoing';
  }

  // Simple floating bubble - tap to return to full call UI
  return (
    <Animated.View
      style={[
        styles.minimizedContainer,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.minimizedBubble}
        onPress={returnToCall}
        onLongPress={() => endCall()}
        delayLongPress={1000}
        activeOpacity={0.9}
      >
        <Ionicons name="call" size={28} color="#fff" />
        <View style={styles.pulseRingOuter} />
        <View style={styles.pulseRingInner} />
        <Text style={styles.bubbleLabel}>{callerName.split(' ')[0]}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  minimizedContainer: {
    position: 'absolute',
    width: MINIMIZED_SIZE,
    height: MINIMIZED_SIZE + 20, // Extra space for label
    zIndex: 9999,
    elevation: 999,
  },
  minimizedBubble: {
    width: MINIMIZED_SIZE,
    height: MINIMIZED_SIZE,
    borderRadius: MINIMIZED_SIZE / 2,
    backgroundColor: '#25D366', // WhatsApp green
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pulseRingOuter: {
    position: 'absolute',
    width: MINIMIZED_SIZE + 20,
    height: MINIMIZED_SIZE + 20,
    borderRadius: (MINIMIZED_SIZE + 20) / 2,
    borderWidth: 2,
    borderColor: '#25D366',
    opacity: 0.3,
  },
  pulseRingInner: {
    position: 'absolute',
    width: MINIMIZED_SIZE + 8,
    height: MINIMIZED_SIZE + 8,
    borderRadius: (MINIMIZED_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: '#25D366',
    opacity: 0.5,
  },
  bubbleLabel: {
    position: 'absolute',
    bottom: -18,
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: 80,
  },
});
