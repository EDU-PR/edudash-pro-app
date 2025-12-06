/**
 * DashTypingIndicator Component
 * 
 * Animated typing indicator for the Dash AI Assistant.
 * Shows current status (uploading, thinking, responding) with animated dots.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../DashAssistant.styles';
import { useTheme } from '@/contexts/ThemeContext';

interface DashTypingIndicatorProps {
  isLoading: boolean;
  loadingStatus: 'uploading' | 'thinking' | 'responding' | null;
}

export const DashTypingIndicator: React.FC<DashTypingIndicatorProps> = ({
  isLoading,
  loadingStatus,
}) => {
  const { theme } = useTheme();
  
  // Animated typing indicator
  const [dotAnimations] = useState([
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ]);

  useEffect(() => {
    if (isLoading) {
      const animations = dotAnimations.map((dot: Animated.Value, index: number) => 
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.timing(dot, {
              toValue: 1,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: false,
            }),
          ])
        )
      );
      Animated.parallel(animations).start();
    } else {
      dotAnimations.forEach((dot: Animated.Value) => {
        dot.stopAnimation();
        dot.setValue(0.3);
      });
    }
  }, [isLoading, dotAnimations]);

  const getStatusText = (): string => {
    switch (loadingStatus) {
      case 'uploading':
        return 'Uploading files...';
      case 'thinking':
        return 'Thinking...';
      case 'responding':
        return 'Responding...';
      default:
        return 'Processing...';
    }
  };
  
  const getStatusIcon = (): string => {
    switch (loadingStatus) {
      case 'uploading':
        return 'cloud-upload-outline';
      case 'thinking':
        return 'bulb-outline';
      case 'responding':
        return 'chatbox-ellipses-outline';
      default:
        return 'ellipsis-horizontal';
    }
  };

  if (!isLoading) return null;

  return (
    <View style={styles.typingIndicator}>
      <View style={[styles.typingBubble, { backgroundColor: theme.surface }]}>
        <View style={styles.typingContentRow}>
          {/* Status Icon */}
          <Ionicons 
            name={getStatusIcon() as any} 
            size={16} 
            color={theme.accent} 
            style={{ marginRight: 8 }}
          />
          
          {/* Status Text */}
          <Text style={[styles.typingText, { color: theme.text }]}>
            {getStatusText()}
          </Text>
          
          {/* Animated Dots */}
          <View style={styles.typingDots}>
            {dotAnimations.map((dot: Animated.Value, index: number) => (
              <Animated.View
                key={index}
                style={[
                  styles.typingDot,
                  {
                    backgroundColor: theme.accent,
                    opacity: dot,
                    transform: [
                      {
                        scale: dot.interpolate({
                          inputRange: [0.3, 1],
                          outputRange: [0.8, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
